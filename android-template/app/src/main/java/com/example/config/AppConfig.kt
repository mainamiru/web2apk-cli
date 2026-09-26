package com.example.config

import android.content.Context
import android.net.Uri
import com.example.BuildConfig
import com.example.R

/**
 * Reusable runtime configuration for the Web2APK Engine.
 *
 * All settings are loaded from `res/values/web2apk_config.xml` or `BuildConfig`,
 * allowing a desktop builder or automated pipeline to configure the engine without
 * altering Kotlin source files.
 */
data class AppConfig(
    // Content source configuration
    val contentType: String, // "url", "asset", or "html"
    val defaultUrl: String,
    val assetPath: String,
    val rawHtml: String,
    val allowedHosts: List<String>,
    val userAgentSuffix: String,
    // App Bar / Toolbar configurations
    val isShowAppBar: Boolean,
    val appBarTitleMode: String, // "app_name" or "web_title"
    val isAppBarShowBackButton: Boolean,
    val isAppBarShowForwardButton: Boolean,
    val isAppBarShowRefreshButton: Boolean,
    val isAppBarShowHomeButton: Boolean,
    val isAppBarShowShareButton: Boolean,
    // Feature Flags
    val isJavaScriptEnabled: Boolean,
    val isDomStorageEnabled: Boolean,
    val isDatabaseEnabled: Boolean,
    val isBuiltInZoomEnabled: Boolean,
    val isDisplayZoomControlsEnabled: Boolean,
    val isPullToRefreshEnabled: Boolean,
    val isTopProgressBarEnabled: Boolean,
    val isCenterLoaderEnabled: Boolean,
    val progressIndicatorStyle: String, // "bar", "spinner", or "both"
    val isFileUploadEnabled: Boolean,
    val isDownloadsEnabled: Boolean,
    val isGeolocationEnabled: Boolean,
    val isCameraMicrophoneEnabled: Boolean,
    val isNotificationsEnabled: Boolean,
    val isBackNavigationEnabled: Boolean,
    val isConfirmExitOnBack: Boolean,
    val isMixedContentAllowed: Boolean,
    val isClearCacheOnExit: Boolean,
    val isMultipleWindowsSupported: Boolean,
    val isAutoRetryOnNetworkRecovery: Boolean
) {
    /**
     * Determines whether a given URL is allowed to be opened inside the WebView.
     * Local files, internal data URIs, and localhost are always allowed.
     * If [allowedHosts] is empty, all HTTP/HTTPS links stay in-app.
     * Otherwise, only URLs matching one of the whitelisted hostnames or their subdomains stay in-app.
     */
    fun isUrlAllowed(url: String): Boolean {
        if (url.startsWith("file://") || url.startsWith("data:") || url.startsWith("about:") || url.startsWith("https://localhost")) {
            return true
        }
        if (allowedHosts.isEmpty()) return true
        val uri = Uri.parse(url)
        val host = uri.host?.lowercase() ?: return false

        return allowedHosts.any { allowed ->
            val cleanAllowed = allowed.trim().lowercase()
            host == cleanAllowed || host.endsWith(".$cleanAllowed")
        }
    }

    /**
     * Returns the formatted initial URL or resource to load in the WebView.
     */
    fun getInitialTarget(): String {
        return when (contentType.lowercase()) {
            "asset" -> "file:///android_asset/${assetPath.removePrefix("/")}"
            "html" -> "html:inline"
            else -> defaultUrl
        }
    }

    companion object {
        fun from(context: Context): AppConfig {
            val res = context.resources

            fun safeString(resId: Int, fallback: String): String {
                return try {
                    res.getString(resId)
                } catch (e: Exception) {
                    fallback
                }
            }

            fun safeBool(resId: Int, fallback: Boolean): Boolean {
                return try {
                    res.getBoolean(resId)
                } catch (e: Exception) {
                    fallback
                }
            }

            // Content Type resolution
            val rawContentType = safeString(R.string.web2apk_content_type, BuildConfig.WEB2APK_CONTENT_TYPE)
            val contentType = if (rawContentType.isNotBlank()) rawContentType else "url"

            // URL resolution: Config XML -> BuildConfig -> fallback
            val rawUrl = safeString(R.string.web2apk_default_url, BuildConfig.WEB2APK_DEFAULT_URL)
            val defaultUrl = if (rawUrl.isNotBlank()) rawUrl else "https://www.google.com"

            // Asset Path resolution
            val rawAssetPath = safeString(R.string.web2apk_asset_path, BuildConfig.WEB2APK_ASSET_PATH)
            val assetPath = if (rawAssetPath.isNotBlank()) rawAssetPath else "www/index.html"

            // Raw HTML resolution
            val rawHtml = safeString(R.string.web2apk_raw_html, "")

            val rawAllowedHosts = safeString(R.string.web2apk_allowed_hosts, "")
            val allowedHosts = rawAllowedHosts
                .split(',', ';')
                .map { it.trim() }
                .filter { it.isNotEmpty() }

            val userAgentSuffix = safeString(R.string.web2apk_user_agent_suffix, "Web2APK/1.0.0")

            return AppConfig(
                contentType = contentType,
                defaultUrl = defaultUrl,
                assetPath = assetPath,
                rawHtml = rawHtml,
                allowedHosts = allowedHosts,
                userAgentSuffix = userAgentSuffix,
                isShowAppBar = safeBool(R.bool.web2apk_show_app_bar, true),
                appBarTitleMode = safeString(R.string.web2apk_app_bar_title_mode, "web_title"),
                isAppBarShowBackButton = safeBool(R.bool.web2apk_app_bar_show_back_button, true),
                isAppBarShowForwardButton = safeBool(R.bool.web2apk_app_bar_show_forward_button, true),
                isAppBarShowRefreshButton = safeBool(R.bool.web2apk_app_bar_show_refresh_button, true),
                isAppBarShowHomeButton = safeBool(R.bool.web2apk_app_bar_show_home_button, true),
                isAppBarShowShareButton = safeBool(R.bool.web2apk_app_bar_show_share_button, true),
                isJavaScriptEnabled = safeBool(R.bool.web2apk_enable_javascript, true),
                isDomStorageEnabled = safeBool(R.bool.web2apk_enable_dom_storage, true),
                isDatabaseEnabled = safeBool(R.bool.web2apk_enable_database, true),
                isBuiltInZoomEnabled = safeBool(R.bool.web2apk_enable_built_in_zoom, true),
                isDisplayZoomControlsEnabled = safeBool(R.bool.web2apk_display_zoom_controls, false),
                isPullToRefreshEnabled = safeBool(R.bool.web2apk_enable_pull_to_refresh, true),
                isTopProgressBarEnabled = safeBool(R.bool.web2apk_enable_top_progress_bar, true),
                isCenterLoaderEnabled = safeBool(R.bool.web2apk_enable_center_loader, false),
                progressIndicatorStyle = safeString(R.string.web2apk_progress_indicator_style, "bar"),
                isFileUploadEnabled = safeBool(R.bool.web2apk_enable_file_upload, true),
                isDownloadsEnabled = safeBool(R.bool.web2apk_enable_downloads, true),
                isGeolocationEnabled = safeBool(R.bool.web2apk_enable_geolocation, true),
                isCameraMicrophoneEnabled = safeBool(R.bool.web2apk_enable_camera_microphone, true),
                isNotificationsEnabled = safeBool(R.bool.web2apk_enable_notifications, true),
                isBackNavigationEnabled = safeBool(R.bool.web2apk_enable_back_navigation, true),
                isConfirmExitOnBack = safeBool(R.bool.web2apk_confirm_exit_on_back, true),
                isMixedContentAllowed = safeBool(R.bool.web2apk_allow_mixed_content, false),
                isClearCacheOnExit = safeBool(R.bool.web2apk_clear_cache_on_exit, false),
                isMultipleWindowsSupported = safeBool(R.bool.web2apk_support_multiple_windows, true),
                isAutoRetryOnNetworkRecovery = safeBool(R.bool.web2apk_auto_retry_on_network_recovery, true)
            )
        }
    }
}
