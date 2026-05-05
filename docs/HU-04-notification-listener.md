# HU-04: Capturar Notificaciones Bancarias

## Resumen

Implementación de un módulo nativo Android (Kotlin) que intercepta las notificaciones del sistema operativo y las transmite a la capa de JavaScript/React Native mediante la Expo Modules API. Incluye manejo del permiso especial de acceso a notificaciones y una pantalla de Dashboard que muestra en tiempo real las notificaciones recibidas.

---

## Contexto técnico: por qué no se puede usar Expo Go

Expo Go es un cliente genérico que solo soporta módulos nativos incluidos en su build. Al introducir código Kotlin personalizado (`NotificationListenerService`), el proyecto requiere un **Dev Build** propio compilado con ese código incluido. La solución es hacer un **prebuild** del proyecto para generar la carpeta `android/` y luego instalar la APK directamente en el dispositivo con `npx expo run:android`.

---

## Arquitectura de la solución

```
[Android OS: notificación nueva]
        │
        ▼ onNotificationPosted()
[FinwardNotificationListenerService.kt]
        │ module?.sendNotification(title, text, pkg)
        ▼
[NotificationListenerModule.kt]          ← Expo Module (puente Kotlin ↔ JS)
        │ sendEvent("onNotificationReceived", payload)
        ▼
[expo-modules-core EventEmitter]         ← capa de bridging JS/Kotlin
        │ dispara suscriptor JS
        ▼
[addNotificationListener callback]
        │ setState
        ▼
[DashboardScreen.tsx → FlatList]
```

El `NotificationListenerModule` y el `FinwardNotificationListenerService` se comunican mediante una **referencia estática `@Volatile`**. El módulo se registra a sí mismo en `OnCreate` y se limpia en `OnDestroy`. El campo `@Volatile` garantiza visibilidad entre hilos (el sistema operativo ejecuta `onNotificationPosted` en un hilo distinto al del módulo).

---

## Archivos creados o modificados

### Nuevos archivos

#### `frontend/modules/notification-listener/package.json`

```json
{
  "name": "notification-listener",
  "version": "1.0.0",
  "description": "Native notification listener module for FinWard",
  "main": "index.ts",
  "peerDependencies": {
    "expo-modules-core": "*"
  }
}
```

Hace al módulo descubrible por `expo-modules-autolinking`. El campo `main` apunta directamente a `index.ts` porque Metro (el bundler de React Native) puede consumir TypeScript sin compilación previa.

---

#### `frontend/modules/notification-listener/index.ts`

La API pública que consume el código JS/TS de la aplicación. Usa tres primitivas de `expo-modules-core`:

- **`requireNativeModule`**: obtiene la instancia del módulo Kotlin registrado con el nombre `"NotificationListener"`.
- **`EventEmitter`**: envuelve el módulo nativo para suscribirse a sus eventos con `addListener`.
- **`NativeModule`**: tipo base que une los genéricos de TypeScript con la API de eventos.

Exporta tres funciones:

| Función | Descripción |
|---------|-------------|
| `isNotificationServiceEnabled()` | Llama sincrónicamente al módulo Kotlin; devuelve `true` si el servicio está activo en Settings. |
| `openNotificationSettings()` | Abre la pantalla de Android *Acceso a notificaciones*. |
| `addNotificationListener(fn)` | Suscribe un callback a `onNotificationReceived`; devuelve un objeto con `.remove()`. |

---

#### `frontend/modules/notification-listener/android/build.gradle`

```gradle
apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'
apply plugin: 'expo-module-gradle-plugin'

android {
  namespace "expo.modules.notificationlistener"
  compileSdkVersion safeExtGet("compileSdkVersion", 35)
  ...
}
```

El plugin `expo-module-gradle-plugin` es el punto clave: genera automáticamente el `ExpoModulesProvider.kt` durante el prebuild, que registra `NotificationListenerModule` en el sistema de módulos de React Native sin necesidad de editar ningún archivo de registro manualmente.

---

#### `frontend/modules/notification-listener/android/src/main/AndroidManifest.xml`

Declara dos cosas que se mergean con el `AndroidManifest.xml` principal de la app durante el prebuild:

1. **Permiso**: `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE`
2. **Servicio**: `FinwardNotificationListenerService` con el intent-filter `android.service.notification.NotificationListenerService`

```xml
<service
  android:name=".FinwardNotificationListenerService"
  android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
  android:exported="true">
  <intent-filter>
    <action android:name="android.service.notification.NotificationListenerService" />
  </intent-filter>
</service>
```

El `.` al inicio del `android:name` es una referencia relativa; se resuelve al nombre completo `expo.modules.notificationlistener.FinwardNotificationListenerService` usando el `namespace` definido en `build.gradle`.

---

#### `frontend/modules/notification-listener/android/src/main/java/expo/modules/notificationlistener/NotificationListenerModule.kt`

El puente Kotlin ↔ JavaScript. Extiende `Module` de `expo-modules-core`.

```kotlin
class NotificationListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NotificationListener")          // nombre con el que JS lo requiere
    Events("onNotificationReceived")      // eventos que puede emitir al JS

    OnCreate { FinwardNotificationListenerService.module = this@NotificationListenerModule }
    OnDestroy { FinwardNotificationListenerService.module = null }

    Function("isNotificationServiceEnabled") { /* lee Settings.Secure */ }
    Function("openNotificationSettings") { /* Intent a Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS */ }
  }

  fun sendNotification(title: String, text: String, packageName: String) {
    sendEvent("onNotificationReceived", mapOf(...))
  }
}
```

Decisiones de diseño:

