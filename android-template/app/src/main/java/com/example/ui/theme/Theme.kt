package com.example.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = Web2ApkPrimary,
    onPrimary = Web2ApkOnPrimary,
    primaryContainer = Web2ApkPrimaryContainer,
    onPrimaryContainer = Web2ApkOnPrimaryContainer,
    secondary = Web2ApkSecondary,
    onSecondary = Web2ApkOnSecondary,
    secondaryContainer = Web2ApkSecondaryContainer,
    onSecondaryContainer = Web2ApkOnSecondaryContainer,
    background = Web2ApkBackgroundDark,
    surface = Web2ApkSurfaceDark,
    onBackground = Web2ApkOnSurfaceDark,
    onSurface = Web2ApkOnSurfaceDark,
    surfaceVariant = Web2ApkSurfaceVariantDark,
    onSurfaceVariant = Web2ApkOnSurfaceVariantDark,
    error = Web2ApkError,
    errorContainer = Web2ApkErrorContainer,
    onError = Web2ApkOnError,
    onErrorContainer = Web2ApkOnErrorContainer
)

private val LightColorScheme = lightColorScheme(
    primary = Web2ApkPrimary,
    onPrimary = Web2ApkOnPrimary,
    primaryContainer = Web2ApkPrimaryContainer,
    onPrimaryContainer = Web2ApkOnPrimaryContainer,
    secondary = Web2ApkSecondary,
    onSecondary = Web2ApkOnSecondary,
    secondaryContainer = Web2ApkSecondaryContainer,
    onSecondaryContainer = Web2ApkOnSecondaryContainer,
    background = Web2ApkBackgroundLight,
    surface = Web2ApkSurfaceLight,
    onBackground = Web2ApkOnSurfaceLight,
    onSurface = Web2ApkOnSurfaceLight,
    surfaceVariant = Web2ApkSurfaceVariantLight,
    onSurfaceVariant = Web2ApkOnSurfaceVariantLight,
    error = Web2ApkError,
    errorContainer = Web2ApkErrorContainer,
    onError = Web2ApkOnError,
    onErrorContainer = Web2ApkOnErrorContainer
)

@Composable
fun Web2APKTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}

// Alias for template backward compatibility
@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) = Web2APKTheme(darkTheme = darkTheme, dynamicColor = dynamicColor, content = content)
