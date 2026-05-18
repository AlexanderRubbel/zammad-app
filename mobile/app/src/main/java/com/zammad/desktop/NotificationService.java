package com.zammad.desktop;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.webkit.CookieManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class NotificationService extends Service {

    private static final int FG_ID = 1;
    private static final int ALERT_ID = 2;
    private static final String CH_SVC = "svc";
    private static final String CH_ALERT = "alert";
    private static final String CH_ALERT_SILENT = "alert_silent";

    private Thread worker;
    private volatile boolean running = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForegroundSafe(buildServiceNotification("Überwacht Zammad-Benachrichtigungen"));

        // Restart the polling loop with current settings.
        running = false;
        if (worker != null) worker.interrupt();
        running = true;
        worker = new Thread(this::loop, "zammad-poll");
        worker.start();
        return START_STICKY;
    }

    private void loop() {
        SharedPreferences sp = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE);
        String base = sp.getString(MainActivity.KEY_URL, MainActivity.DEFAULT_URL);
        int interval = Math.max(10, sp.getInt(MainActivity.KEY_INTERVAL, 30));
        int last = sp.getInt("lastCount", 0);

        while (running && !Thread.currentThread().isInterrupted()) {
            base = sp.getString(MainActivity.KEY_URL, "");
            if (base == null || base.trim().isEmpty()) {
                updateServiceNotification("Keine Zammad-Adresse konfiguriert");
                try { Thread.sleep(interval * 1000L); } catch (InterruptedException e) { break; }
                continue;
            }
            int count = fetchUnread(base);
            if (count >= 0) {
                if (count > last) {
                    boolean sound = sp.getBoolean(MainActivity.KEY_SOUND, true);
                    notifyNew(count, count - last, sound, base);
                }
                if (count != last) {
                    last = count;
                    sp.edit().putInt("lastCount", last).apply();
                }
                updateServiceNotification(count > 0
                        ? count + " ungelesen — Zammad wird überwacht"
                        : "Keine neuen — Zammad wird überwacht");
            }
            try {
                Thread.sleep(interval * 1000L);
            } catch (InterruptedException e) {
                break;
            }
        }
    }

    /** @return unread count, or -1 if unavailable (not logged in / error). */
    private int fetchUnread(String base) {
        HttpURLConnection c = null;
        try {
            URL url = new URL(base.replaceAll("/+$", "") + "/api/v1/online_notifications");
            String cookie = CookieManager.getInstance().getCookie(base);
            c = (HttpURLConnection) url.openConnection();
            c.setRequestMethod("GET");
            c.setConnectTimeout(15000);
            c.setReadTimeout(15000);
            c.setRequestProperty("Accept", "application/json");
            if (cookie != null) c.setRequestProperty("Cookie", cookie);
            int code = c.getResponseCode();
            if (code != 200) return -1;

            StringBuilder sb = new StringBuilder();
            BufferedReader br = new BufferedReader(
                    new InputStreamReader(c.getInputStream(), "UTF-8"));
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();

            String body = sb.toString().trim();
            JSONArray list = null;
            if (body.startsWith("[")) {
                list = new JSONArray(body);
            } else if (body.startsWith("{")) {
                JSONObject o = new JSONObject(body);
                if (o.has("online_notifications")) {
                    list = o.getJSONArray("online_notifications");
                }
            }
            if (list == null) return -1;

            int unseen = 0;
            for (int i = 0; i < list.length(); i++) {
                JSONObject n = list.optJSONObject(i);
                if (n != null && !n.optBoolean("seen", true)) unseen++;
            }
            return unseen;
        } catch (Exception e) {
            return -1;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private PendingIntent openAppIntent() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flag = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flag |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 0, i, flag);
    }

    private void notifyNew(int total, int delta, boolean sound, String base) {
        String channel = sound ? CH_ALERT : CH_ALERT_SILENT;
        Notification.Builder b = new Notification.Builder(this);
        if (Build.VERSION.SDK_INT >= 26) b = new Notification.Builder(this, channel);
        b.setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle("Zammad")
            .setContentText(delta == 1
                    ? "Eine neue Benachrichtigung"
                    : total + " ungelesene Benachrichtigungen")
            .setAutoCancel(true)
            .setContentIntent(openAppIntent());
        if (Build.VERSION.SDK_INT < 26 && sound) {
            b.setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);
        }
        nm().notify(ALERT_ID, b.build());
    }

    private Notification buildServiceNotification(String text) {
        Notification.Builder b = new Notification.Builder(this);
        if (Build.VERSION.SDK_INT >= 26) b = new Notification.Builder(this, CH_SVC);
        return b.setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Zammad")
            .setContentText(text)
            .setOngoing(true)
            .setContentIntent(openAppIntent())
            .build();
    }

    private void updateServiceNotification(String text) {
        nm().notify(FG_ID, buildServiceNotification(text));
    }

    private void startForegroundSafe(Notification n) {
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(FG_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(FG_ID, n);
        }
    }

    private NotificationManager nm() {
        return (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager m = nm();
        NotificationChannel svc = new NotificationChannel(
                CH_SVC, "Hintergrunddienst", NotificationManager.IMPORTANCE_LOW);
        svc.setShowBadge(false);
        NotificationChannel al = new NotificationChannel(
                CH_ALERT, "Benachrichtigungen", NotificationManager.IMPORTANCE_HIGH);
        NotificationChannel als = new NotificationChannel(
                CH_ALERT_SILENT, "Benachrichtigungen (lautlos)",
                NotificationManager.IMPORTANCE_HIGH);
        als.setSound(null, null);
        m.createNotificationChannel(svc);
        m.createNotificationChannel(al);
        m.createNotificationChannel(als);
    }

    @Override
    public void onDestroy() {
        running = false;
        if (worker != null) worker.interrupt();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
