package com.example.ui

import android.annotation.SuppressLint
import android.net.Uri
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.example.config.AppConfig
import com.example.download.DownloadHandler
import com.example.webview.AppWebChromeClient
import com.example.webview.AppWebViewClient
import com.example.webview.WebViewUiState

/**
 * Loads the configured initial content into the WebView based on [AppConfig.contentType].
 * Supports remote URLs, local asset HTML files, and inline HTML strings.
 */
fun WebView.loadInitialContent(appConfig: AppConfig) {
    when (appConfig.contentType.lowercase()) {
        "asset" -> {
            val assetPath = appConfig.assetPath.removePrefix("/")
            loadUrl("file:///android_asset/$assetPath")
        }
        "html" -> {
            loadDataWithBaseURL("https://localhost/", appConfig.rawHtml, "text/html", "UTF-8", null)
        }
        else -> {
            loadUrl(appConfig.defaultUrl)
        }
    }
}

/**
 * Main Composable hosting the Android WebView with full lifecycle binding,
 * pull-to-refresh, animated progress indicator & bar, offline error overlay, and back-button navigation.
 */
@OptIn(ExperimentalMaterial3Api::class)
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewContainer(
    appConfig: AppConfig,
    uiState: WebViewUiState,
    onStateChanged: (update: (WebViewUiState) -> WebViewUiState) -> Unit,
    onOpenFileChooser: (
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: WebChromeClient.FileChooserParams?
    ) -> Unit,
    onRequestMediaPermissions: (request: PermissionRequest) -> Unit,
    onRequestGeolocationPermission: (origin: String, callback: GeolocationPermissions.Callback) -> Unit,
    onExitRequested: () -> Unit,
    onWebViewCreated: (WebView) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var isRetrying by remember { mutableStateOf(false) }

    // Smoothly animated progress value between 0.0f and 1.0f
    val animatedProgress by animateFloatAsState(
        targetValue = (uiState.progress.coerceIn(0, 100)) / 100f,
        animationSpec = tween(durationMillis = 250, easing = FastOutSlowInEasing),
        label = "webViewProgress"
    )

    // Android back button handling: prioritize WebView history navigation if enabled
    BackHandler(enabled = appConfig.isBackNavigationEnabled) {
        val webView = webViewInstance
        if (uiState.hasError) {
            if (webView != null && webView.canGoBack()) {
                webView.goBack()
            } else {
                onExitRequested()
            }
        } else if (webView != null && webView.canGoBack()) {
            webView.goBack()
        } else {
            onExitRequested()
        }
    }

    // Lifecycle observer for onResume / onPause / onDestroy
    DisposableEffect(lifecycleOwner, webViewInstance) {
        val webView = webViewInstance
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> webView?.onResume()
                Lifecycle.Event.ON_PAUSE -> webView?.onPause()
                Lifecycle.Event.ON_DESTROY -> {
                    if (appConfig.isClearCacheOnExit) {
                        webView?.clearCache(true)
                    }
                    webView?.destroy()
                }
                else -> {}
            }
        }

        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    val pullToRefreshState = rememberPullToRefreshState()
    // Only show the pull-to-refresh indicator for a user-initiated pull.
    // `uiState.isLoading` is true for initial loads and link navigations too,
    // which must use the top bar / center loader instead.
    var isRefreshing by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isLoading) {
        if (!uiState.isLoading) {
            isRefreshing = false
        }
    }

    val webViewContent: @Composable () -> Unit = {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )

                    // WebSettings configuration
                    settings.apply {
                        javaScriptEnabled = appConfig.isJavaScriptEnabled
                        domStorageEnabled = appConfig.isDomStorageEnabled
                        databaseEnabled = appConfig.isDatabaseEnabled
                        setSupportZoom(appConfig.isBuiltInZoomEnabled)
                        builtInZoomControls = appConfig.isBuiltInZoomEnabled
                        displayZoomControls = appConfig.isDisplayZoomControlsEnabled
                        useWideViewPort = true
                        loadWithOverviewMode = true
                        allowFileAccess = true
                        allowContentAccess = true
                        mediaPlaybackRequiresUserGesture = false
                        mixedContentMode = if (appConfig.isMixedContentAllowed) {
                            WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                        } else {
                            WebSettings.MIXED_CONTENT_NEVER_ALLOW
                        }
                        cacheMode = WebSettings.LOAD_DEFAULT

                        if (appConfig.userAgentSuffix.isNotBlank()) {
                            userAgentString = "$userAgentString ${appConfig.userAgentSuffix}"
                        }
                    }

                    // Cookies configuration
                    val cookieManager = CookieManager.getInstance()
                    cookieManager.setAcceptCookie(true)
                    cookieManager.setAcceptThirdPartyCookies(this, true)

                    // Attach Download listener if enabled
                    if (appConfig.isDownloadsEnabled) {
                        setDownloadListener(DownloadHandler(ctx))
                    }

                    // Attach custom WebViewClient
                    webViewClient = AppWebViewClient(
                        context = ctx,
                        appConfig = appConfig,
                        onStateChanged = onStateChanged
                    )

                    // Attach custom WebChromeClient
                    webChromeClient = AppWebChromeClient(
                        context = ctx,
                        appConfig = appConfig,
                        onStateChanged = onStateChanged,
                        onOpenFileChooser = onOpenFileChooser,
                        onRequestMediaPermissions = onRequestMediaPermissions,
                        onRequestGeolocationPermission = onRequestGeolocationPermission
                    )

                    // Load initial target (URL, local HTML asset, or inline HTML)
                    loadInitialContent(appConfig)
                    webViewInstance = this
                    onWebViewCreated(this)
                }
            },
            update = { webView ->
                webViewInstance = webView
                onWebViewCreated(webView)
            },
            modifier = Modifier.fillMaxSize()
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (appConfig.isPullToRefreshEnabled && !uiState.hasError) {
            PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh = {
                    isRefreshing = true
                    webViewInstance?.reload()
                },
                state = pullToRefreshState,
                modifier = Modifier.fillMaxSize()
            ) {
                webViewContent()
            }
        } else {
            webViewContent()
        }

        // Top animated linear progress bar
        val showProgressBar = appConfig.isTopProgressBarEnabled &&
                (appConfig.progressIndicatorStyle == "bar" || appConfig.progressIndicatorStyle == "both")

        if (showProgressBar) {
            AnimatedVisibility(
                visible = uiState.isLoading && uiState.progress < 100,
                enter = fadeIn(tween(150)),
                exit = fadeOut(tween(250)),
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
            ) {
                if (uiState.progress <= 5) {
                    LinearProgressIndicator(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .testTag("progress_bar"),
                        color = MaterialTheme.colorScheme.primary,
                        trackColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
                    )
                } else {
                    LinearProgressIndicator(
                        progress = { animatedProgress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .testTag("progress_bar"),
                        color = MaterialTheme.colorScheme.primary,
                        trackColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
                    )
                }
            }
        }

        // Floating Center Progress Indicator / Spinner
        val showCenterLoader = appConfig.isCenterLoaderEnabled &&
                (appConfig.progressIndicatorStyle == "spinner" || appConfig.progressIndicatorStyle == "both")

        if (showCenterLoader) {
            AnimatedVisibility(
                visible = uiState.isLoading && uiState.progress < 90 && !uiState.hasError,
                enter = fadeIn(tween(200)),
                exit = fadeOut(tween(300)),
                modifier = Modifier.align(Alignment.Center)
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f),
                    shadowElevation = 8.dp,
                    tonalElevation = 3.dp,
                    modifier = Modifier.testTag("progress_indicator")
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 22.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        CircularProgressIndicator(
                            progress = { animatedProgress.coerceAtLeast(0.1f) },
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 3.dp,
                            color = MaterialTheme.colorScheme.primary,
                            trackColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
                        )
                        Text(
                            text = if (uiState.progress > 0) "Loading ${uiState.progress}%" else "Loading…",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }

        // Offline / Error screen overlay
        if (uiState.hasError) {
            OfflineErrorScreen(
                state = uiState,
                isRetrying = isRetrying,
                onRetry = {
                    isRetrying = true
                    onStateChanged { it.copy(hasError = false, isLoading = true) }
                    webViewInstance?.reload()
                    isRetrying = false
                },
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}
