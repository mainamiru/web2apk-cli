package com.example.webview

/**
 * Immutable UI State representing the current status of the WebView container.
 */
data class WebViewUiState(
    val isLoading: Boolean = true,
    val progress: Int = 0,
    val hasError: Boolean = false,
    val errorCode: Int = 0,
    val errorDescription: String = "",
    val failingUrl: String = "",
    val currentUrl: String = "",
    val pageTitle: String = "",
    val canGoBack: Boolean = false,
    val canGoForward: Boolean = false,
    val sslError: String? = null
)
