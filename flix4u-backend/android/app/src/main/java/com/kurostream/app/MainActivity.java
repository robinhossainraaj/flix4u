package com.flix4u.rorax;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    private View customFullscreenView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private FrameLayout fullscreenContainer;
    private int originalOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (window != null) {
            WindowCompat.setDecorFitsSystemWindows(window, false);
            WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(window, window.getDecorView());
            if (controller != null) {
                controller.setAppearanceLightStatusBars(false);
                controller.setAppearanceLightNavigationBars(false);
            }
        }

        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(Color.parseColor("#08090d"));
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
                Insets barsAndCutout = windowInsets.getInsets(
                        WindowInsetsCompat.Type.systemBars()
                                | WindowInsetsCompat.Type.displayCutout()
                                | WindowInsetsCompat.Type.ime()
                );
                view.setPadding(
                        barsAndCutout.left,
                        barsAndCutout.top,
                        barsAndCutout.right,
                        barsAndCutout.bottom
                );
                return WindowInsetsCompat.CONSUMED;
            });
            ViewCompat.requestApplyInsets(contentView);
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setBackgroundColor(Color.parseColor("#08090d"));

            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, true);

            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setJavaScriptCanOpenWindowsAutomatically(false);
            settings.setSupportMultipleWindows(true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setAllowFileAccess(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

            webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                @Override
                public void onShowCustomView(View view, CustomViewCallback callback) {
                    showFullscreenCustomView(view, callback);
                }

                @Override
                public void onHideCustomView() {
                    hideFullscreenCustomView();
                }

                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    // Block pop-ups / ad redirects inside embed players from hijacking the app WebView
                    return false;
                }
            });

            getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (request == null || request.getUrl() == null) {
                        return false;
                    }
                    Uri url = request.getUrl();
                    String scheme = url.getScheme() != null ? url.getScheme().toLowerCase() : "";
                    if (request.isForMainFrame()) {
                        String host = url.getHost() != null ? url.getHost().toLowerCase() : "";
                        if (host.equals("facebook.com") || host.endsWith(".facebook.com") || host.equals("fb.com") || host.endsWith(".fb.com")) {
                            try {
                                Intent intent = new Intent(Intent.ACTION_VIEW, url);
                                startActivity(intent);
                                return true;
                            } catch (Exception ignored) {
                            }
                        }
                    }
                    if (!request.isForMainFrame()) {
                        if ("http".equals(scheme)
                                || "https".equals(scheme)
                                || "blob".equals(scheme)
                                || "data".equals(scheme)
                                || "about".equals(scheme)) {
                            return false;
                        }
                        return true;
                    }
                    if (!"http".equals(scheme)
                            && !"https".equals(scheme)
                            && !"capacitor".equals(scheme)
                            && !"file".equals(scheme)) {
                        return true;
                    }
                    return super.shouldOverrideUrlLoading(view, request);
                }
            });
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (customFullscreenView != null) {
                    hideFullscreenCustomView();
                    return;
                }
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
    }

    private void showFullscreenCustomView(View view, WebChromeClient.CustomViewCallback callback) {
        if (view == null) return;
        if (customFullscreenView != null) {
            if (callback != null) {
                try {
                    callback.onCustomViewHidden();
                } catch (Exception ignored) {
                }
            }
            return;
        }

        Window window = getWindow();
        View decorView = window != null ? window.getDecorView() : null;
        if (!(decorView instanceof ViewGroup)) {
            if (callback != null) {
                try {
                    callback.onCustomViewHidden();
                } catch (Exception ignored) {
                }
            }
            return;
        }

        originalOrientation = getRequestedOrientation();
        customFullscreenView = view;
        customViewCallback = callback;

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.BLACK);
        container.setClickable(true);
        container.addView(
                view,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );
        fullscreenContainer = container;

        ((ViewGroup) decorView).addView(
                container,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
    }

    private void hideFullscreenCustomView() {
        if (customFullscreenView == null && fullscreenContainer == null) {
            return;
        }

        Window window = getWindow();
        View decorView = window != null ? window.getDecorView() : null;
        if (decorView instanceof ViewGroup && fullscreenContainer != null) {
            ((ViewGroup) decorView).removeView(fullscreenContainer);
        }

        WebChromeClient.CustomViewCallback callback = customViewCallback;
        customViewCallback = null;
        customFullscreenView = null;
        fullscreenContainer = null;

        if (callback != null) {
            try {
                callback.onCustomViewHidden();
            } catch (Exception ignored) {
            }
        }

        if (window != null) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (decorView != null) {
                WindowInsetsControllerCompat controller =
                        WindowCompat.getInsetsController(window, decorView);
                if (controller != null) {
                    controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_DEFAULT);
                    controller.show(WindowInsetsCompat.Type.systemBars());
                }
            }
        }
        setRequestedOrientation(originalOrientation);
    }

    @Override
    public void onDestroy() {
        hideFullscreenCustomView();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
                && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge() != null ? getBridge().getPlugin("SocialLogin") : null;
            if (pluginHandle != null) {
                Plugin plugin = pluginHandle.getInstance();
                if (plugin instanceof SocialLoginPlugin) {
                    ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
                }
            }
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Required marker interface for @capgo/capacitor-social-login Google authorization routing
    }
}
