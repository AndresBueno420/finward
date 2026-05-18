# FinWard Mobile — Guía de Preparación para Entrevista

## ¿Qué construí?

Una **app móvil Android** en React Native + Expo con dos pantallas funcionales: login con JWT y un dashboard que escucha notificaciones bancarias en tiempo real. La parte más técnica es un **módulo nativo custom en Kotlin** que intercepta notificaciones del sistema operativo — algo que React Native puro no puede hacer.

---

## Stack tecnológico

| Tecnología | Rol |
|---|---|
| **React Native 0.81** | Framework para apps nativas con JS/TS |
| **Expo 54** | Toolchain: build, dev server, módulos |
| **TypeScript (strict)** | Tipado estático en todo el proyecto |
| **React Navigation v7** | Navegación entre pantallas (stack) |
| **AsyncStorage** | Persistencia local del JWT |
| **Expo Modules Core** | Bridge para módulos nativos custom |
| **Kotlin** | Módulo nativo Android (NotificationListenerService) |
| **React 19** | UI declarativa con hooks |

---

## Arquitectura y estructura de carpetas

```
mobile/
├── App.tsx                         # Root: NavigationContainer + AppNavigator
├── index.ts                        # Punto de entrada: registerRootComponent
├── src/
│   ├── navigation/
│   │   └── AppNavigator.tsx        # Stack navigator: Login → Dashboard
│   └── screens/
│       ├── LoginScreen.tsx         # Formulario + llamada a API + almacena JWT
│       └── DashboardScreen.tsx     # Escucha notificaciones + muestra lista
└── modules/
    └── notification-listener/      # Módulo nativo custom
        ├── index.ts                # API pública en TypeScript
        ├── package.json            # Paquete local (file:./modules/...)
        ├── expo-module.config.json # Registro del módulo Expo
        └── android/
            └── src/main/
                ├── AndroidManifest.xml
                └── java/expo/modules/notificationlistener/
                    ├── NotificationListenerModule.kt  # Bridge JS ↔ Android
                    └── FinwardNotificationListenerService.kt  # Servicio nativo
```

---

## Cómo funciona React Native

React Native **no corre en un WebView**. Compila componentes de React a vistas nativas reales:

```
React (JS/TS)  →  Bridge / JSI  →  Componentes nativos del OS
<View>         →                →  android.view.View
<Text>         →                →  android.widget.TextView
<TextInput>    →                →  android.widget.EditText
```

Escribís en TypeScript pero el resultado es una app nativa — no HTML renderizado en un browser.

**Nueva Arquitectura (activada en este proyecto):**
```json
// app.json
"newArchEnabled": true
```
El `newArchEnabled: true` activa JSI (JavaScript Interface) — reemplaza el Bridge antiguo por una capa C++ que permite comunicación síncrona y más rápida entre JS y el código nativo, sin serializar todo a JSON.

---

## Flujo de la app

### App.tsx — Root

```
App.tsx
└── NavigationContainer    ← Context global de navegación
    └── AppNavigator       ← Define el stack de pantallas
```

`NavigationContainer` es el provider que hace que toda la navegación funcione. Sin él, ningún hook de navegación funciona.

### AppNavigator.tsx — Stack Navigator

```typescript
export type RootStackParamList = {
  Login: undefined;      // No recibe parámetros
  Dashboard: undefined;  // No recibe parámetros
};
```

El tipo `RootStackParamList` tipea los parámetros de cada pantalla. Si `Dashboard` necesitara recibir un `userId: string`, se declara aquí y TypeScript te avisa si no lo pasás al navegar.

`headerShown: false` oculta el header por defecto — el diseño es full-screen custom.

---

## LoginScreen — Formulario completo

### Estado local con hooks

```typescript
const [email, setEmail]       = useState('');
const [password, setPassword] = useState('');
const [error, setError]       = useState('');
const [loading, setLoading]   = useState(false);
const [focused, setFocused]   = useState<'email' | 'password' | null>(null);
const [showPass, setShowPass] = useState(false);
```

Cada pieza de estado UI tiene su propio `useState`. Esta es la forma idiomática en React — no hay un objeto de estado único, sino estado granular por responsabilidad.

### Flujo de autenticación

