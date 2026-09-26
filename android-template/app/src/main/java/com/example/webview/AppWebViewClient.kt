package com.example.webview

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import com.example.R
import com.example.config.AppConfig

/**
 * Customized [WebViewClient] providing URL filtering, external link dispatch,
 * secure SSL handling, and error/offline state detection.
 */
class AppWebViewClient(
    private val context: Context,
    private val appConfig: AppConfig,
    private val onStateChanged: (update: (WebViewUiState) -> WebViewUiState) -> Unit,
    private val onExternalUrlOpened: ((url: String) -> Unit)? = null
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return false
        val url = uri.toString()
        val scheme = uri.scheme?.lowercase() ?: ""

        // Allow internal local assets, html, and data schemes
        if (scheme == "file" || scheme == "about" || scheme == "data" || url.startsWith("https://localhost")) {
            return false
        }

        // Handle custom non-web protocols
        if (scheme != "http" && scheme != "https") {
            return handleCustomScheme(url)
        }

        // Host whitelist / external domain check
        if (!appConfig.isUrlAllowed(url)) {
            openInExternalBrowser(url)
            return true
        }

        return false
    }

    @Deprecated("Deprecated in Java", ReplaceWith("shouldOverrideUrlLoading(view, request)"))
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        if (url == null) return false
        val uri = Uri.parse(url)
        val scheme = uri.scheme?.lowercase() ?: ""

        // Allow internal local assets, html, and data schemes
        if (scheme == "file" || scheme == "about" || scheme == "data" || url.startsWith("https://localhost")) {
            return false
        }

        if (scheme != "http" && scheme != "https") {
            return handleCustomScheme(url)
        }

        if (!appConfig.isUrlAllowed(url)) {
            openInExternalBrowser(url)
            return true
        }

        return false
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        onStateChanged { state ->
            state.copy(
                isLoading = true,
                hasError = false,
                currentUrl = url ?: state.currentUrl,
                canGoBack = view?.canGoBack() ?: false,
                canGoForward = view?.canGoForward() ?: false,
                sslError = null
            )
        }
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        onStateChanged { state ->
            state.copy(
                isLoading = false,
                currentUrl = url ?: state.currentUrl,
                pageTitle = view?.title ?: state.pageTitle,
                canGoBack = view?.canGoBack() ?: false,
                canGoForward = view?.canGoForward() ?: false
            )
        }
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?
    ) {
        super.onReceivedError(view, request, error)
        // Only trigger error/offline screen for the main frame document
        if (request?.isForMainFrame == true) {
            val description = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                error?.description?.toString() ?: context.getString(R.string.offline_title)
            } else {
                context.getString(R.string.offline_title)
            }
            val errorCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                error?.errorCode ?: ERROR_UNKNOWN
            } else {
                ERROR_UNKNOWN
            }

            onStateChanged { state ->
                state.copy(
                    isLoading = false,
                    hasError = true,
                    errorCode = errorCode,
                    errorDescription = description,
                    failingUrl = request.url.toString()
                )
            }
        }
    }

    override fun onReceivedHttpError(
        view: WebView?,
        request: WebResourceRequest?,
        errorResponse: WebResourceResponse?
    ) {
        super.onReceivedHttpError(view, request, errorResponse)
        // If main frame encounters a server-side failure (5xx)
        if (request?.isForMainFrame == true) {
            val statusCode = errorResponse?.statusCode ?: 0
            if (statusCode >= 500) {
                onStateChanged { state ->
                    state.copy(
                        isLoading = false,
                        hasError = true,
                        errorCode = statusCode,
                        errorDescription = "HTTP Error $statusCode: ${errorResponse?.reasonPhrase.orEmpty()}",
                        failingUrl = request.url.toString()
                    )
                }
            }
        }
    }

    override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
        // Enforce secure HTTPS defaults: do NOT proceed through SSL warnings blindly
        val errorMessage = when (error?.primaryError) {
            SslError.SSL_EXPIRED -> "SSL Certificate has expired."
            SslError.SSL_IDMISMATCH -> "SSL Hostname mismatch."
            SslError.SSL_NOTYETVALID -> "SSL Certificate is not yet valid."
            SslError.SSL_UNTRUSTED -> "SSL Certificate authority is untrusted."
            else -> "SSL Certificate error encountered."
        }

        handler?.cancel()

        onStateChanged { state ->
            state.copy(
                isLoading = false,
                hasError = true,
                errorCode = error?.primaryError ?: ERROR_FAILED_SSL_HANDSHAKE,
                errorDescription = errorMessage,
                failingUrl = error?.url.orEmpty(),
                sslError = errorMessage
            )
        }
    }

    override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
        // Handle renderer crashes gracefully without killing the main application
        val didCrash = detail?.didCrash() ?: false
        onStateChanged { state ->
            state.copy(
                isLoading = false,
                hasError = true,
                errorDescription = if (didCrash) "Web renderer crashed unexpectedly." else "Web renderer killed by system for memory."
            )
        }
        view?.destroy()
        return true
    }

    private fun handleCustomScheme(url: String): Boolean {
        return try {
            val intent = if (url.startsWith("intent:")) {
                Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
            } else {
                Intent(Intent.ACTION_VIEW, Uri.parse(url))
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            true
        } catch (_: Exception) {
            Toast.makeText(context, R.string.no_app_to_handle_url, Toast.LENGTH_SHORT).show()
            true
        }
    }

    private fun openInExternalBrowser(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            onExternalUrlOpened?.invoke(url)
        } catch (_: Exception) {
            Toast.makeText(context, R.string.no_app_to_handle_url, Toast.LENGTH_SHORT).show()
        }
    }
}
