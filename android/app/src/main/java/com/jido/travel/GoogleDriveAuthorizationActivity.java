package com.jido.travel;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Bundle;

/** Non-exported relay for Google's IntentSender; no tokens are stored. */
public class GoogleDriveAuthorizationActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        if(state!=null)return;
        try {
            PendingIntent authorization=getIntent().getParcelableExtra("authorization");
            if(authorization==null)throw new IllegalStateException();
            startIntentSenderForResult(authorization.getIntentSender(),1,null,0,0,0);
        } catch(Exception e){setResult(RESULT_CANCELED);finish();}
    }
    @Override protected void onActivityResult(int request,int code,Intent data) {
        super.onActivityResult(request,code,data);
        if(request==1){setResult(code,data);finish();}
    }
}
