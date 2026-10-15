package com.jido.travel;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "Attachments")
public class AttachmentsPlugin extends Plugin {
    private static final long MAX_BYTES = 25L * 1024 * 1024;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private boolean picking;
    private static final Map<String, String> TYPES = new HashMap<>();
    static {
        TYPES.put("pdf", "application/pdf"); TYPES.put("jpg", "image/jpeg"); TYPES.put("jpeg", "image/jpeg");
        TYPES.put("png", "image/png"); TYPES.put("webp", "image/webp"); TYPES.put("gif", "image/gif");
        TYPES.put("heic", "image/heic"); TYPES.put("heif", "image/heif"); TYPES.put("txt", "text/plain"); TYPES.put("csv", "text/csv");
        TYPES.put("doc", "application/msword"); TYPES.put("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        TYPES.put("xls", "application/vnd.ms-excel"); TYPES.put("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        TYPES.put("ppt", "application/vnd.ms-powerpoint"); TYPES.put("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
        TYPES.put("zip", "application/zip"); TYPES.put("hwp", "application/x-hwp"); TYPES.put("hwpx", "application/vnd.hancom.hwpx"); TYPES.put("md", "text/plain");
    }
    static File directory(Context context) throws IOException {
        File dir = new File(context.getFilesDir(), "jido-attachments");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("기기에 자료를 저장할 수 없습니다.");
        return dir;
    }
    static File file(Context context, String id) throws IOException {
        if (id == null || !id.matches("[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}")) throw new IOException("자료 번호가 올바르지 않습니다.");
        return new File(directory(context), id);
    }
    static JSONObject metadata(Context context, String id) throws Exception {
        File target = file(context, id);
        if (!target.isFile()) throw new IOException("자료가 없습니다. 다시 첨부해 주세요.");
        File meta = new File(directory(context), id + ".json");
        try (InputStream stream = new FileInputStream(meta)) {
            ByteArrayOutputStream output = new ByteArrayOutputStream(); byte[] buffer = new byte[2048]; int read;
            while ((read = stream.read(buffer)) != -1) { output.write(buffer, 0, read); if (output.size() > 8192) throw new IOException("자료 정보를 읽을 수 없습니다."); }
            return new JSONObject(output.toString("UTF-8"));
        }
    }
    @PluginMethod public void pickFiles(PluginCall call) {
        if (picking) { call.reject("파일 선택을 먼저 마쳐 주세요."); return; }
        picking = true;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType(call.getBoolean("imagesOnly", false) ? "image/*" : "*/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true); intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivityForResult(call, intent, "picked"); }
        catch (Exception error) { picking = false; call.reject("파일 선택기를 열 수 없습니다."); }
    }
    @ActivityCallback private void picked(PluginCall call, ActivityResult result) {
        if (call == null) { picking = false; return; }
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            picking = false; JSObject response = new JSObject(); response.put("files", new JSArray()); response.put("errors", new JSArray()); call.resolve(response); return;
        }
        List<Uri> selected = new ArrayList<>();
        if (data.getClipData() != null) for (int i = 0; i < data.getClipData().getItemCount(); i++) selected.add(data.getClipData().getItemAt(i).getUri());
        else if (data.getData() != null) selected.add(data.getData());
        worker.execute(() -> {
            JSArray files = new JSArray(), errors = new JSArray();
            int limit = Math.max(0, Math.min(10, call.getInt("limit", 10)));
            if (selected.size() > limit) errors.put("한 번에 최대 " + limit + "개를 첨부할 수 있습니다.");
            for (Uri uri : selected.subList(0, Math.min(selected.size(), limit))) {
                try { files.put(importFile(uri, call.getBoolean("imagesOnly", false))); }
                catch (Exception error) { errors.put(error instanceof IOException ? error.getMessage() : "자료를 저장하지 못했습니다. 파일과 기기 여유 공간을 확인해 주세요."); }
            }
            JSObject response = new JSObject(); response.put("files", files); response.put("errors", errors);
            getActivity().runOnUiThread(() -> { picking = false; call.resolve(response); });
        });
    }
    private JSObject importFile(Uri uri, boolean imagesOnly) throws Exception {
        String name = "첨부 자료", mime = getContext().getContentResolver().getType(uri); long size = -1;
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int n = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME), s = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (n >= 0 && !cursor.isNull(n)) name = cursor.getString(n);
                if (s >= 0 && !cursor.isNull(s)) size = cursor.getLong(s);
            }
        }
        name = name.replace('/', '_').replace('\\', '_').replaceAll("[\\p{Cntrl}]", "").trim(); if (name.isEmpty()) name = "첨부 자료";
        String extension = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        if (name.length() > 200) name = extension.length() > 0 && extension.length() < 20 ? name.substring(0, 199 - extension.length()) + "." + extension : name.substring(0, 200);
        if ("application/haansofthwp".equals(mime) || "application/vnd.hancom.hwp".equals(mime)) mime = "application/x-hwp";
        // File providers sometimes report generic binary MIME for office documents.
        if (!TYPES.containsValue(mime)) mime = TYPES.get(extension);
        if (mime == null) throw new IOException(name + ": 지원하지 않는 파일 형식입니다.");
        if (imagesOnly && !mime.startsWith("image/")) throw new IOException(name + ": 사진 파일을 선택하세요.");
        if (size > MAX_BYTES) throw new IOException(name + ": 파일은 25MB 이하로 첨부하세요.");
        String id = UUID.randomUUID().toString(); File target = file(getContext(), id), partial = new File(directory(getContext()), id + ".part"), meta = new File(directory(getContext()), id + ".json");
        long count = 0;
        try {
            try (InputStream input = getContext().getContentResolver().openInputStream(uri); FileOutputStream output = new FileOutputStream(partial)) {
                if (input == null) throw new IOException(name + ": 파일을 읽을 수 없습니다.");
                byte[] buffer = new byte[65536]; int read;
                while ((read = input.read(buffer)) != -1) { count += read; if (count > MAX_BYTES) throw new IOException(name + ": 파일은 25MB 이하로 첨부하세요."); output.write(buffer, 0, read); }
                output.getFD().sync();
            }
            if (count == 0) throw new IOException(name + ": 빈 파일은 첨부할 수 없습니다.");
            if (!partial.renameTo(target)) throw new IOException(name + ": 자료를 저장할 수 없습니다.");
            SimpleDateFormat clock = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT); clock.setTimeZone(TimeZone.getTimeZone("UTC"));
            JSObject attachment = new JSObject(); attachment.put("id", id); attachment.put("name", name); attachment.put("mimeType", mime); attachment.put("size", count); attachment.put("createdAt", clock.format(new Date())); attachment.put("storage", "android");
            try (FileOutputStream output = new FileOutputStream(meta)) { output.write(attachment.toString().getBytes("UTF-8")); output.getFD().sync(); }
            return attachment;
        } catch (Exception error) { partial.delete(); target.delete(); meta.delete(); throw error; }
    }
    @PluginMethod public void getUri(PluginCall call) {
        try { String id = call.getString("id"); metadata(getContext(), id); JSObject result = new JSObject(); result.put("uri", Uri.fromFile(file(getContext(), id)).toString()); call.resolve(result); }
        catch (Exception error) { call.reject("자료가 없습니다. 다시 첨부해 주세요."); }
    }
    @PluginMethod public void readText(PluginCall call) {
        worker.execute(() -> {
            try {
                String id = call.getString("id"); String mime = metadata(getContext(), id).getString("mimeType");
                if (!mime.equals("text/plain") && !mime.equals("text/csv")) throw new IOException("텍스트 자료가 아닙니다.");
                File target = file(getContext(), id); byte[] buffer = new byte[100000]; int read;
                try (InputStream input = new FileInputStream(target)) { read = input.read(buffer); }
                JSObject result = new JSObject(); result.put("text", new String(buffer, 0, Math.max(0, read), "UTF-8")); result.put("truncated", target.length() > buffer.length); call.resolve(result);
            } catch (Exception error) { call.reject("자료를 읽을 수 없습니다."); }
        });
    }
    @PluginMethod public void openFile(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                String id = call.getString("id"), mime = metadata(getContext(), id).getString("mimeType");
                if (mime.equals("application/pdf") && !call.getBoolean("external", false)) {
                    Intent intent = new Intent(getContext(), PdfViewerActivity.class); intent.putExtra("id", id); getActivity().startActivity(intent);
                } else openExternal(getActivity(), id, mime);
                call.resolve();
            } catch (android.content.ActivityNotFoundException error) { call.reject("이 자료를 열 수 있는 문서 앱이 필요합니다."); }
            catch (Exception error) { call.reject("자료를 열 수 없습니다. 파일을 다시 첨부해 주세요."); }
        });
    }
    static void openExternal(Activity activity, String id, String mime) throws Exception {
        Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", file(activity, id));
        Intent intent = new Intent(Intent.ACTION_VIEW); intent.setDataAndType(uri, mime); intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.setClipData(android.content.ClipData.newRawUri("첨부 자료", uri));
        activity.startActivity(Intent.createChooser(intent, "자료 열기"));
    }
    @PluginMethod public void deleteFile(PluginCall call) {
        worker.execute(() -> {
            try {
                String id = call.getString("id"); File target = file(getContext(), id), meta = new File(directory(getContext()), id + ".json");
                if (target.exists() && !target.delete()) throw new IOException("자료를 삭제할 수 없습니다.");
                if (meta.exists()) meta.delete();
                File cache = new File(getContext().getCacheDir(), "attachment-view/" + id); File[] copies = cache.listFiles(); if (copies != null) for (File copy : copies) copy.delete(); if (cache.isDirectory()) cache.delete();
                call.resolve();
            } catch (Exception error) { call.reject("자료를 삭제하지 못했습니다."); }
        });
    }
    @Override protected void handleOnDestroy() { worker.shutdown(); }
}
