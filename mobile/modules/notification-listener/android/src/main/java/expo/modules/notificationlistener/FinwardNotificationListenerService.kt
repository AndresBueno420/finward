package expo.modules.notificationlistener

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class FinwardNotificationListenerService : NotificationListenerService() {

  companion object {
    // Weak coupling: the Expo Module registers itself here on creation.
    // Null when the JS side hasn't loaded yet, so notifications are silently
    // dropped (acceptable — the app must be open to display them).
    @Volatile
    var module: NotificationListenerModule? = null
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val extras = sbn.notification.extras
    val title = extras.getString("android.title") ?: ""
    val text = extras.getCharSequence("android.text")?.toString() ?: ""
    module?.sendNotification(title, text, sbn.packageName)
  }
}
