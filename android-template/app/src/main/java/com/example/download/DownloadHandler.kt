package com.example.download

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.widget.Toast
import com.example.R

/**
 * Handles in-app file downloads triggered by WebViews using Android's native [DownloadManager].
 */
class DownloadHandler(
    private val context: Context,
    private val onDownloadStarted: ((fileName: String) -> Unit)? = null
) : DownloadListener {

    override fun onDownloadStart(
        url: String?,
        userAgent: String?,
        contentDisposition: String?,
        mimetype: String?,
        contentLength: Long
    ) {
        if (url.isNullOrBlank()) return

        try {
            val uri = Uri.parse(url)
            val fileName = URLUtil.guessFileName(url, contentDisposition, mimetype)
            val request = DownloadManager.Request(uri).apply {
                val cookies = CookieManager.getInstance().getCookie(url)
                if (!cookies.isNullOrEmpty()) {
                    addRequestHeader("cookie", cookies)
                }
                if (!userAgent.isNullOrEmpty()) {
                    addRequestHeader("User-Agent", userAgent)
                }

                setDescription(context.getString(R.string.download_started, fileName))
                setTitle(fileName)
                setMimeType(mimetype)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            }

            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
            if (downloadManager != null) {
                downloadManager.enqueue(request)
                Toast.makeText(
                    context,
                    context.getString(R.string.download_started, fileName),
                    Toast.LENGTH_SHORT
                ).show()
                onDownloadStarted?.invoke(fileName)
            } else {
                Toast.makeText(context, R.string.download_failed, Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Toast.makeText(
                context,
                context.getString(R.string.download_failed) + ": ${e.localizedMessage}",
                Toast.LENGTH_LONG
            ).show()
        }
    }
}
