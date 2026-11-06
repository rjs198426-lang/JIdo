package com.jido.travel;

import android.os.Bundle;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AttachmentsPlugin.class);
        registerPlugin(TravelSharingPlugin.class);
        registerPlugin(TravelBackupPlugin.class);
        registerPlugin(GoogleDriveSyncPlugin.class);
        super.onCreate(savedInstanceState);
        // Identify this personal app to community map tiles, keeping WebView defaults.
        android.webkit.WebSettings settings = getBridge().getWebView().getSettings();
        settings.setUserAgentString(settings.getUserAgentString() + " JidoTravel/1.0 (https://github.com/rjs198426-lang/JIdo)");
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Reopening from the launcher preserves the current work. The event
        // only flushes navigation preferences; it does not navigate or dismiss drafts.
        if (intent != null && Intent.ACTION_MAIN.equals(intent.getAction())
                && intent.hasCategory(Intent.CATEGORY_LAUNCHER) && getBridge() != null) {
            getBridge().triggerWindowJSEvent("jido:launcher-open");
        }
    }
}
