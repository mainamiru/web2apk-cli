package com.example

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.example.config.AppConfig
import com.example.network.NetworkMonitor
import com.example.ui.WebViewAppBar
import com.example.ui.WebViewContainer
import com.example.ui.loadInitialContent
import com.example.ui.theme.Web2APKTheme
import com.example.webview.WebViewUiState
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {

    private lateinit var appConfig: AppConfig
    private lateinit var networkMonitor: NetworkMonitor

    // File Chooser state
    private var activeFilePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null

    // Pending WebRTC and Geolocation requests
    private var pendingMediaRequest: PermissionRequest? = null
    private var pendingGeoCallback: Pair<String, GeolocationPermissions.Callback>? = null

    // Reference to WebView instance for toolbar actions
    private var currentWebView: WebView? = null

    // File chooser launcher
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = activeFilePathCallback
        activeFilePathCallback = null

        if (callback == null) return@registerForActivityResult

        if (result.resultCode == RESULT_OK) {
            val intent = result.data
            val results: Array<Uri>? = when {
                intent?.clipData != null -> {
                    val count = intent.clipData!!.itemCount
                    Array(count) { i -> intent.clipData!!.getItemAt(i).uri }
                }
                intent?.data != null -> {
                    arrayOf(intent.data!!)
                }
                cameraPhotoUri != null -> {
                    // Check if camera captured file exists
                    arrayOf(cameraPhotoUri!!)
                }
                else -> null
            }
            callback.onReceiveValue(results)
        } else {
            callback.onReceiveValue(null)
        }
        cameraPhotoUri = null
    }

    // Media Permissions (Camera & Microphone) launcher
    private val mediaPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val request = pendingMediaRequest
        pendingMediaRequest = null

        if (request == null) return@registerForActivityResult

        val grantedResources = mutableListOf<String>()
        val hasCamera = permissions[Manifest.permission.CAMERA] == true ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val hasAudio = permissions[Manifest.permission.RECORD_AUDIO] == true ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

        request.resources.forEach { res ->
            if (res == PermissionRequest.RESOURCE_VIDEO_CAPTURE && hasCamera) {
                grantedResources.add(res)
            } else if (res == PermissionRequest.RESOURCE_AUDIO_CAPTURE && hasAudio) {
                grantedResources.add(res)
            }
        }

        if (grantedResources.isNotEmpty()) {
            request.grant(grantedResources.toTypedArray())
        } else {
            request.deny()
            Toast.makeText(this, R.string.permission_denied_toast, Toast.LENGTH_SHORT).show()
        }
    }

    // Geolocation Permission launcher
    private val geolocationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val pending = pendingGeoCallback
        pendingGeoCallback = null

        if (pending == null) return@registerForActivityResult

        val isGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        pending.second.invoke(pending.first, isGranted, false)
        if (!isGranted) {
            Toast.makeText(this, R.string.permission_denied_toast, Toast.LENGTH_SHORT).show()
        }
    }

    // Notification Permission launcher (Android 13+)
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* Notification permission result handled silently */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        appConfig = AppConfig.from(this)
        networkMonitor = NetworkMonitor(this)

        // Request notification permission if enabled and on Android 13+
        if (appConfig.isNotificationsEnabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        setContent {
            Web2APKTheme {
                val snackbarHostState = remember { SnackbarHostState() }
                val scope = rememberCoroutineScope()
                var uiState by remember {
                    mutableStateOf(WebViewUiState(currentUrl = appConfig.getInitialTarget()))
                }
                var lastBackPressTime by remember { mutableLongStateOf(0L) }

                // Network restoration auto-retry listener
                LaunchedEffect(Unit) {
                    var isFirstEmission = true
                    networkMonitor.isOnlineFlow.collect { isOnline ->
                        if (isFirstEmission) {
                            isFirstEmission = false
                            return@collect
                        }

                        if (isOnline && uiState.hasError && appConfig.isAutoRetryOnNetworkRecovery) {
                            scope.launch {
                                snackbarHostState.showSnackbar(getString(R.string.network_restored))
                            }
                            uiState = uiState.copy(hasError = false, isLoading = true)
                            currentWebView?.reload()
                        }
                    }
                }

                fun handleBackNavigation() {
                    val webView = currentWebView
                    if (uiState.hasError) {
                        if (webView != null && webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            handleExitApp()
                        }
                    } else if (webView != null && webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        handleExitApp()
                    }
                }

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    topBar = {
                        WebViewAppBar(
                            appConfig = appConfig,
                            uiState = uiState,
                            onBackClick = { handleBackNavigation() },
                            onForwardClick = { currentWebView?.goForward() },
                            onRefreshClick = { currentWebView?.reload() },
                            onHomeClick = { currentWebView?.loadInitialContent(appConfig) },
                            onShareClick = {
                                val urlToShare = if (uiState.currentUrl.isNotBlank()) uiState.currentUrl else appConfig.getInitialTarget()
                                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_SUBJECT, getString(R.string.share_subject))
                                    putExtra(Intent.EXTRA_TEXT, urlToShare)
                                }
                                startActivity(Intent.createChooser(shareIntent, getString(R.string.toolbar_share)))
                            }
                        )
                    },
                    snackbarHost = { SnackbarHost(snackbarHostState) }
                ) { innerPadding ->
                    WebViewContainer(
                        appConfig = appConfig,
                        uiState = uiState,
                        onStateChanged = { update ->
                            uiState = update(uiState)
                        },
                        onOpenFileChooser = { callback, params ->
                            handleOpenFileChooser(callback, params)
                        },
                        onRequestMediaPermissions = { request ->
                            handleMediaPermissionRequest(request)
                        },
                        onRequestGeolocationPermission = { origin, callback ->
                            handleGeolocationPermission(origin, callback)
                        },
                        onExitRequested = {
                            handleExitApp()
                        },
                        onWebViewCreated = { webView ->
                            currentWebView = webView
                        },
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    )
                }
            }
        }
    }

    private var exitToastTime: Long = 0L

    private fun handleExitApp() {
        if (appConfig.isConfirmExitOnBack) {
            val now = System.currentTimeMillis()
            if (now - exitToastTime < 2000L) {
                finish()
            } else {
                exitToastTime = now
                Toast.makeText(
                    this,
                    R.string.press_back_again_to_exit,
                    Toast.LENGTH_SHORT
                ).show()
            }
        } else {
            finish()
        }
    }

    private fun handleOpenFileChooser(
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: WebChromeClient.FileChooserParams?
    ) {
        // Cancel any pending callback
        activeFilePathCallback?.onReceiveValue(null)
        activeFilePathCallback = filePathCallback

        try {
            val acceptTypes = fileChooserParams?.acceptTypes ?: arrayOf("*/*")
            val mimeType = if (acceptTypes.isNotEmpty() && acceptTypes[0].isNotBlank()) {
                acceptTypes[0]
            } else {
                "*/*"
            }

            // Create file chooser intent
            val contentIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = mimeType
                if (fileChooserParams?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
            }

            // Add camera option if user wants to take a photo
            val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            if (cameraIntent.resolveActivity(packageManager) != null) {
                val photoFile = createImageFile()
                if (photoFile != null) {
                    val uri = FileProvider.getUriForFile(
                        this,
                        "${applicationContext.packageName}.fileprovider",
                        photoFile
                    )
                    cameraPhotoUri = uri
                    cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, uri)
                }
            }

            val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
                putExtra(Intent.EXTRA_INTENT, contentIntent)
                putExtra(Intent.EXTRA_TITLE, getString(R.string.file_chooser_title))
                if (cameraPhotoUri != null) {
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                }
            }

            fileChooserLauncher.launch(chooserIntent)
        } catch (_: Exception) {
            activeFilePathCallback?.onReceiveValue(null)
            activeFilePathCallback = null
            Toast.makeText(this, R.string.download_failed, Toast.LENGTH_SHORT).show()
        }
    }

    private fun createImageFile(): File? {
        return try {
            val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES) ?: cacheDir
            File.createTempFile("JPEG_${timeStamp}_", ".jpg", storageDir)
        } catch (_: Exception) {
            null
        }
    }

    private fun handleMediaPermissionRequest(request: PermissionRequest) {
        pendingMediaRequest = request
        val neededPermissions = mutableListOf<String>()

        request.resources.forEach { res ->
            when (res) {
                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> {
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                        != PackageManager.PERMISSION_GRANTED
                    ) {
                        neededPermissions.add(Manifest.permission.CAMERA)
                    }
                }
                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> {
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED
                    ) {
                        neededPermissions.add(Manifest.permission.RECORD_AUDIO)
                    }
                }
            }
        }

        if (neededPermissions.isEmpty()) {
            request.grant(request.resources)
            pendingMediaRequest = null
        } else {
            mediaPermissionLauncher.launch(neededPermissions.toTypedArray())
        }
    }

    private fun handleGeolocationPermission(
        origin: String,
        callback: GeolocationPermissions.Callback
    ) {
        val hasFine = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val hasCoarse = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (hasFine || hasCoarse) {
            callback.invoke(origin, true, false)
        } else {
            pendingGeoCallback = Pair(origin, callback)
            geolocationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }
}
