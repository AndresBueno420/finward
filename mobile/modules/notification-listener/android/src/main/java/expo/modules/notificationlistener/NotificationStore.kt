package expo.modules.notificationlistener

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object NotificationStore {

    private const val PREFS_NAME = "finward_notifications"
    private const val KEY_NOTIFICATIONS = "notifications"
    private const val MAX_SIZE = 200

    fun save(context: Context, packageName: String, title: String, text: String, timestamp: Long) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = JSONArray(prefs.getString(KEY_NOTIFICATIONS, "[]") ?: "[]")

        val entry = JSONObject().apply {
            put("packageName", packageName)
            put("title", title)
            put("text", text)
            put("timestamp", timestamp)
        }

        // Prepend newest first, cap at MAX_SIZE
        val updated = JSONArray()
        updated.put(entry)
        val limit = minOf(existing.length(), MAX_SIZE - 1)
        for (i in 0 until limit) {
            updated.put(existing.getJSONObject(i))
        }

        prefs.edit().putString(KEY_NOTIFICATIONS, updated.toString()).apply()
    }

    fun getAll(context: Context): List<Map<String, Any>> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = JSONArray(prefs.getString(KEY_NOTIFICATIONS, "[]") ?: "[]")
        return (0 until json.length()).map { i ->
            val obj = json.getJSONObject(i)
            mapOf(
                "packageName" to obj.optString("packageName"),
                "title" to obj.optString("title"),
                "text" to obj.optString("text"),
                "timestamp" to obj.optLong("timestamp", 0L),
            )
        }
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove(KEY_NOTIFICATIONS).apply()
    }
}
