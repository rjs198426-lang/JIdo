package com.jido.travel;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.*;

@CapacitorPlugin(name="TravelBackup")
public class TravelBackupPlugin extends Plugin {
    private static final long MAX_FILE=25L*1024*1024, MAX_TOTAL=1024L*1024*1024, MAX_MANIFEST=10L*1024*1024;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private volatile boolean busy;
    private File exporting;
    private final Map<String,File> imports=new ConcurrentHashMap<>();
    private static boolean uuid(String id) { return id!=null && id.matches("[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}"); }
    private File temp(String prefix) throws IOException { File f=new File(getContext().getCacheDir(),prefix+UUID.randomUUID());if(!f.mkdirs())throw new IOException("백업 작업 공간이 부족합니다.");return f; }
    private void remove(File f) { if(f==null)return;File[] list=f.listFiles();if(list!=null)for(File child:list)remove(child);f.delete(); }
    private String hash(File f) throws Exception {MessageDigest md=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(f)){byte[] buf=new byte[65536];int n;while((n=in.read(buf))!=-1)md.update(buf,0,n);}StringBuilder s=new StringBuilder();for(byte b:md.digest())s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();}
    private void copy(InputStream in,OutputStream out,long limit) throws IOException {byte[] buf=new byte[65536];long total=0;int n;while((n=in.read(buf))!=-1){total+=n;if(total>limit)throw new IOException("백업 파일 크기 제한을 넘었습니다.");out.write(buf,0,n);}}
    private void chooser(PluginCall call,File file,String name,String mime) {
        getActivity().runOnUiThread(()->{try{exporting=file;Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(mime);intent.putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(call,intent,"saved");}catch(Exception e){busy=false;remove(file.getParentFile());call.reject("백업 저장 위치를 열지 못했습니다.");}});
    }
    @PluginMethod public void saveDocument(PluginCall call) {
        if(busy){call.reject("진행 중인 백업을 먼저 마쳐 주세요.");return;}busy=true;
        worker.execute(()->{File root=null;try{String text=call.getString("text","");byte[] bytes=text.getBytes(StandardCharsets.UTF_8);if(bytes.length>MAX_MANIFEST)throw new IOException("일정 파일이 너무 큽니다.");root=temp("jido-export-");File f=new File(root,"backup.json");try(FileOutputStream o=new FileOutputStream(f)){o.write(bytes);o.getFD().sync();}boolean csv="csv".equals(call.getString("format"));chooser(call,f,csv?"JDo-expenses.csv":"JDo-trips.json",csv?"text/csv":"application/json");}catch(Exception e){remove(root);busy=false;call.reject("일정 백업을 저장하지 못했습니다.");}});
    }
    @PluginMethod public void exportArchive(PluginCall call) {
        if(busy){call.reject("진행 중인 백업을 먼저 마쳐 주세요.");return;}busy=true;
        worker.execute(()->{File root=null;try{
            String text=call.getString("manifest","");if(text.getBytes(StandardCharsets.UTF_8).length>MAX_MANIFEST)throw new IOException("백업 정보가 너무 큽니다.");JSONObject manifest=new JSONObject(text);JSONArray files=manifest.getJSONArray("files");if(files.length()>5000)throw new IOException("한 백업에는 최대 5,000개 파일을 보관할 수 있습니다.");long total=0;Set<String> ids=new HashSet<>();
            for(int i=0;i<files.length();i++){JSONObject item=files.getJSONObject(i);String id=item.getString("id");if(!uuid(id)||!ids.add(id))throw new IOException("백업 자료 번호를 확인하세요.");File source=AttachmentsPlugin.file(getContext(),id);if(!source.isFile()||source.length()!=item.getLong("size"))throw new IOException(item.optString("name")+": 원본 자료가 없거나 변경되었습니다.");total+=source.length();if(source.length()>MAX_FILE||total>MAX_TOTAL)throw new IOException("전체 백업은 1GB 이하로 저장하세요.");item.put("sha256",hash(source));}
            if(manifest.toString().getBytes(StandardCharsets.UTF_8).length>MAX_MANIFEST)throw new IOException("백업 정보가 너무 큽니다.");
            root=temp("jido-export-");File archive=new File(root,"JDo-full-backup.zip");try(ZipOutputStream zip=new ZipOutputStream(new BufferedOutputStream(new FileOutputStream(archive)))){zip.setLevel(0);zip.putNextEntry(new ZipEntry("manifest.json"));zip.write(manifest.toString().getBytes(StandardCharsets.UTF_8));zip.closeEntry();for(int i=0;i<files.length();i++){String id=files.getJSONObject(i).getString("id");zip.putNextEntry(new ZipEntry("files/"+id));try(InputStream in=new FileInputStream(AttachmentsPlugin.file(getContext(),id))){copy(in,zip,MAX_FILE);}zip.closeEntry();}}
            chooser(call,archive,"JDo-full-backup.zip","application/zip");
        }catch(Exception e){remove(root);busy=false;call.reject(e instanceof IOException?e.getMessage():"전체 백업을 만들지 못했습니다.");}});
    }
    @ActivityCallback private void saved(PluginCall call,ActivityResult result) {
        File file=exporting;exporting=null;if(call==null){busy=false;if(file!=null)remove(file.getParentFile());return;}
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){busy=false;if(file!=null)remove(file.getParentFile());JSObject r=new JSObject();r.put("cancelled",true);call.resolve(r);return;}
        Uri uri=result.getData().getData();worker.execute(()->{try(InputStream in=new FileInputStream(file);OutputStream out=getContext().getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException();copy(in,out,MAX_TOTAL+MAX_MANIFEST+1024*1024);out.flush();JSObject r=new JSObject();r.put("cancelled",false);call.resolve(r);}catch(Exception e){try{android.provider.DocumentsContract.deleteDocument(getContext().getContentResolver(),uri);}catch(Exception ignored){}call.reject("백업 파일을 저장하지 못했습니다. 기기 여유 공간을 확인하세요.");}finally{remove(file.getParentFile());busy=false;}});
    }
    @PluginMethod public void inspectArchive(PluginCall call) {
        if(busy){call.reject("진행 중인 백업을 먼저 마쳐 주세요.");return;}busy=true;Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");try{startActivityForResult(call,intent,"picked");}catch(Exception e){busy=false;call.reject("백업 파일 선택기를 열지 못했습니다.");}
    }
    @ActivityCallback private void picked(PluginCall call,ActivityResult result) {
        if(call==null){busy=false;return;}if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){busy=false;JSObject r=new JSObject();r.put("cancelled",true);call.resolve(r);return;}Uri uri=result.getData().getData();worker.execute(()->{File root=null;try{
            root=temp("jido-import-");Set<String> names=new HashSet<>();long total=0;String manifestText=null;
            try(InputStream raw=getContext().getContentResolver().openInputStream(uri);ZipInputStream zip=new ZipInputStream(new BufferedInputStream(raw))){ZipEntry entry;while((entry=zip.getNextEntry())!=null){String name=entry.getName();if(!names.add(name)||names.size()>5001||entry.isDirectory())throw new IOException("중복되거나 지원하지 않는 백업 항목입니다.");if(name.equals("manifest.json")){ByteArrayOutputStream out=new ByteArrayOutputStream();copy(zip,out,MAX_MANIFEST);manifestText=out.toString("UTF-8");}else{if(!name.startsWith("files/")||!uuid(name.substring(6)))throw new IOException("백업 파일 경로가 올바르지 않습니다.");File target=new File(root,name.substring(6));try(OutputStream out=new FileOutputStream(target)){copy(zip,out,MAX_FILE);}total+=target.length();if(total>MAX_TOTAL)throw new IOException("전체 백업은 1GB 이하로 가져오세요.");}zip.closeEntry();}}
            if(manifestText==null)throw new IOException("J★Do 전체 백업 정보가 없습니다.");JSONObject manifest=new JSONObject(manifestText);if(!manifest.optString("format").equals("jido-full-backup")||manifest.optInt("version")!=1)throw new IOException("지원하지 않는 백업 형식입니다.");JSONArray files=manifest.getJSONArray("files");if(files.length()>5000||names.size()!=files.length()+1)throw new IOException("백업 파일 목록이 일치하지 않습니다.");Set<String> ids=new HashSet<>();for(int i=0;i<files.length();i++){JSONObject meta=files.getJSONObject(i);String id=meta.getString("id");if(!uuid(id)||!ids.add(id))throw new IOException("자료 번호가 올바르지 않습니다.");File source=new File(root,id);if(!source.isFile()||source.length()!=meta.getLong("size")||!hash(source).equals(meta.getString("sha256")))throw new IOException("백업 자료가 손상되었습니다: "+meta.optString("name"));}
            try(FileOutputStream out=new FileOutputStream(new File(root,"manifest.json"))){out.write(manifestText.getBytes(StandardCharsets.UTF_8));}String token=UUID.randomUUID().toString();imports.put(token,root);JSObject response=new JSObject();response.put("token",token);response.put("manifest",manifestText);call.resolve(response);
        }catch(Exception e){remove(root);call.reject(e instanceof IOException?e.getMessage():"백업을 읽지 못했습니다. 파일 형식을 확인하세요.");}finally{busy=false;}});
    }
    @PluginMethod public void commitArchive(PluginCall call) {
        if(busy){call.reject("진행 중인 백업을 먼저 마쳐 주세요.");return;}
        String token=call.getString("token");File root=token==null?null:imports.get(token);if(root==null){call.reject("백업 파일을 다시 선택하세요.");return;}busy=true;
        worker.execute(()->{List<File> created=new ArrayList<>();try{JSONObject manifest;try(InputStream in=new FileInputStream(new File(root,"manifest.json"))){ByteArrayOutputStream out=new ByteArrayOutputStream();copy(in,out,MAX_MANIFEST);manifest=new JSONObject(out.toString("UTF-8"));}JSONArray files=manifest.getJSONArray("files");JSArray mapped=new JSArray();for(int i=0;i<files.length();i++){JSONObject old=files.getJSONObject(i);String sourceId=old.getString("id"),id=UUID.randomUUID().toString();File target=AttachmentsPlugin.file(getContext(),id),meta=new File(target.getParentFile(),id+".json");created.add(target);created.add(meta);try(InputStream in=new FileInputStream(new File(root,sourceId));FileOutputStream out=new FileOutputStream(target)){copy(in,out,MAX_FILE);out.getFD().sync();}JSObject item=JSObject.fromJSONObject(old);item.remove("sha256");item.put("id",id);item.put("storage","android");try(FileOutputStream out=new FileOutputStream(meta)){out.write(item.toString().getBytes(StandardCharsets.UTF_8));out.getFD().sync();}item.put("sourceId",sourceId);mapped.put(item);}JSObject response=new JSObject();response.put("files",mapped);call.resolve(response);}catch(Exception e){for(File file:created)file.delete();call.reject("자료를 복원하지 못했습니다. 여유 공간을 확인하세요.");}finally{busy=false;}});
    }
    @PluginMethod public void discardArchive(PluginCall call) {worker.execute(()->{String token=call.getString("token");File root=token==null?null:imports.remove(token);remove(root);call.resolve();});}
}
