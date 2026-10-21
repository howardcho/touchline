package com.agedskaters.touchline;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;

/** A single trusted offline origin hosts the same UI as the web/iPad versions. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String HOME = ORIGIN + "/assets/index.html";
    private final Handler main = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private WebView web;
    private DuckingAudio audio;
    private boolean active, wantsAwake, wantsFullscreen;
    private int insetLeft=-1,insetTop=-1,insetRight=-1,insetBottom=-1;
    private LinearLayout errorView;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setVolumeControlStream(android.media.AudioManager.STREAM_MUSIC);
        if(Build.VERSION.SDK_INT>=27)getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(244,243,235));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view,insets) -> {
            // The clock draws behind system bars; keep only its controls clear of cutouts.
            int left=0,top=0,right=0,bottom=0,ime=0;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(wantsFullscreen ? WindowInsets.Type.displayCutout() :
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                left=safe.left;top=safe.top;right=safe.right;bottom=safe.bottom;
                ime=insets.getInsets(WindowInsets.Type.ime()).bottom;
            } else {
                if(wantsFullscreen && Build.VERSION.SDK_INT>=28 && insets.getDisplayCutout()!=null) {
                    android.view.DisplayCutout cutout=insets.getDisplayCutout();
                    left=cutout.getSafeInsetLeft();top=cutout.getSafeInsetTop();
                    right=cutout.getSafeInsetRight();bottom=cutout.getSafeInsetBottom();
                } else if(!wantsFullscreen) {
                    left=insets.getSystemWindowInsetLeft();top=insets.getSystemWindowInsetTop();
                    right=insets.getSystemWindowInsetRight();bottom=insets.getSystemWindowInsetBottom();
                }
            }
            root.setPadding(wantsFullscreen?0:left,wantsFullscreen?0:top,wantsFullscreen?0:right,wantsFullscreen?ime:bottom);
            updateWebInsets(wantsFullscreen?left:0,wantsFullscreen?top:0,wantsFullscreen?right:0,wantsFullscreen?bottom:0);
            return insets;
        });
        audio = new DuckingAudio(this, this::audioError);
        createWebView();
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::navigateBack);
        }
    }

    @android.annotation.SuppressLint("SetJavaScriptEnabled") // Only the packaged, offline app can load.
    private void createWebView() {
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(244,243,235));
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        // Only packaged resources are served, with no INTERNET permission or remote frames.
        web.addJavascriptInterface(new HostBridge(), "TouchlineAndroid");
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                Log.d("Touchline", message.message() + " (" + message.lineNumber() + ")");
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();
                if (!isLocal(uri) || !"GET".equals(request.getMethod()) || path == null ||
                    path.contains("..") || path.contains("\\") || path.indexOf('\0') >= 0) return blocked(403,"Forbidden");
                String asset = path.substring("/assets/".length());
                String mime = asset.endsWith(".js") ? "application/javascript" :
                    asset.endsWith(".webmanifest") ? "application/manifest+json" :
                    asset.endsWith(".svg") ? "image/svg+xml" : URLConnection.guessContentTypeFromName(asset);
                if (mime == null) mime = "application/octet-stream";
                try {
                    return new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "UTF-8" : null,
                        getAssets().open(asset));
                } catch (IOException error) { return blocked(404,"Not Found"); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (isLocal(request.getUrl())) return false;
                if (request.isForMainFrame() && request.hasGesture() &&
                    ("https".equals(request.getUrl().getScheme()) || "http".equals(request.getUrl().getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); }
                    catch (android.content.ActivityNotFoundException ignored) { }
                }
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showLoadError();
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                audio.stop(); root.removeView(web); web.destroy(); web=null;
                showLoadError(); return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript("JSON.stringify({ready:document.readyState,choices:document.querySelectorAll('[data-teams]').length,native:!!window.touchlineNative,viewport:[innerWidth,innerHeight],scroll:document.documentElement.scrollHeight,bodyPadding:getComputedStyle(document.body).padding,header:document.querySelector('header').getBoundingClientRect().toJSON(),timer:document.getElementById('timer').getBoundingClientRect().toJSON()})",result->Log.i("Touchline", "Offline page loaded: " + result));
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        web.loadUrl(HOME);
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) &&
            uri.getPort() == -1 && uri.getPath() != null && uri.getPath().startsWith("/assets/");
    }
    private static WebResourceResponse blocked(int status, String reason) {
        return new WebResourceResponse("text/plain","UTF-8",status,reason,java.util.Collections.emptyMap(),
            new ByteArrayInputStream(reason.getBytes(StandardCharsets.UTF_8)));
    }

    public final class HostBridge {
        @JavascriptInterface public String request(String raw) {
            try {
                JSONObject command = new JSONObject(raw);
                // JS interfaces run on WebView's bridge thread. Metadata never blocks the UI thread.
                if ("prepare".equals(command.optString("action"))) {
                    return new JSONObject().put("value",audio.prepare()).toString();
                }
                FutureTask<Object> task = new FutureTask<>(() -> {
                    if ("fullscreen".equals(command.optString("action"))) {
                        wantsFullscreen=command.optBoolean("enabled",false); applyWindowMode(); return null;
                    }
                    if ("keepAwake".equals(command.optString("action"))) {
                        wantsAwake=command.optBoolean("enabled",false); updateAwake(); return null;
                    }
                    if (!active && "play".equals(command.optString("action"))) throw new IllegalStateException("App is not visible");
                    audio.handle(command); return null;
                });
                main.post(task);
                Object result;
                try { result = task.get(5,TimeUnit.SECONDS); }
                catch (Exception error) { task.cancel(false); throw error; }
                return new JSONObject().put("value",result == null ? JSONObject.NULL : result).toString();
            } catch (Exception error) {
                Log.e("Touchline","Native request failed",error);
                return "{\"error\":\"Touchline could not complete the audio request.\"}";
            }
        }
    }
    private void applyWindowMode() {
        int color=wantsFullscreen?Color.rgb(24,59,48):Color.rgb(244,243,235);
        root.setBackgroundColor(color);
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(color));
        if(web!=null)web.setBackgroundColor(color);
        // Transparent system bars reveal the same surface during temporary edge swipes.
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if(Build.VERSION.SDK_INT>=29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        if(Build.VERSION.SDK_INT>=28) {
            WindowManager.LayoutParams attributes=getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode=wantsFullscreen?
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES:
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            getWindow().setAttributes(attributes);
        }
        if(Build.VERSION.SDK_INT>=30) {
            getWindow().setDecorFitsSystemWindows(false);
            android.view.WindowInsetsController controller=getWindow().getInsetsController();
            if(controller!=null) {
                int light=android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS |
                    android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(wantsFullscreen?0:light,light);
                controller.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if(wantsFullscreen)controller.hide(WindowInsets.Type.systemBars());
                else controller.show(WindowInsets.Type.systemBars());
            }
        } else {
            int flags=android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            if(wantsFullscreen)flags |= android.view.View.SYSTEM_UI_FLAG_FULLSCREEN |
                android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            else {
                flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if(Build.VERSION.SDK_INT>=27)flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
        // Reapply inset variables after a restored page or a mode change.
        insetLeft=insetTop=insetRight=insetBottom=-1;
        root.requestApplyInsets();
    }
    private void updateWebInsets(int left,int top,int right,int bottom) {
        if(web==null || (insetLeft==left&&insetTop==top&&insetRight==right&&insetBottom==bottom))return;
        insetLeft=left;insetTop=top;insetRight=right;insetBottom=bottom;
        web.evaluateJavascript("(()=>{const s=document.documentElement.style,d=devicePixelRatio||1;"+
            "s.setProperty('--safe-left',"+left+"/d+'px');s.setProperty('--safe-top',"+top+"/d+'px');"+
            "s.setProperty('--safe-right',"+right+"/d+'px');s.setProperty('--safe-bottom',"+bottom+"/d+'px');})()",null);
    }
    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if(hasFocus && root!=null)applyWindowMode();
    }
    private void audioError(String message) {
        Log.e("Touchline",message);
        if (web != null) web.evaluateJavascript("(()=>{const e=document.getElementById('sound-status');if(e)e.textContent=" + JSONObject.quote(message) + ";})()",null);
    }
    private void updateAwake() {
        if (active && wantsAwake) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    @Override protected void onResume() { super.onResume(); active=true; updateAwake(); applyWindowMode(); if(web!=null)web.onResume(); }
    @Override protected void onPause() {
        active=false; updateAwake(); audio.stop();
        if(web!=null)web.onPause(); super.onPause();
    }
    @Override protected void onDestroy() {
        audio.stop();
        if(web!=null){web.removeJavascriptInterface("TouchlineAndroid");root.removeView(web);web.destroy();web=null;}
        super.onDestroy();
    }
    @Override public void onBackPressed() { navigateBack(); }
    private void navigateBack() {
        if(web==null){finish();return;}
        web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}const b=document.getElementById('board');if(b&&!b.hidden){document.getElementById(b.classList.contains('clock-view')?'clock-view-toggle':'back-to-selection').click();return true;}return false;})()",
            result->{if("false".equals(result))finish();});
    }
    private void showLoadError() {
        if (errorView!=null) return;
        errorView=new LinearLayout(this); errorView.setOrientation(LinearLayout.VERTICAL); errorView.setGravity(Gravity.CENTER);
        errorView.setPadding(32,32,32,32); errorView.setBackgroundColor(Color.rgb(244,243,235));
        TextView text=new TextView(this); text.setText(R.string.load_error); text.setTextSize(18); text.setGravity(Gravity.CENTER);
        Button retry=new Button(this); retry.setText(R.string.retry); retry.setMinHeight(48);
        retry.setOnClickListener(v->{root.removeView(errorView);errorView=null;if(web==null)createWebView();else web.loadUrl(HOME);});
        errorView.addView(text);errorView.addView(retry);root.addView(errorView,new FrameLayout.LayoutParams(-1,-1));
    }
}