- **`Function` (no `AsyncFunction`)**: ambas operaciones son síncronas (lectura de `Settings.Secure` e inicio de `Activity`) y no bloquean el hilo principal de forma significativa.
- **`appContext.currentActivity`** para `startActivity`: evita necesitar el flag `FLAG_ACTIVITY_NEW_TASK` que sería necesario con un `Context` genérico.
- **`OnCreate`/`OnDestroy`** en el DSL del módulo: garantizan que la referencia estática al servicio se gestiona dentro del ciclo de vida del módulo de Expo, no del constructor (que podría ejecutarse fuera del contexto de React Native).

---

#### `frontend/modules/notification-listener/android/src/main/java/expo/modules/notificationlistener/FinwardNotificationListenerService.kt`

El `NotificationListenerService` real que Android instancia cuando el usuario otorga el permiso.

```kotlin
class FinwardNotificationListenerService : NotificationListenerService() {
  companion object {
    @Volatile
    var module: NotificationListenerModule? = null
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val title = extras.getString("android.title") ?: ""
    val text  = extras.getCharSequence("android.text")?.toString() ?: ""
    module?.sendNotification(title, text, sbn.packageName)
  }
}
```

- **`@Volatile`**: el sistema operativo puede llamar a `onNotificationPosted` desde un hilo de fondo. `@Volatile` asegura que todos los hilos leen el valor más reciente de `module` desde la memoria principal.
- **`module?.sendNotification`**: el operador `?.` descarta silenciosamente las notificaciones cuando la app no tiene el módulo cargado (app en background). Esto es el comportamiento correcto para la fase actual del producto.
- Las claves `"android.title"` y `"android.text"` son las keys estándar del Bundle de extras de `Notification` desde API 19.

---

### Archivos modificados

#### `frontend/package.json`

Agregada la dependencia local:

```json
"notification-listener": "file:./modules/notification-listener"
```

`npm install` creará un enlace simbólico en `node_modules/notification-listener/` que apunta al módulo local. El autolinking de Expo descubre el módulo desde `node_modules/` durante el prebuild.

---

#### `frontend/app.json`

Agregado `android.package`:

```json
"android": {
  "package": "com.finward.app",
  ...
}
```

Este campo es **obligatorio** para que `npx expo prebuild` pueda generar el `AndroidManifest.xml` principal con el `applicationId` correcto. Sin él, el prebuild falla o solicita el dato de forma interactiva.

---

#### `frontend/src/screens/DashboardScreen.tsx`

Reescritura completa. La pantalla maneja tres estados:

| Estado | Condición | Render |
|--------|-----------|--------|
| Cargando | `hasPermission === null` | Texto "Verificando permisos..." |
| Sin permiso | `hasPermission === false` | Botón "Conceder acceso" → abre Settings |
| Con permiso | `hasPermission === true` | Lista de notificaciones interceptadas |

**Lógica de permisos:**

```tsx
// Comprueba al montar y cada vez que la app vuelve al frente
useEffect(() => {
  checkPermission();
  const sub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') checkPermission();
  });
  return () => sub.remove();
}, [checkPermission]);
```

El listener de `AppState` es necesario porque el usuario sale de la app para activar el permiso en Settings. Cuando vuelve, `AppState` cambia a `'active'` y la comprobación se re-ejecuta.

**Lógica de suscripción a notificaciones:**

```tsx
useEffect(() => {
  if (!hasPermission) return;
  const sub = addNotificationListener((event) => {
    setNotifications((prev) => [event, ...prev].slice(0, 50));
  });
  return () => sub.remove();
}, [hasPermission]);
```

El `slice(0, 50)` limita la lista a las 50 notificaciones más recientes para evitar uso excesivo de memoria. El cleanup `sub.remove()` evita leaks cuando el componente se desmonta o el permiso se revoca.

---

## Por qué el permiso no usa `requestPermissions()`

`BIND_NOTIFICATION_LISTENER_SERVICE` es un **permiso de firma del sistema** (`signatureOrSystem`). Android no permite que las apps lo soliciten en tiempo de ejecución vía el diálogo estándar de permisos. La única forma de obtenerlo es que el usuario lo active manualmente en:

**Configuración → Aplicaciones → Acceso especial a aplicaciones → Acceso a notificaciones → [activar FinWard]**

El botón en el Dashboard abre exactamente esa pantalla usando `Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`.

---

## Comandos para compilar y probar en dispositivo físico

```bash
# Desde el directorio frontend/

# 1. Instalar la dependencia local del módulo
npm install

# 2. Generar el proyecto Android nativo
#    Crea android/ con todo el código Kotlin integrado y el manifest mergeado
npx expo prebuild --platform android --clean

# 3. Verificar que el dispositivo físico está conectado por USB
#    (requiere "Depuración USB" activa en Opciones de desarrollador)
adb devices

# 4. Compilar e instalar en el dispositivo
npx expo run:android --device
```

**Requisito previo:** Android SDK instalado con `ANDROID_HOME` configurado (normalmente `C:\Users\<usuario>\AppData\Local\Android\Sdk` si usas Android Studio).

---

## Flujo de prueba

1. Abrir la app → Dashboard muestra "Permiso requerido"
2. Pulsar **"Conceder acceso"** → Android abre la pantalla de Acceso a notificaciones
3. Activar **FinWard** en esa pantalla → volver a la app
4. Dashboard detecta el retorno (`AppState active`) y comprueba el permiso → cambia a "Esperando notificaciones..."
5. Recibir cualquier notificación en el dispositivo (SMS, banco, WhatsApp, etc.)
6. La notificación aparece en la lista con su **Título**, **Texto** y **nombre del paquete** (ej. `com.bancolombia.app`)
