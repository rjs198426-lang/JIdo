package com.jido.travel;

import android.os.Bundle;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AttachmentsPlugin.class);
        registerPlugin(TravelSharingPlugin.class);
        super.onCreate(savedInstanceState);
        // Identify this personal app to community map tiles, keeping WebView defaults.
        android.webkit.WebSettings settings = getBridge().getWebView().getSettings();
        settings.setUserAgentString(settings.getUserAgentString() + " JidoTravel/1.0 (https://github.com/rjs198426-lang/JIdo)");
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Reopening from the app icon shows Home. Returning from a file picker,
        // attachment preview, sharing sheet or map preserves the current work.
        if (intent != null && Intent.ACTION_MAIN.equals(intent.getAction())
                && intent.hasCategory(Intent.CATEGORY_LAUNCHER) && getBridge() != null) {
            getBridge().triggerWindowJSEvent("jido:launcher-open");
        }
    }
}
