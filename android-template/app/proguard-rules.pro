# =============================================================================
# Web2APK Engine ProGuard & R8 Optimization Rules
# =============================================================================

# Preserve JavaScript Interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve WebView clients and callback delegates
-keepclassmembers class * extends android.webkit.WebViewClient {
    public *;
}
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public *;
}
-keepclassmembers class android.webkit.ValueCallback {
    public void onReceiveValue(java.lang.Object);
}

# Preserve Geolocation and Permission Request classes
-keepclassmembers class android.webkit.GeolocationPermissions$Callback {
    public *;
}
-keepclassmembers class android.webkit.PermissionRequest {
    public *;
}

# Preserve DownloadManager
-keepclassmembers class android.app.DownloadManager* {
    public *;
}

# FileProvider
-keep class androidx.core.content.FileProvider {
    public *;
}

# Retain BuildConfig and AppConfig
-keep class com.example.config.** { *; }
-keep class com.example.BuildConfig { *; }
