package com.jido.travel;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@CapacitorPlugin(name = "TravelSharing")
public class TravelSharingPlugin extends Plugin {
    @PluginMethod public void share(PluginCall call) {
        String json = call.getString("json"), text = call.getString("text");
        String content = json != null ? json : text;
        if (content == null || content.isEmpty()) { call.reject("전달할 일정이 없습니다."); return; }
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 5 * 1024 * 1024) { call.reject("일정 파일이 너무 큽니다."); return; }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.putExtra(Intent.EXTRA_SUBJECT, call.getString("title", "J★Do 여행 일정"));
                if (json != null) {
                    File root = new File(getContext().getCacheDir(), "shared-itineraries");
                    File[] old = root.listFiles();
                    if (old != null) for (File folder : old) if (folder.lastModified() < System.currentTimeMillis() - 86400000L) {
                        File[] files = folder.listFiles(); if (files != null) for (File file : files) file.delete(); folder.delete();
                    }
                    File folder = new File(root, UUID.randomUUID().toString());
                    if (!folder.mkdirs()) throw new java.io.IOException();
                    File file = new File(folder, "jido-itinerary.json");
                    try (FileOutputStream stream = new FileOutputStream(file)) { stream.write(bytes); }
                    Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                    intent.setType("application/json"); intent.putExtra(Intent.EXTRA_STREAM, uri);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    intent.setClipData(android.content.ClipData.newRawUri("여행 일정", uri));
                } else { intent.setType("text/plain"); intent.putExtra(Intent.EXTRA_TEXT, text); }
                getActivity().startActivity(Intent.createChooser(intent, "동행자에게 일정 전달")); call.resolve();
            } catch (Exception error) { call.reject("일정을 전달하지 못했습니다."); }
        });
    }
}
