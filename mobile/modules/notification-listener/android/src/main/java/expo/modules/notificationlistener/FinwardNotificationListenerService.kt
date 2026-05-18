package expo.modules.notificationlistener

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class FinwardNotificationListenerService : NotificationListenerService() {

  companion object {
    // Null when the JS module hasn't initialized (app closed). Notifications are
    // still persisted via NotificationStore so nothing is lost.
    @Volatile
    var module: NotificationListenerModule? = null
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val extras = sbn.notification.extras
    val title = extras.getString("android.title") ?: ""
    val text = extras.getCharSequence("android.text")?.toString() ?: ""
    val packageName = sbn.packageName
    val timestamp = System.currentTimeMillis()

    if (!NotificationFilter.shouldProcess(packageName, title, text)) return

    NotificationStore.save(applicationContext, packageName, title, text, timestamp)
    module?.sendNotification(title, text, packageName)
  }
}