```typescript
async function handleLogin() {
  setError('');
  setLoading(true);
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Credenciales incorrectas.');
      return;
    }
    await AsyncStorage.setItem('token', data.token);  // JWT persiste
    navigation.replace('Dashboard');                  // replace, no push
  } catch {
    setError('No se pudo conectar con el servidor.');
  } finally {
    setLoading(false);
  }
}
```

**`navigation.replace` vs `navigation.navigate`:** `replace` elimina `Login` del stack de navegación — el usuario no puede presionar "atrás" y volver al login después de autenticarse.

**`AsyncStorage`:** Equivalente a `localStorage` del browser pero asíncrono. Persiste el JWT entre sesiones del app.

### KeyboardAvoidingView

```typescript
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
```

En mobile, cuando aparece el teclado virtual empuja la UI. `KeyboardAvoidingView` ajusta el layout automáticamente. El comportamiento difiere entre iOS y Android — por eso el `Platform.OS` check.

### Diseño con StyleSheet

```typescript
const T = {
  blue: '#4A6FA5',
  blueLight: '#EEF2F9',
  // ...
};
```

`T` (design tokens) centraliza los colores en un objeto constante. `StyleSheet.create()` (en lugar de inline styles) optimiza el rendimiento — React Native los pre-procesa y les asigna IDs numéricos.

---

## DashboardScreen — Notificaciones en tiempo real

### Verificación de permisos

```typescript
const checkPermission = useCallback(() => {
  if (Platform.OS === 'android') {
    setHasPermission(isNotificationServiceEnabled());
  }
}, []);

useEffect(() => {
  checkPermission();
  const sub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') checkPermission();  // Re-check al volver al app
  });
  return () => sub.remove();  // Cleanup del listener
}, [checkPermission]);
```

`AppState` detecta cuando la app pasa de background a foreground. El usuario activa el permiso en Settings de Android y vuelve al app — este código re-verifica el estado automáticamente.

### Escuchar notificaciones

```typescript
useEffect(() => {
  if (!hasPermission) return;
  const sub = addNotificationListener((event) => {
    setNotifications((prev) => [event, ...prev].slice(0, 50));  // Máx 50
  });
  return () => sub.remove();  // Cleanup cuando el componente desmonta
}, [hasPermission]);
```

El cleanup `return () => sub.remove()` es crítico. Sin él, cada vez que el componente re-renderiza se añadiría un listener nuevo sin eliminar el anterior — memory leak.

### Renderizado condicional por estado

```
hasPermission === null  →  "Verificando permisos…"
hasPermission === false →  Tarjeta de permiso + botón "Conceder acceso"
hasPermission === true  →  FlatList de notificaciones
```

Tres estados de UI distintos, renderizados con ternario encadenado. Patrón muy común en React Native.

### FlatList vs ScrollView

```typescript
<FlatList
  data={notifications}
  keyExtractor={(_, i) => i.toString()}
  renderItem={({ item }) => <NotificationCard item={item} />}
/>
```

`FlatList` es la versión performante de `ScrollView` para listas. Solo renderiza los items visibles en pantalla (virtualización). Con `ScrollView` una lista de 1000 items renderizaría todos a la vez — en mobile eso bloquea el hilo de UI.

---

## El módulo nativo de notificaciones

Esta es la parte más técnica del proyecto. React Native no tiene API para escuchar **todas** las notificaciones del sistema — eso requiere un `NotificationListenerService` de Android, que solo existe en el SDK nativo.

### Arquitectura del módulo

```
TypeScript (app JS)
    ↕  Expo Modules Core (bridge automático)
Kotlin - NotificationListenerModule
    ↕  companion object (referencia estática)
Kotlin - FinwardNotificationListenerService (Android OS Service)
    ↕  Android Notification System
```

### Por qué Expo Modules Core

Expo Modules Core simplifica el bridge entre JS y código nativo. Sin él, habría que escribir código JNI (C++) o usar el bridge antiguo de React Native (más verboso y propenso a errores).

```kotlin
// NotificationListenerModule.kt — define la API que verá JS
class NotificationListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NotificationListener")       // nombre que usa requireNativeModule()

    Events("onNotificationReceived")   // eventos que puede emitir

    Function("isNotificationServiceEnabled") {
      // ... código Kotlin
    }

    Function("openNotificationSettings") {
      // ... código Kotlin
    }
  }
}
```

### Por qué BIND_NOTIFICATION_LISTENER_SERVICE es especial

