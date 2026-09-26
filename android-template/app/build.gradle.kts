import com.google.gms.googleservices.GoogleServicesPlugin.MissingGoogleServicesStrategy

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.google.devtools.ksp)
    alias(libs.plugins.secrets)
    alias(libs.plugins.google.services)
}

android {
    namespace = "com.example"
    compileSdk { version = release(36) { minorApiLevel = 1 } }

    val web2apkAppId =
        (project.findProperty("web2apk.applicationId") as? String) ?: "com.aistudio.web2apk.vtwxqm"
    val web2apkAppName = (project.findProperty("web2apk.appName") as? String) ?: "Web2APK Engine"
    val web2apkVersionCode =
        (project.findProperty("web2apk.versionCode") as? String)?.toIntOrNull() ?: 1
    val web2apkVersionName = (project.findProperty("web2apk.versionName") as? String) ?: "1.0.0"
    val web2apkOrientation =
        (project.findProperty("web2apk.screenOrientation") as? String) ?: "unspecified"
    val web2apkWebsiteUrl =
        (project.findProperty("web2apk.websiteUrl") as? String) ?: "https://www.google.com"
    val web2apkContentType = (project.findProperty("web2apk.contentType") as? String) ?: "url"
    val web2apkAssetPath =
        (project.findProperty("web2apk.assetPath") as? String) ?: "www/index.html"

    defaultConfig {
        applicationId = web2apkAppId
        minSdk = 24
        targetSdk = 36
        versionCode = web2apkVersionCode
        versionName = web2apkVersionName

        manifestPlaceholders["appOrientation"] = web2apkOrientation
        manifestPlaceholders["appName"] = web2apkAppName

        buildConfigField("String", "WEB2APK_DEFAULT_URL", "\"$web2apkWebsiteUrl\"")
        buildConfigField("String", "WEB2APK_APP_NAME", "\"$web2apkAppName\"")
        buildConfigField("String", "WEB2APK_CONTENT_TYPE", "\"$web2apkContentType\"")
        buildConfigField("String", "WEB2APK_ASSET_PATH", "\"$web2apkAssetPath\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    val customKeystorePath =
        (project.findProperty("web2apk.keystorePath") as? String) ?: System.getenv("KEYSTORE_PATH")
    val customStorePassword =
        (project.findProperty("web2apk.storePassword") as? String)
            ?: System.getenv("STORE_PASSWORD")
    val customKeyAlias =
        (project.findProperty("web2apk.keyAlias") as? String) ?: System.getenv("KEY_ALIAS")
    val customKeyPassword =
        (project.findProperty("web2apk.keyPassword") as? String) ?: System.getenv("KEY_PASSWORD")

    signingConfigs {
        create("release") {
            if (!customKeystorePath.isNullOrBlank() && file(customKeystorePath).exists()) {
                storeFile = file(customKeystorePath)
                storePassword = customStorePassword ?: ""
                keyAlias = customKeyAlias ?: "upload"
                keyPassword = customKeyPassword ?: customStorePassword ?: ""
            } else if (file("${rootDir}/my-upload-key.jks").exists()) {
                storeFile = file("${rootDir}/my-upload-key.jks")
                storePassword = customStorePassword ?: System.getenv("STORE_PASSWORD") ?: ""
                keyAlias = customKeyAlias ?: "upload"
                keyPassword = customKeyPassword ?: System.getenv("KEY_PASSWORD") ?: ""
            } else {
                // Fallback to debug.keystore for development and automated builds
                storeFile = file("${rootDir}/debug.keystore")
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
        create("debugConfig") {
            storeFile = file("${rootDir}/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isCrunchPngs = false
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug { signingConfig = signingConfigs.getByName("debugConfig") }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    testOptions { unitTests { isIncludeAndroidResources = true } }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
        disable.add("InvalidFragmentVersionForActivityResult")
    }
}

// Configure the Secrets Gradle Plugin to use .env and .env.example files
// to match the convention used in Web projects.
secrets {
    propertiesFileName = ".env"
    defaultPropertiesFileName = ".env.example"
    ignoreList.add("FIREBASE_APPCHECK_DEBUG_TOKEN")
}

googleServices { missingGoogleServicesStrategy = MissingGoogleServicesStrategy.WARN }

// Some unused dependencies are commented out below instead of being removed.
// This makes it easy to add them back in the future if needed.
dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(platform(libs.firebase.bom))
    // implementation(libs.accompanist.permissions)
    implementation(libs.androidx.activity.compose)
    // implementation(libs.androidx.camera.camera2)
    // implementation(libs.androidx.camera.core)
    // implementation(libs.androidx.camera.lifecycle)
    // implementation(libs.androidx.camera.view)
    implementation(libs.androidx.compose.material.icons.core)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    // implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    // implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.room.ktx)
    implementation(libs.androidx.room.runtime)
    // implementation(libs.coil.compose)
    implementation(libs.converter.moshi)
    implementation(libs.firebase.ai)
    // Uncomment to use Firestore:
    // implementation(libs.firebase.firestore)

    // Uncomment ALL FOUR of the following dependencies together to use Firebase Auth and Google
    // Sign-In via Credential Manager:
    // implementation(libs.firebase.auth)
    // implementation(libs.androidx.credentials)
    // implementation(libs.androidx.credentials.play.services)
    // implementation(libs.googleid)
    implementation(libs.firebase.appcheck.recaptcha)
    implementation(libs.firebase.appcheck.debug)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.logging.interceptor)
    implementation(libs.moshi.kotlin)
    implementation(libs.okhttp)
    // implementation(libs.play.services.location)
    implementation(libs.retrofit)
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.androidx.core)
    testImplementation(libs.androidx.junit)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.robolectric)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.runner)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
    "ksp"(libs.androidx.room.compiler)
    "ksp"(libs.moshi.kotlin.codegen)
}
