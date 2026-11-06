package com.jido.travel;

import android.accounts.Account;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.common.api.Scope;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/** OAuth tokens and bytes stay in memory/private files. No server or public uploads. */
@CapacitorPlugin(name="GoogleDriveSync")
public class GoogleDriveSyncPlugin extends Plugin {
    private static final String SCOPE="https://www.googleapis.com/auth/drive.appdata";
    private static final long MAX_FILE=25L*1024*1024;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Set<HttpURLConnection> connections=ConcurrentHashMap.newKeySet();
    private volatile int generation;
    private boolean authorizing;
    private static boolean validId(String id) { return id!=null && id.matches("[a-zA-Z0-9_-]{1,200}"); }
    private static String hex(byte[] bytes) { StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString(); }
    private void active(int token) throws IOException { if(token!=generation)throw new IOException("동기화가 중단됐어요."); }
    private String hash(File file,int token) throws Exception { MessageDigest digest=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(file)){byte[] buf=new byte[65536];int n;while((n=in.read(buf))!=-1){active(token);digest.update(buf,0,n);}}return hex(digest.digest()); }
    private HttpURLConnection connection(String url,String accessToken,String method) throws Exception {
        if(accessToken==null || accessToken.length()<10 || accessToken.length()>10000 || accessToken.contains("\n") || accessToken.contains("\r"))throw new IOException("Google 계정을 다시 연결해 주세요.");
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(20000);c.setReadTimeout(30000);c.setRequestMethod(method);c.setRequestProperty("Authorization","Bearer "+accessToken);c.setRequestProperty("Cache-Control","no-store");connections.add(c);return c;
    }
    private void closed(HttpURLConnection c) {if(c!=null){connections.remove(c);c.disconnect();}}
    private IOException responseError(int code) {return new IOException(code==401?"Google 계정을 다시 연결해 주세요.":code==403?"Google Drive 권한·용량과 프로젝트 설정을 확인해 주세요.":code==429?"Google Drive 요청이 많아요. 잠시 후 다시 시도해 주세요.":"Google Drive 파일을 전송하지 못했어요. ("+code+")");}
    private void resolved(PluginCall call,AuthorizationResult result) {
        authorizing=false;
        if(result.getAccessToken()==null || !result.getGrantedScopes().contains(SCOPE)){call.reject("Google Drive 앱 데이터 접근을 허용해 주세요.");return;}
        JSObject response=new JSObject();response.put("accessToken",result.getAccessToken());call.resolve(response);
    }
    @PluginMethod public void authorize(PluginCall call) {
        if(authorizing){call.reject("Google 계정 연결을 먼저 마쳐 주세요.");return;}authorizing=true;final int token=generation;
        AuthorizationRequest.Builder builder=AuthorizationRequest.builder().setRequestedScopes(Collections.singletonList(new Scope(SCOPE))).setOptOutIncludingGrantedScopes(true);
        String email=call.getString("email","");if(!email.isEmpty())builder.setAccount(new Account(email,"com.google"));
        if(call.getBoolean("selectAccount",false))builder.setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT);
        Identity.getAuthorizationClient(getActivity()).authorize(builder.build()).addOnSuccessListener(result->{
            if(token!=generation){authorizing=false;call.reject("Google 계정 연결이 취소됐어요.");return;}
            if(result.hasResolution()){
                if(!call.getBoolean("interactive",false)){authorizing=false;call.reject("Google 계정을 다시 연결해 주세요.");return;}
                try {
                    Intent intent=new Intent(getContext(),GoogleDriveAuthorizationActivity.class);
                    intent.putExtra("authorization",result.getPendingIntent());
                    startActivityForResult(call,intent,"authorized");
                } catch(Exception e){authorizing=false;call.reject("Google 계정 선택 화면을 열지 못했어요.");}
            } else resolved(call,result);
        }).addOnFailureListener(error->{authorizing=false;call.reject("Google 계정에 연결하지 못했어요. Google Play 서비스와 Drive API·Android OAuth 설정을 확인해 주세요.");});
    }
    @ActivityCallback private void authorized(PluginCall call,ActivityResult result) {
        authorizing=false;if(call==null)return;
        try {resolved(call,Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(result.getData()));}
        catch(Exception e){call.reject("Google 계정 연결을 마치지 않았어요.");}
    }
    @Override protected void handleOnDestroy() {generation++;for(HttpURLConnection c:connections)c.disconnect();connections.clear();worker.shutdownNow();super.handleOnDestroy();}
    @PluginMethod public void cancel(PluginCall call) {generation++;for(HttpURLConnection c:connections)c.disconnect();connections.clear();call.resolve();}
    @PluginMethod public void revoke(PluginCall call) {
        generation++;for(HttpURLConnection c:connections)c.disconnect();connections.clear();
        String email=call.getString("email","");if(email.isEmpty()){call.resolve();return;}
        Identity.getAuthorizationClient(getActivity()).revokeAccess(RevokeAccessRequest.builder().setAccount(new Account(email,"com.google")).setScopes(Collections.singletonList(new Scope(SCOPE))).build()).addOnSuccessListener(v->call.resolve()).addOnFailureListener(e->call.reject("Google 접근 권한 해제를 마치지 못했어요. 연결은 기기에서 끄고 Google 계정에서도 권한을 해제할 수 있어요."));
    }
    @PluginMethod public void inspectFile(PluginCall call) {
        final int token=generation;worker.execute(()->{try{File f=AttachmentsPlugin.file(getContext(),call.getString("id"));if(!f.isFile()||f.length()<=0||f.length()>MAX_FILE)throw new IOException("원본 자료를 찾을 수 없어요.");JSObject r=new JSObject();r.put("size",f.length());r.put("sha256",hash(f,token));active(token);call.resolve(r);}catch(Exception e){call.reject(e instanceof IOException?e.getMessage():"자료를 확인하지 못했어요.");}});
    }
    @PluginMethod public void uploadFile(PluginCall call) {
        final int token=generation;worker.execute(()->{HttpURLConnection c=null;try{
            String id=call.getString("id"),expected=call.getString("sha256","");File f=AttachmentsPlugin.file(getContext(),id);
            if(!f.isFile()||f.length()<=0||f.length()>MAX_FILE||!expected.matches("[a-f0-9]{64}")||!hash(f,token).equals(expected))throw new IOException("원본 자료가 변경됐어요. 다시 동기화해 주세요.");
            JSONObject meta=new JSONObject();meta.put("name","JDo-file-"+id+"-"+expected);meta.put("parents",new JSONArray().put("appDataFolder"));meta.put("appProperties",new JSONObject().put("jido-app","jido-sync").put("jido-kind","blob-v1").put("logicalId",id).put("sha256",expected));
            byte[] metadata=meta.toString().getBytes(StandardCharsets.UTF_8);active(token);
            c=connection("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,appProperties",call.getString("accessToken"),"POST");c.setDoOutput(true);c.setFixedLengthStreamingMode(metadata.length);c.setRequestProperty("Content-Type","application/json; charset=UTF-8");c.setRequestProperty("X-Upload-Content-Type","application/octet-stream");c.setRequestProperty("X-Upload-Content-Length",Long.toString(f.length()));
            try(OutputStream out=c.getOutputStream()){out.write(metadata);}
            int created=c.getResponseCode();if(created<200||created>=300)throw responseError(created);
            String location=c.getHeaderField("Location");URI uri=new URI(location==null?"":location);
            if(!"https".equals(uri.getScheme())||!"www.googleapis.com".equals(uri.getHost())||!"/upload/drive/v3/files".equals(uri.getPath())||uri.getUserInfo()!=null||uri.getFragment()!=null||(uri.getPort()!=-1&&uri.getPort()!=443))throw new IOException("Drive 업로드 주소를 확인하지 못했어요.");
            closed(c);active(token);c=connection(location,call.getString("accessToken"),"PUT");c.setDoOutput(true);c.setFixedLengthStreamingMode(f.length());c.setRequestProperty("Content-Type","application/octet-stream");
            try(OutputStream out=c.getOutputStream();InputStream in=new FileInputStream(f)){byte[] buf=new byte[65536];int n;while((n=in.read(buf))!=-1){active(token);out.write(buf,0,n);}}
            active(token);int code=c.getResponseCode();if(code<200||code>=300)throw responseError(code);ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=c.getInputStream()){byte[] b=new byte[2048];int n;while((n=in.read(b))!=-1){if(bytes.size()+n>32768)throw new IOException("Drive 응답이 너무 커요.");bytes.write(b,0,n);}}
            JSONObject response=new JSONObject(bytes.toString("UTF-8"));if(!validId(response.optString("id")))throw new IOException("Drive 파일 번호를 확인하지 못했어요.");JSObject out=new JSObject();out.put("id",response.getString("id"));call.resolve(out);
        }catch(Exception e){call.reject(e instanceof IOException?e.getMessage():"자료를 Drive에 보내지 못했어요.");}finally{closed(c);}});
    }
    @PluginMethod public void downloadFile(PluginCall call) {
        final int token=generation;worker.execute(()->{HttpURLConnection c=null;File temp=null,staged=null,stagedMeta=null;try{
            JSONObject descriptor=new JSONObject(call.getString("attachment","{}"));String id=descriptor.getString("id"),remote=call.getString("fileId"),expected=call.getString("sha256","");long size=descriptor.getLong("size");File target=AttachmentsPlugin.file(getContext(),id);
            if(!validId(remote)||!expected.matches("[a-f0-9]{64}")||size<=0||size>MAX_FILE)throw new IOException("동기화 파일 정보를 확인해 주세요.");
            if(target.isFile()){if(target.length()!=size||!hash(target,token).equals(expected))throw new IOException("같은 자료 번호의 파일 내용이 달라요. 기존 파일을 보존했어요.");JSObject r=new JSObject();r.put("created",false);call.resolve(r);return;}
            temp=File.createTempFile("jido-sync-",".tmp",getContext().getCacheDir());c=connection("https://www.googleapis.com/drive/v3/files/"+remote+"?alt=media",call.getString("accessToken"),"GET");int code=c.getResponseCode();if(code!=200)throw responseError(code);
            MessageDigest digest=MessageDigest.getInstance("SHA-256");long total=0;try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(temp)){byte[] buf=new byte[65536];int n;while((n=in.read(buf))!=-1){active(token);total+=n;if(total>size)throw new IOException("자료 크기가 다릅니다.");digest.update(buf,0,n);out.write(buf,0,n);}out.getFD().sync();}
            if(total!=size||!hex(digest.digest()).equals(expected))throw new IOException("자료가 손상됐어요. 기존 기록은 그대로예요.");active(token);
            File directory=AttachmentsPlugin.directory(getContext());staged=new File(directory,id+".sync");try(InputStream in=new FileInputStream(temp);FileOutputStream out=new FileOutputStream(staged)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1){active(token);out.write(b,0,n);}out.getFD().sync();}catch(Exception e){staged.delete();throw e;}
            descriptor.put("storage","android");File metadata=new File(directory,id+".json");stagedMeta=new File(directory,id+".sync.json");
            try(FileOutputStream out=new FileOutputStream(stagedMeta)){out.write(descriptor.toString().getBytes(StandardCharsets.UTF_8));out.getFD().sync();}
            // All explicit-ID sync writers share this lock. Other attachment
            // importers create fresh random UUIDs; existing files are immutable.
            // File.renameTo works on Android 7, unlike java.nio.file.Files.
            synchronized(AttachmentsPlugin.class){
                active(token);
                if(target.exists()){
                    if(!target.isFile()||target.length()!=size||!hash(target,token).equals(expected))throw new IOException("같은 자료 번호의 다른 파일이 있어요. 기존 파일은 보존했어요.");
                    JSObject existing=new JSObject();existing.put("created",false);call.resolve(existing);return;
                }
                if(!staged.renameTo(target))throw new IOException("자료를 기기에 보관하지 못했어요.");
                if(!stagedMeta.renameTo(metadata)){target.delete();throw new IOException("자료 정보를 기기에 보관하지 못했어요.");}
            }
            JSObject result=new JSObject();result.put("created",true);call.resolve(result);
        }catch(Exception e){call.reject(e instanceof IOException?e.getMessage():"Drive 자료를 받지 못했어요.");}finally{closed(c);if(temp!=null)temp.delete();if(staged!=null)staged.delete();if(stagedMeta!=null)stagedMeta.delete();}});
    }
}
