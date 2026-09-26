# Web2APK Engine Template

A production-ready Android WebView application template designed to serve as the core engine for Web-to-APK desktop builders, CLI packaging pipelines, and converted Progressive Web Apps (PWAs).

---

## 🚀 Key Features

- **Modern Architecture**: Jetpack Compose + Android View interop, Kotlin Coroutines, Flow.
- **Material Design 3**: Dynamic color theming, edge-to-edge support, and responsive layouts.
- **Full HTML5/PWA Support**: JavaScript, DOM Storage (`localStorage`, `sessionStorage`), IndexedDB, and WebSQL.
- **File Upload & Camera Integration**: Native `<input type="file">` handling supporting single/multiple file selection, media filtering, and direct camera photo capture via secure `FileProvider`.
- **Download Management**: Native Android `DownloadManager` support with automated cookies, User-Agent propagation, and notification status tracking.
- **Permissions Management**:
  - WebRTC Video & Audio (`navigator.mediaDevices.getUserMedia`)
  - Geolocation (`navigator.geolocation`)
  - Notifications (`POST_NOTIFICATIONS` on Android 13+)
- **Network Resilience & Offline Screen**: Automatic detection of network drops with a polished Material 3 Offline Screen, retry mechanism, and real-time network reconnection auto-reload.
- **Lifecycle Awareness**: WebView pausing, resuming, and memory crash recovery (`onRenderProcessGone`).
- **Content Source Modes**: Support for remote URLs (`https://`), local bundled assets (`assets/www/index.html`), and raw inline HTML strings.
- **Progress Bar & Indicators**: Smooth animated top `LinearProgressIndicator` with progress percentage and optional center floating loader chip.
- **Material 3 App Bar / Toolbar**: Configurable Top App Bar displaying page title/app name, back/forward buttons, pull-to-refresh, home button, and share link action.
- **Navigation Controls**: Android back-button browser history traversal and double-tap exit confirmation.
- **External URL & Deep Link Dispatch**: Automatic dispatch of non-HTTP schemes (`tel:`, `mailto:`, `sms:`, `intent:`, `market:`, `whatsapp:`) and whitelist domain enforcement.
- **Security First**: Strict HTTPS by default, secure cookies, and no cleartext traffic.

---

## 📁 Project Structure & Important Files

