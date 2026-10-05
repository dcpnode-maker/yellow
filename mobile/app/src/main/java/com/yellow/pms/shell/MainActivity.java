package com.yellow.pms.shell;

import android.Manifest;
import android.app.Activity;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Arrays;

public final class MainActivity extends Activity {
    private static final int MICROPHONE_PERMISSION_REQUEST = 1001;
    private WebView webView;
    private PermissionRequest pendingMicrophoneRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(createContent());

        Uri configured = Uri.parse(BuildConfig.YELLOW_PUBLIC_URL);
        if ("demo.invalid".equals(configured.getHost())) {
            showConfigurationBoundary();
        } else {
            webView.loadUrl(configured.toString());
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private LinearLayout createContent() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        TextView banner = new TextView(this);
        banner.setText(R.string.demo_banner);
        banner.setTextColor(Color.WHITE);
        banner.setBackgroundColor(Color.rgb(17, 24, 39));
        banner.setGravity(Gravity.CENTER);
        banner.setTextSize(12);
        int padding = Math.round(10 * getResources().getDisplayMetrics().density);
        banner.setPadding(padding, padding, padding, padding);
        root.addView(banner, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri destination = request.getUrl();
                if (isApprovedOrigin(destination)) {
                    return false;
                }
                Toast.makeText(MainActivity.this, "Navigation outside Yellow was blocked", Toast.LENGTH_SHORT).show();
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingMicrophoneRequest == request) {
                    pendingMicrophoneRequest = null;
                }
            }
        });

        root.addView(webView, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f
        ));
        return root;
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        boolean microphoneOnly = Arrays.equals(
            request.getResources(),
            new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE}
        );
        if (!microphoneOnly || !isApprovedOrigin(request.getOrigin())) {
            request.deny();
            return;
        }

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            return;
        }

        if (pendingMicrophoneRequest != null) {
            pendingMicrophoneRequest.deny();
        }
        pendingMicrophoneRequest = request;
        requestPermissions(
            new String[]{Manifest.permission.RECORD_AUDIO},
            MICROPHONE_PERMISSION_REQUEST
        );
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != MICROPHONE_PERMISSION_REQUEST) {
            return;
        }
        PermissionRequest request = pendingMicrophoneRequest;
        pendingMicrophoneRequest = null;
        if (request == null) {
            return;
        }
        boolean granted = grantResults.length == 1
            && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            request.deny();
        }
    }

    private boolean isApprovedOrigin(Uri candidate) {
        Uri approved = Uri.parse(BuildConfig.YELLOW_PUBLIC_URL);
        return "https".equalsIgnoreCase(candidate.getScheme())
            && equalsIgnoreCase(approved.getHost(), candidate.getHost())
            && effectivePort(approved) == effectivePort(candidate);
    }

    private static boolean equalsIgnoreCase(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right);
    }

    private static int effectivePort(Uri uri) {
        return uri.getPort() == -1 ? 443 : uri.getPort();
    }

    private void showConfigurationBoundary() {
        String html = "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"
            + "<style>body{font:16px system-ui;margin:0;padding:32px;color:#111827;background:#fff8df}"
            + "h1{font-size:24px}code{display:block;padding:12px;background:#111827;color:white;overflow-wrap:anywhere}</style>"
            + "<h1>" + getString(R.string.configure_title) + "</h1>"
            + "<p>" + getString(R.string.configure_body) + "</p>"
            + "<p>This APK is a demonstration wrapper, not a standalone PMS and not a production release.</p>";
        webView.loadDataWithBaseURL("https://demo.invalid/", html, "text/html", "UTF-8", null);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (pendingMicrophoneRequest != null) {
            pendingMicrophoneRequest.deny();
            pendingMicrophoneRequest = null;
        }
        webView.stopLoading();
        webView.setWebChromeClient(null);
        webView.setWebViewClient(null);
        webView.destroy();
        super.onDestroy();
    }
}