```xml
<!-- AndroidManifest.xml del módulo -->
<uses-permission android:name="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" />
```

Este permiso **no se puede pedir programáticamente** con `requestPermissions()`. Es un permiso de nivel `signature` — el usuario **debe** ir manualmente a Configuración → Acceso a notificaciones. Por eso el Dashboard tiene la pantalla de permiso que abre `Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS`.

### Comunicación entre el Service y el Module

```kotlin
// FinwardNotificationListenerService.kt
companion object {
  @Volatile
  var module: NotificationListenerModule? = null  // Referencia estática
}

override fun onNotificationPosted(sbn: StatusBarNotification) {
  val title = extras.getString("android.title") ?: ""
  val text  = extras.getCharSequence("android.text")?.toString() ?: ""
  module?.sendNotification(title, text, sbn.packageName)
}
```

El `Service` de Android y el `Module` de Expo son objetos independientes. La solución fue un `companion object` (equivalente a `static` en Java) que guarda una referencia al Module. Cuando llega una notificación, el Service la pasa al Module, que la emite como evento JS.

`@Volatile` garantiza visibilidad del valor entre threads — el OS puede llamar `onNotificationPosted` en un thread diferente al thread principal de React Native.

### La API TypeScript del módulo

```typescript
// modules/notification-listener/index.ts
const listenerModule = requireNativeModule<NotificationListenerNativeModule>('NotificationListener');
const emitter = new EventEmitter(listenerModule);

export function addNotificationListener(listener: (event: NotificationEvent) => void) {
  return emitter.addListener('onNotificationReceived', listener);
}
```

Expo abstrae toda la complejidad. Desde el lado JS, usar el módulo nativo se ve idéntico a usar cualquier librería JS.

---

## TypeScript en React Native

### Props tipadas con navegación

```typescript
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  // navigation.replace('Dashboard') — TypeScript sabe las rutas válidas
}
```

`NativeStackScreenProps` le da a TypeScript información sobre qué rutas existen y qué parámetros aceptan. Si escribís `navigation.navigate('Dashbord')` (typo), el compilador lo detecta.

### Strict mode

```json
// tsconfig.json
"strict": true
```

Con strict activado: no hay implícitos `any`, no hay acceso a valores posiblemente `null` sin check, y los tipos de funciones deben ser explícitos. Más disciplina en el código.

---

## Expo vs React Native puro

| Expo | React Native puro |
|---|---|
| Build con `expo run:android` | Build con `react-native run-android` |
| Módulos pre-configurados | Configuración manual de cada nativo |
| OTA updates (Expo Go) | Solo builds nativos |
| Expo Modules Core para custom natives | Bridge manual o Turbo Modules |
| Más restricciones (sandbox) | Control total |

Este proyecto usa **Expo con módulos nativos custom** — el "mejor de ambos mundos": la conveniencia de Expo para el proyecto en general, y libertad de acceder al SDK Android completo cuando lo necesita (el NotificationListenerService).

---

## Patrones React que usé

### useCallback para estabilizar funciones

```typescript
const checkPermission = useCallback(() => {
  setHasPermission(isNotificationServiceEnabled());
}, []);
```

`useCallback` memoiza la función. Sin él, cada render crearía una nueva referencia de `checkPermission`, haciendo que el `useEffect` que depende de ella se re-ejecute infinitamente.

### Cleanup en useEffect

```typescript
useEffect(() => {
  const sub = addNotificationListener(handler);
  return () => sub.remove();  // Se ejecuta cuando el componente desmonta
}, [hasPermission]);
```

El retorno de `useEffect` es la función de cleanup. Es el equivalente de `componentWillUnmount` en clases. Crítico para event listeners — sin cleanup, persisten después de que la pantalla deja de existir.

### Functional updates en setState

```typescript
setNotifications((prev) => [event, ...prev].slice(0, 50));
```

Cuando el nuevo estado depende del estado anterior, usar la forma funcional de `setState` garantiza que siempre usás el estado más reciente — importante en callbacks asíncronos donde el closure puede tener un valor stale.

---

## Cómo mejorar y escalar

### Corto plazo

**1. Persistir sesión entre cierres de app**
Actualmente si cerrás el app debés loguearte de nuevo. Al arrancar el app, leer `AsyncStorage.getItem('token')`, verificar si es válido, y navegar directo al Dashboard si lo es.

