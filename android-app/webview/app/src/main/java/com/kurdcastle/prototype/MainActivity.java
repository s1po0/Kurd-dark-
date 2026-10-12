// -----------------------------------------------------------------------------
//  Kurd Castle — Android shell (WebView)
//  File: MainActivity.java
//
//  The game in this repository is a canvas/ES-module build, so the Android app
//  is a single Activity that serves the bundled web assets over an internal
//  https:// origin and hands them to a full-screen WebView. Consequences worth
//  knowing:
//
//    * the APK is completely self-contained and offline — the assets ship inside
//      it, and the app requests no permissions at all (not even INTERNET);
//    * assets are served through WebViewAssetLoader rather than file://, because
//      ES modules are blocked on the file: scheme (opaque origin);
//    * the back gesture pauses the match instead of quitting mid-siege.
// -----------------------------------------------------------------------------
package com.kurdcastle.prototype;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {

    /** Host name the assets are served from. Never resolved on the network. */
    private static final String LOCAL_HOST = "kurdcastle.local";
    private static final String START_URL = "https://" + LOCAL_HOST + "/assets/index.html";
    private static final int BOOT_COLOR = 0xFF14100D;

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // A siege battle is longer than the screen timeout, and the game never
        // wants the device to sleep mid-wave.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(LOCAL_HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(false);
        }

        web.setBackgroundColor(BOOT_COLOR);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setHorizontalScrollBarEnabled(false);
        web.setVerticalScrollBarEnabled(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse local = loader.shouldInterceptRequest(request.getUrl());
                if (local != null) return local;
                // Everything else (there should be nothing) stays unresolved: the
                // app holds no INTERNET permission and never talks to a server.
                return new WebResourceResponse("text/plain", "utf-8", null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Keep the game in-app: never hand a URL to the browser.
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient());

        setContentView(web);
        web.loadUrl(START_URL);
    }

    @Override
    public void onBackPressed() {
        // Back pauses the match (the HUD then offers Resume / Restart) instead of
        // killing the app in the middle of a wave. A second back press exits.
        if (web != null) {
            web.evaluateJavascript(
                    "(function(){try{var a=window.kurdCastle;if(a&&a.world){a.world.togglePause();" +
                    "return a.world.state;}return 'none';}catch(e){return 'error';}})()",
                    value -> {
                        if (value != null && value.contains("PAUSED")) return;
                        finish();
                    });
            return;
        }
        super.onBackPressed();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** Immersive full-screen: the game is meant to fill the device. */
    private void hideSystemBars() {
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            decor.getWindowInsetsController().hide(
                    android.view.WindowInsets.Type.systemBars());
            decor.getWindowInsetsController().setSystemBarsBehavior(
                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            decor.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) {
            web.onPause();
            // Leaving the app pauses the match so the castle does not fall while
            // the player is answering the phone.
            web.evaluateJavascript(
                    "(function(){try{var a=window.kurdCastle;if(a&&a.world&&a.world.state==='playing')" +
                    "a.world.togglePause();}catch(e){}})()", null);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        hideSystemBars();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