| File                                                          | Purpose                                                                                                                                                                             |
| :------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gradle.properties`                                           | Holds build-time template properties (`web2apk.applicationId`, `web2apk.appName`, `web2apk.versionCode`, `web2apk.versionName`, `web2apk.websiteUrl`, `web2apk.screenOrientation`). |
| `app/build.gradle.kts`                                        | Injects builder properties into `defaultConfig`, wires `manifestPlaceholders`, and injects `BuildConfig` values.                                                                    |
| `app/src/main/res/values/web2apk_config.xml`                  | Central XML runtime configuration file for website URL, feature flags, whitelist domains, and user-agent customization.                                                             |
| `app/src/main/res/values/colors.xml`                          | Brand colors (primary, surface, background, progress bar, splash) for one-step rebranding.                                                                                          |
| `app/src/main/res/values/strings.xml`                         | Localized user-facing strings (app name, dialogs, error messages, exit prompt).                                                                                                     |
| `app/src/main/res/values/themes.xml`                          | Material 3 app theme and Android 12+ splash screen configuration.                                                                                                                   |
| `app/src/main/AndroidManifest.xml`                            | Declarations of permissions, hardware features, FileProvider, and activity placeholders (`${appOrientation}`, `${appName}`).                                                        |
| `app/src/main/res/xml/network_security_config.xml`            | Security configuration enforcing HTTPS traffic and certificate validation.                                                                                                          |
| `app/src/main/res/xml/file_paths.xml`                         | Safe storage paths for `FileProvider` during camera capture and file uploads.                                                                                                       |
| `app/proguard-rules.pro`                                      | Release optimization rules preserving JavaScript interfaces and WebView callbacks.                                                                                                  |
| `app/src/main/java/com/example/config/AppConfig.kt`           | Type-safe configuration loader that reads runtime settings from resources with fallback logic.                                                                                      |
| `app/src/main/java/com/example/network/NetworkMonitor.kt`     | Real-time connectivity monitor using `ConnectivityManager.NetworkCallback`.                                                                                                         |
| `app/src/main/java/com/example/download/DownloadHandler.kt`   | Native file downloader using Android's `DownloadManager`.                                                                                                                           |
| `app/src/main/java/com/example/webview/AppWebViewClient.kt`   | URL routing, domain whitelisting, deep link intent handling, and offline error trapping.                                                                                            |
| `app/src/main/java/com/example/webview/AppWebChromeClient.kt` | Bridges `<input type="file">`, WebRTC camera/mic permissions, and geolocation prompts.                                                                                              |
| `app/src/main/java/com/example/webview/WebViewUiState.kt`     | Immutable state model for loading progress, errors, URLs, and navigation history.                                                                                                   |
| `app/src/main/java/com/example/ui/WebViewContainer.kt`        | Composable hosting the WebView, pull-to-refresh, animated progress bar, and lifecycle management.                                                                                   |
| `app/src/main/java/com/example/ui/OfflineErrorScreen.kt`      | Material 3 offline and network error screen with retry and network settings actions.                                                                                                |
| `app/src/main/java/com/example/MainActivity.kt`               | Main host activity managing runtime permissions, file chooser launchers, and edge-to-edge window insets.                                                                            |

---

## 🛠️ Web-to-APK Desktop Builder Integration

A Web-to-APK builder can customize this project in three flexible ways:

### 1. Command-Line Parameter Injection (Automated Builds)

Pass custom parameters directly to Gradle without altering any files:

```bash
./gradlew assembleRelease \
  -Pweb2apk.applicationId="com.myclient.store" \
  -Pweb2apk.appName="My Store" \
  -Pweb2apk.versionCode=10 \
  -Pweb2apk.versionName="2.0.1" \
  -Pweb2apk.websiteUrl="https://store.myclient.com" \
  -Pweb2apk.screenOrientation="portrait"
```

### 2. File-Based Configuration (Desktop GUI Generators)

The desktop builder can directly write or update:

1. `gradle.properties`:
   ```properties
   web2apk.applicationId=com.mycompany.app
   web2apk.appName=My App
   web2apk.versionCode=1
   web2apk.versionName=1.0.0
   web2apk.websiteUrl=https://example.com
   web2apk.screenOrientation=portrait
   ```
2. `app/src/main/res/values/web2apk_config.xml`:
   ```xml
   <resources>
       <string name="web2apk_default_url">https://example.com</string>
       <string name="web2apk_allowed_hosts">example.com,sub.example.com</string>
       <bool name="web2apk_enable_pull_to_refresh">true</bool>
       <bool name="web2apk_enable_camera_microphone">true</bool>
       <bool name="web2apk_enable_geolocation">true</bool>
       <bool name="web2apk_enable_downloads">true</bool>
   </resources>
   ```
3. `app/src/main/res/values/colors.xml`:
   ```xml
   <color name="web2apk_primary">#FF6B00</color>
   <color name="web2apk_splash_background">#1F1F1F</color>
   ```

### 3. Icon Replacement

Replace the adaptive icon files:

- Foreground: `app/src/main/res/drawable/ic_launcher_foreground.xml` or custom bitmap
- Background: `app/src/main/res/drawable/ic_launcher_background.xml` (or update color hex)
- Fallback PNGs in `app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/`

---

## 🔒 Security & Play Store Compliance

- **No Broad Storage Permissions**: File uploads and camera capture use the modern system picker and `FileProvider`. No `READ_EXTERNAL_STORAGE` is requested.
- **Scoped Downloads**: Downloads use `DownloadManager` saving to the public `DIRECTORY_DOWNLOADS` directory.
- **Hardware Fallbacks**: All hardware features (`camera`, `microphone`, `gps`) in `AndroidManifest.xml` are declared with `android:required="false"` so the app can be installed on devices lacking those components.
- **Strict HTTPS**: Cleartext HTTP traffic is blocked by default in `network_security_config.xml`.
