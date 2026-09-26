package com.example.webview

import android.content.Context
import android.net.Uri
import android.os.Message
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import com.example.config.AppConfig

/**
 * Customized [WebChromeClient] that bridges WebView hardware interactions
 * (Camera/Microphone, Geolocation, File Uploads, Window management) to host Android components.
 */
class AppWebChromeClient(
    private val context: Context,
    private val appConfig: AppConfig,
    private val onStateChanged: (update: (WebViewUiState) -> WebViewUiState) -> Unit,
    private val onOpenFileChooser: (
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
    ) -> Unit,
    private val onRequestMediaPermissions: (request: PermissionRequest) -> Unit,
    private val onRequestGeolocationPermission: (
        origin: String,
        callback: GeolocationPermissions.Callback
    ) -> Unit
) : WebChromeClient() {

    override fun onProgressChanged(view: WebView?, newProgress: Int) {
        super.onProgressChanged(view, newProgress)
        onStateChanged { state ->
            state.copy(
                progress = newProgress,
                isLoading = newProgress < 100
            )
        }
    }

    override fun onReceivedTitle(view: WebView?, title: String?) {
        super.onReceivedTitle(view, title)
        if (!title.isNullOrBlank()) {
            onStateChanged { state ->
                state.copy(pageTitle = title)
            }
        }
    }

    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
    ): Boolean {
        if (!appConfig.isFileUploadEnabled) {
            filePathCallback?.onReceiveValue(null)
            return false
        }

        onOpenFileChooser(filePathCallback, fileChooserParams)
        return true
    }

    override fun onPermissionRequest(request: PermissionRequest?) {
        if (request == null) return

        if (!appConfig.isCameraMicrophoneEnabled) {
            request.deny()
            return
        }

        onRequestMediaPermissions(request)
    }

    override fun onPermissionRequestCanceled(request: PermissionRequest?) {
        super.onPermissionRequestCanceled(request)
    }

    override fun onGeolocationPermissionsShowPrompt(
        origin: String?,
        callback: GeolocationPermissions.Callback?
    ) {
        if (origin == null || callback == null) return

        if (!appConfig.isGeolocationEnabled) {
            callback.invoke(origin, false, false)
            return
        }

        onRequestGeolocationPermission(origin, callback)
    }

    override fun onGeolocationPermissionsHidePrompt() {
        super.onGeolocationPermissionsHidePrompt()
    }

    override fun onCreateWindow(
        view: WebView?,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message?
    ): Boolean {
        if (!appConfig.isMultipleWindowsSupported || view == null || resultMsg == null) {
            return false
        }

        // Redirect popup window requests into the current WebView
        val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
        transport.webView = view
        resultMsg.sendToTarget()
        return true
    }
}
