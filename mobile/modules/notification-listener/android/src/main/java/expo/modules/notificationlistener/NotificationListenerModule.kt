package expo.modules.notificationlistener

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("NotificationListener")

    Events("onNotificationReceived")

    OnCreate {
      FinwardNotificationListenerService.module = this@NotificationListenerModule
    }

    OnDestroy {
      FinwardNotificationListenerService.module = null
    }

    Function("isNotificationServiceEnabled") {
      val context = appContext.reactContext
        ?: return@Function false
      val component = ComponentName(context, FinwardNotificationListenerService::class.java)
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners"
      )
      enabled?.contains(component.flattenToString()) == true
    }

    Function("openNotificationSettings") {
      appContext.currentActivity?.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      )
    }
  }

  fun sendNotification(title: String, text: String, packageName: String) {
    sendEvent(
      "onNotificationReceived",
      mapOf(
        "title" to title,
        "text" to text,
        "packageName" to packageName,
        "timestamp" to System.currentTimeMillis()
      )
    )
  }
}
