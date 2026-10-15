package com.jido.travel;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.pdf.PdfRenderer;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.widget.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PdfViewerActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private PdfRenderer renderer; private ParcelFileDescriptor descriptor;
    private ZoomImage image; private Button previous, next; private TextView count;
    private int page = 0; private String id; private boolean loading;
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state); id = getIntent().getStringExtra("id"); if (state != null) page = state.getInt("page", 0);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener((view, insets) -> { root.setPadding(dp(12) + insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), dp(12) + insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets; });
        LinearLayout bar = new LinearLayout(this); bar.setGravity(Gravity.CENTER_VERTICAL);
        Button back = new Button(this); back.setText("뒤로"); back.setOnClickListener(view -> finish()); bar.addView(back);
        TextView title = new TextView(this); title.setTextSize(16); title.setTextColor(Color.rgb(20, 70, 55)); title.setMaxLines(2);
        try { title.setText(AttachmentsPlugin.metadata(this, id).getString("name")); } catch (Exception error) { title.setText("PDF 자료"); }
        bar.addView(title, new LinearLayout.LayoutParams(0, -2, 1)); root.addView(bar);
        image = new ZoomImage(); root.addView(image, new LinearLayout.LayoutParams(-1, 0, 1));
        LinearLayout controls = new LinearLayout(this); controls.setGravity(Gravity.CENTER_VERTICAL);
        previous = new Button(this); previous.setText("이전"); previous.setOnClickListener(view -> render(page - 1)); controls.addView(previous);
        count = new TextView(this); count.setGravity(Gravity.CENTER); count.setText("자료 여는 중…"); controls.addView(count, new LinearLayout.LayoutParams(0, -2, 1));
        next = new Button(this); next.setText("다음"); next.setOnClickListener(view -> render(page + 1)); controls.addView(next); root.addView(controls); setContentView(root);
        previous.setEnabled(false); next.setEnabled(false);
        worker.execute(() -> {
            try { descriptor = ParcelFileDescriptor.open(AttachmentsPlugin.file(this, id), ParcelFileDescriptor.MODE_READ_ONLY); renderer = new PdfRenderer(descriptor); if (renderer.getPageCount() == 0) throw new IllegalArgumentException(); runOnUiThread(() -> { if (!isDestroyed()) render(Math.min(page, renderer.getPageCount() - 1)); }); }
            catch (Exception error) { runOnUiThread(this::failed); }
        });
    }
    private void render(int target) {
        if (loading || renderer == null || target < 0 || target >= renderer.getPageCount()) return;
        loading = true; previous.setEnabled(false); next.setEnabled(false); count.setText("페이지 여는 중…");
        worker.execute(() -> {
            try (PdfRenderer.Page opened = renderer.openPage(target)) {
                float scale = Math.min(1400f / opened.getWidth(), 2000f / opened.getHeight());
                Bitmap bitmap = Bitmap.createBitmap(Math.max(1, Math.round(opened.getWidth() * scale)), Math.max(1, Math.round(opened.getHeight() * scale)), Bitmap.Config.ARGB_8888); bitmap.eraseColor(Color.WHITE);
                opened.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                runOnUiThread(() -> { if (isDestroyed()) { bitmap.recycle(); return; } page = target; image.setImageBitmap(bitmap); loading = false; count.setText((page + 1) + " / " + renderer.getPageCount()); previous.setEnabled(page > 0); next.setEnabled(page + 1 < renderer.getPageCount()); });
            } catch (Exception error) { runOnUiThread(this::failed); }
        });
    }
    private void failed() {
        if (isDestroyed() || isFinishing()) return;
        loading = false;
        new AlertDialog.Builder(this).setTitle("PDF를 열 수 없습니다").setMessage("암호가 필요하거나 지원하지 않는 PDF입니다.").setPositiveButton("다른 앱에서 열기", (dialog, which) -> {
            try { AttachmentsPlugin.openExternal(this, id, "application/pdf"); } catch (Exception error) { Toast.makeText(this, "PDF 문서 앱이 필요합니다.", Toast.LENGTH_LONG).show(); } finish();
        }).setNegativeButton("닫기", (dialog, which) -> finish()).setOnCancelListener(dialog -> finish()).show();
    }
    @Override protected void onSaveInstanceState(Bundle state) { state.putInt("page", page); super.onSaveInstanceState(state); }
    @Override protected void onDestroy() { super.onDestroy(); worker.execute(() -> { if (renderer != null) renderer.close(); try { if (descriptor != null) descriptor.close(); } catch (Exception ignored) {} }); worker.shutdown(); }
    private class ZoomImage extends ImageView {
        private final ScaleGestureDetector detector; private float zoom = 1, dx, dy, lastX, lastY;
        ZoomImage() { super(PdfViewerActivity.this); setScaleType(ScaleType.MATRIX); setContentDescription("PDF 페이지 · 두 손가락으로 확대"); detector = new ScaleGestureDetector(PdfViewerActivity.this, new ScaleGestureDetector.SimpleOnScaleGestureListener() { @Override public boolean onScale(ScaleGestureDetector gesture) { zoom = Math.max(1, Math.min(5, zoom * gesture.getScaleFactor())); update(); return true; } }); }
        @Override public void setImageBitmap(Bitmap bitmap) { super.setImageBitmap(bitmap); zoom = 1; dx = dy = 0; update(); }
        @Override protected void onSizeChanged(int w, int h, int oldw, int oldh) { super.onSizeChanged(w, h, oldw, oldh); update(); }
        private void update() {
            if (getDrawable() == null || getWidth() == 0 || getHeight() == 0) return;
            float w = getDrawable().getIntrinsicWidth(), h = getDrawable().getIntrinsicHeight(); float scale = Math.min(getWidth() / w, getHeight() / h) * zoom;
            dx = Math.max(-Math.max(0, (w * scale - getWidth()) / 2), Math.min(dx, Math.max(0, (w * scale - getWidth()) / 2)));
            dy = Math.max(-Math.max(0, (h * scale - getHeight()) / 2), Math.min(dy, Math.max(0, (h * scale - getHeight()) / 2)));
            Matrix matrix = new Matrix(); matrix.postScale(scale, scale); matrix.postTranslate((getWidth() - w * scale) / 2 + dx, (getHeight() - h * scale) / 2 + dy); setImageMatrix(matrix);
        }
        @Override public boolean onTouchEvent(MotionEvent event) { detector.onTouchEvent(event); if (event.getActionMasked() == MotionEvent.ACTION_MOVE && !detector.isInProgress()) { dx += event.getX() - lastX; dy += event.getY() - lastY; update(); } lastX = event.getX(); lastY = event.getY(); if (event.getActionMasked() == MotionEvent.ACTION_UP) performClick(); return true; }
        @Override public boolean performClick() { super.performClick(); return true; }
    }
}
