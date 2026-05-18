package com.zammad.desktop;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.PopupMenu;
import android.app.AlertDialog;

public class MainActivity extends Activity {

    public static final String PREFS = "zammad";
    public static final String KEY_URL = "url";
    public static final String KEY_INTERVAL = "interval";
    public static final String KEY_SOUND = "sound";
    public static final String DEFAULT_URL = "https://cure-mannheim.zammad.com";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private static final int REQ_FILE = 1001;
    private static final int REQ_NOTIF = 1002;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!sp.contains(KEY_URL)) {
            sp.edit()
                .putString(KEY_URL, DEFAULT_URL)
                .putInt(KEY_INTERVAL, 30)
                .putBoolean(KEY_SOUND, true)
                .apply();
        }

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        // Small overflow button (no action bar in this theme).
        Button menu = new Button(this);
        menu.setText("⋮");
        menu.setTextColor(Color.WHITE);
        menu.setBackgroundColor(Color.argb(120, 31, 122, 140));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(130, 130);
        lp.gravity = Gravity.TOP | Gravity.END;
        lp.topMargin = 14;
        lp.rightMargin = 14;
        menu.setOnClickListener(v -> showMenu(menu));
        root.addView(menu, lp);

        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false);
        // Clean Chrome UA WITHOUT the "; wv" token, so Google SSO does not
        // reject the login as an embedded webview.
        s.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36");

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String u = r.getUrl().toString();
                if (u.startsWith("http://") || u.startsWith("https://")) {
                    return false; // keep in app (incl. Google OAuth)
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u)));
                } catch (Exception ignored) {}
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                CookieManager.getInstance().flush();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v,
                    ValueCallback<Uri[]> cb, FileChooserParams params) {
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "Datei"), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState == null) {
            web.loadUrl(sp.getString(KEY_URL, DEFAULT_URL));
        } else {
            web.restoreState(savedInstanceState);
        }

        requestNotificationPermission();
        ServiceControl.start(this);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(
                    new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIF);
            }
        }
    }

    private void showMenu(View anchor) {
        PopupMenu pm = new PopupMenu(this, anchor);
        pm.getMenu().add(0, 1, 0, "Neu laden");
        pm.getMenu().add(0, 2, 1, "Einstellungen");
        SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        boolean sound = sp.getBoolean(KEY_SOUND, true);
        pm.getMenu().add(0, 3, 2, sound ? "Ton: an" : "Ton: aus");
        pm.getMenu().add(0, 4, 3, "Hintergrunddienst neu starten");
        pm.setOnMenuItemClickListener(item -> {
            switch (item.getItemId()) {
                case 1:
                    web.reload();
                    return true;
                case 2:
                    showSettings();
                    return true;
                case 3:
                    sp.edit().putBoolean(KEY_SOUND, !sound).apply();
                    ServiceControl.start(this);
                    return true;
                case 4:
                    ServiceControl.start(this);
                    return true;
            }
            return false;
        });
        pm.show();
    }

    private void showSettings() {
        final SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        final EditText urlIn = new EditText(this);
        urlIn.setHint("https://deinefirma.zammad.com");
        urlIn.setText(sp.getString(KEY_URL, DEFAULT_URL));
        urlIn.setInputType(InputType.TYPE_TEXT_VARIATION_URI);

        final EditText intIn = new EditText(this);
        intIn.setHint("Intervall in Sekunden (min. 10)");
        intIn.setText(String.valueOf(sp.getInt(KEY_INTERVAL, 30)));
        intIn.setInputType(InputType.TYPE_CLASS_NUMBER);

        FrameLayout box = new FrameLayout(this);
        android.widget.LinearLayout col = new android.widget.LinearLayout(this);
        col.setOrientation(android.widget.LinearLayout.VERTICAL);
        int pad = 40;
        col.setPadding(pad, pad, pad, 0);
        col.addView(urlIn);
        col.addView(intIn);
        box.addView(col);

        new AlertDialog.Builder(this)
            .setTitle("Einstellungen")
            .setView(box)
            .setPositiveButton("Speichern", (d, w) -> {
                String url = urlIn.getText().toString().trim();
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    url = "https://" + url;
                }
                int iv;
                try {
                    iv = Math.max(10, Integer.parseInt(intIn.getText().toString().trim()));
                } catch (Exception e) {
                    iv = 30;
                }
                sp.edit().putString(KEY_URL, url).putInt(KEY_INTERVAL, iv).apply();
                web.loadUrl(url);
                ServiceControl.start(this);
            })
            .setNegativeButton("Abbrechen", null)
            .show();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE) {
            if (fileCallback == null) return;
            Uri[] result = null;
            if (res == Activity.RESULT_OK && data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }
}