**2. Logout**
Añadir botón en Dashboard que llame `AsyncStorage.removeItem('token')` + `navigation.replace('Login')`.

**3. Enviar notificaciones interceptadas al backend**
Cuando llega una `NotificationEvent`, hacer `POST /transactions` con el texto crudo. El backend y el servicio de IA lo parsean.

**4. Extraer los design tokens a `theme.ts`**
El CLAUDE.md indica hacerlo al agregar una tercera pantalla. Actualmente cada pantalla define su propio objeto `T` idéntico.

### Mediano plazo

**5. Estado global con Context o Zustand**
Cuando haya más pantallas, pasar el JWT y el user como props se vuelve engorroso. Un Context o una librería como Zustand permite acceso global sin prop drilling.

**6. Manejo de errores de red más robusto**
Mostrar diferente feedback para: sin internet, servidor caído, timeout, token expirado (401). Actualmente todos colapsan en "No se pudo conectar con el servidor."

**7. Interceptor de tokens expirados**
Cuando el backend devuelve 401, navegar automáticamente a Login y limpiar AsyncStorage.

**8. Android build de producción**
Configurar `eas build --platform android` de Expo Application Services para generar el APK/AAB firmado.

### Largo plazo

**9. iOS**
El módulo de notificaciones es solo Android (`"platforms": ["android"]`). En iOS, Apple no permite escuchar notificaciones de otras apps — habría que replantear la estrategia (ej: parsear emails bancarios en su lugar).

**10. React Query / TanStack Query**
Para las llamadas al backend (listas de transacciones, etc.), React Query maneja cache, loading states, refetch automático y deduplicación de requests — mucho mejor que `fetch` + `useState`.

---

## Preguntas de entrevista frecuentes y respuestas

**¿Qué diferencia hay entre React Native y una WebApp?**
> React Native compila a componentes nativos reales del sistema operativo — no hay un WebView ni HTML. El `<View>` de RN se convierte en `android.view.View`, el `<Text>` en `TextView`. El resultado es una app con rendimiento y feel nativo.

**¿Por qué Expo en lugar de React Native puro?**
> Expo simplifica el setup del build y proporciona una librería de módulos pre-configurados (cámara, GPS, etc.). Para este proyecto también elegí Expo porque su sistema de módulos (Expo Modules Core) simplifica escribir código nativo en Kotlin comparado con el bridge antiguo de React Native.

**¿Qué es el bridge de React Native?**
> Es el canal de comunicación entre el hilo de JavaScript y el hilo nativo del OS. Serializa datos a JSON para pasar mensajes entre los dos. La Nueva Arquitectura (JSI) lo reemplaza con una capa C++ que permite llamadas síncronas sin serialización — más rendimiento.

**¿Qué es AsyncStorage?**
> Es almacenamiento clave-valor persistente en el dispositivo, asíncrono. Equivalente al `localStorage` del browser pero como Promise. Se usa para guardar el JWT de sesión entre cierres del app.

**¿Cómo funciona el módulo nativo de notificaciones?**
> Android tiene un `NotificationListenerService` que recibe callbacks del OS cada vez que llega una notificación a cualquier app. Implementé ese Service en Kotlin y lo conecté a React Native usando Expo Modules Core, que genera automáticamente el bridge entre el Kotlin y el TypeScript. Desde el lado JS, es simplemente un event listener.

**¿Por qué el permiso de notificaciones es especial?**
> `BIND_NOTIFICATION_LISTENER_SERVICE` es un permiso de nivel `signature` en Android — no puede solicitarse programáticamente. El usuario debe ir manualmente a Configuración → Acceso a notificaciones. Por eso el Dashboard detecta si el permiso está activo y muestra una UI para abrirlo.

**¿Qué es `useCallback` y cuándo lo usás?**
> `useCallback` memoiza una función para que no se cree una nueva referencia en cada render. Lo usé en `checkPermission` porque es una dependencia de un `useEffect` — sin memoización, el efecto se re-ejecutaría infinitamente cada vez que el componente re-renderiza.

**¿Qué es el cleanup de `useEffect`?**
> La función que retornás de `useEffect` se ejecuta cuando el componente desmonta o cuando las dependencias cambian antes del próximo efecto. Esencial para event listeners, subscripciones y timers — sin cleanup causan memory leaks porque siguen activos aunque la pantalla ya no exista.
