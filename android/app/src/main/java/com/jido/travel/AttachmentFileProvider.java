package com.jido.travel;

import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.core.content.FileProvider;
import org.json.JSONObject;

/** Keep the original document name and MIME while serving a private UUID file. */
public class AttachmentFileProvider extends FileProvider {
    private JSONObject attachment(Uri uri) {
        if (uri.getPath() == null || !uri.getPath().startsWith("/attachments/")) return null;
        try { return AttachmentsPlugin.metadata(getContext(), uri.getLastPathSegment()); }
        catch (Exception error) { return null; }
    }
    @Override public String getType(Uri uri) {
        JSONObject info = attachment(uri);
        return info == null ? super.getType(uri) : info.optString("mimeType", "application/octet-stream");
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
        JSONObject info = attachment(uri);
        if (info == null) return super.query(uri, projection, selection, args, order);
        try (Cursor original = super.query(uri, projection, selection, args, order)) {
            if (original == null || !original.moveToFirst()) return null;
            String[] columns = original.getColumnNames(); Object[] values = new Object[columns.length];
            for (int index = 0; index < columns.length; index++) {
                if (columns[index].equals(OpenableColumns.DISPLAY_NAME)) values[index] = info.optString("name", "첨부 자료");
                else if (columns[index].equals(OpenableColumns.SIZE)) values[index] = original.getLong(index);
                else values[index] = original.getString(index);
            }
            MatrixCursor result = new MatrixCursor(columns, 1); result.addRow(values); return result;
        }
    }
}
