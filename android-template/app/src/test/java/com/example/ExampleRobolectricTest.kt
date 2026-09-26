package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.config.AppConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("Web2APK Engine", appName)
  }

  @Test
  fun `load AppConfig from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val config = AppConfig.from(context)
    assertNotNull(config)
    assertEquals("url", config.contentType)
    assertEquals("https://www.google.com", config.defaultUrl)
    assertEquals("www/index.html", config.assetPath)
    assertTrue(config.isShowAppBar)
    assertTrue(config.isJavaScriptEnabled)
    assertTrue(config.isDomStorageEnabled)
    assertTrue(config.isPullToRefreshEnabled)
    assertTrue(config.isTopProgressBarEnabled)
    assertFalse(config.isCenterLoaderEnabled)
    assertEquals("bar", config.progressIndicatorStyle)
    assertTrue(config.isFileUploadEnabled)
    assertTrue(config.isDownloadsEnabled)
  }

  @Test
  fun `test getInitialTarget with different content types`() {
    val urlConfig = createAppConfig(contentType = "url", defaultUrl = "https://www.google.com")
    assertEquals("https://www.google.com", urlConfig.getInitialTarget())

    val assetConfig = createAppConfig(contentType = "asset", assetPath = "www/index.html")
    assertEquals("file:///android_asset/www/index.html", assetConfig.getInitialTarget())

    val htmlConfig = createAppConfig(contentType = "html")
    assertEquals("html:inline", htmlConfig.getInitialTarget())
  }

  @Test
  fun `test URL allowed with empty whitelist allows any URL`() {
    val config = createAppConfig(defaultUrl = "https://example.com", allowedHosts = emptyList())
    assertTrue(config.isUrlAllowed("https://google.com"))
    assertTrue(config.isUrlAllowed("https://mywebsite.org/page"))
    assertTrue(config.isUrlAllowed("file:///android_asset/www/index.html"))
    assertTrue(config.isUrlAllowed("https://localhost/"))
  }

  @Test
  fun `test URL allowed with host whitelist restricts external domains`() {
    val config = createAppConfig(
      defaultUrl = "https://example.com",
      allowedHosts = listOf("example.com", "api.example.com")
    )

    assertTrue(config.isUrlAllowed("https://example.com/dashboard"))
    assertTrue(config.isUrlAllowed("https://sub.example.com/checkout"))
    assertTrue(config.isUrlAllowed("file:///android_asset/www/index.html"))
    assertFalse(config.isUrlAllowed("https://phishing.com/login"))
  }

  private fun createAppConfig(
    contentType: String = "url",
    defaultUrl: String = "https://example.com",
    assetPath: String = "www/index.html",
    rawHtml: String = "",
    allowedHosts: List<String> = emptyList()
  ): AppConfig {
    return AppConfig(
      contentType = contentType,
      defaultUrl = defaultUrl,
      assetPath = assetPath,
      rawHtml = rawHtml,
      allowedHosts = allowedHosts,
      userAgentSuffix = "",
      isShowAppBar = true,
      appBarTitleMode = "web_title",
      isAppBarShowBackButton = true,
      isAppBarShowForwardButton = true,
      isAppBarShowRefreshButton = true,
      isAppBarShowHomeButton = true,
      isAppBarShowShareButton = true,
      isJavaScriptEnabled = true,
      isDomStorageEnabled = true,
      isDatabaseEnabled = true,
      isBuiltInZoomEnabled = true,
      isDisplayZoomControlsEnabled = false,
      isPullToRefreshEnabled = true,
      isTopProgressBarEnabled = true,
      isCenterLoaderEnabled = false,
      progressIndicatorStyle = "bar",
      isFileUploadEnabled = true,
      isDownloadsEnabled = true,
      isGeolocationEnabled = true,
      isCameraMicrophoneEnabled = true,
      isNotificationsEnabled = true,
      isBackNavigationEnabled = true,
      isConfirmExitOnBack = true,
      isMixedContentAllowed = false,
      isClearCacheOnExit = false,
      isMultipleWindowsSupported = true,
      isAutoRetryOnNetworkRecovery = true
    )
  }
}
