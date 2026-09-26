package com.example.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import com.example.R
import com.example.config.AppConfig
import com.example.webview.WebViewUiState

/**
 * Material 3 Top App Bar / Toolbar for the WebView application.
 * Configurable via [AppConfig] with back, forward, refresh, home, and share navigation controls.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WebViewAppBar(
    appConfig: AppConfig,
    uiState: WebViewUiState,
    onBackClick: () -> Unit,
    onForwardClick: () -> Unit,
    onRefreshClick: () -> Unit,
    onHomeClick: () -> Unit,
    onShareClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (!appConfig.isShowAppBar) return

    val titleText = when (appConfig.appBarTitleMode) {
        "app_name" -> stringResource(R.string.app_name)
        else -> if (uiState.pageTitle.isNotBlank()) uiState.pageTitle else stringResource(R.string.app_name)
    }

    val subtitleText = if (appConfig.appBarTitleMode != "app_name" && uiState.currentUrl.isNotBlank()) {
        uiState.currentUrl.removePrefix("https://").removePrefix("http://")
    } else {
        null
    }

    TopAppBar(
        title = {
            Column {
                Text(
                    text = titleText,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (subtitleText != null) {
                    Text(
                        text = subtitleText,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        },
        navigationIcon = {
            if (appConfig.isAppBarShowBackButton) {
                IconButton(
                    onClick = onBackClick,
                    enabled = uiState.canGoBack,
                    modifier = Modifier.testTag("toolbar_back_button")
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                        contentDescription = stringResource(R.string.toolbar_back),
                        tint = if (uiState.canGoBack) {
                            MaterialTheme.colorScheme.onSurface
                        } else {
                            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                        }
                    )
                }
            }
        },
        actions = {
            if (appConfig.isAppBarShowForwardButton) {
                IconButton(
                    onClick = onForwardClick,
                    enabled = uiState.canGoForward,
                    modifier = Modifier.testTag("toolbar_forward_button")
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                        contentDescription = stringResource(R.string.toolbar_forward),
                        tint = if (uiState.canGoForward) {
                            MaterialTheme.colorScheme.onSurface
                        } else {
                            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                        }
                    )
                }
            }

            if (appConfig.isAppBarShowRefreshButton) {
                IconButton(
                    onClick = onRefreshClick,
                    modifier = Modifier.testTag("toolbar_refresh_button")
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Refresh,
                        contentDescription = stringResource(R.string.toolbar_refresh)
                    )
                }
            }

            if (appConfig.isAppBarShowHomeButton) {
                IconButton(
                    onClick = onHomeClick,
                    modifier = Modifier.testTag("toolbar_home_button")
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Home,
                        contentDescription = stringResource(R.string.toolbar_home)
                    )
                }
            }

            if (appConfig.isAppBarShowShareButton) {
                IconButton(
                    onClick = onShareClick,
                    modifier = Modifier.testTag("toolbar_share_button")
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Share,
                        contentDescription = stringResource(R.string.toolbar_share)
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface,
            actionIconContentColor = MaterialTheme.colorScheme.onSurface
        ),
        modifier = modifier.fillMaxWidth()
    )
}
