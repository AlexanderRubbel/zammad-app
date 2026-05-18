package com.zammad.desktop;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

final class ServiceControl {
    static void start(Context ctx) {
        Intent i = new Intent(ctx, NotificationService.class);
        if (Build.VERSION.SDK_INT >= 26) {
            ctx.startForegroundService(i);
        } else {
            ctx.startService(i);
        }
    }
}
