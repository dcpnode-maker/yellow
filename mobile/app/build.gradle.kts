import java.net.URI

plugins {
    id("com.android.application")
}

providers.environmentVariable("YELLOW_ANDROID_BUILD_ROOT").orNull
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?.let { layout.buildDirectory.set(file(it).resolve("app")) }

val publicUrl = providers.gradleProperty("YELLOW_PUBLIC_URL")
    .orElse(providers.environmentVariable("YELLOW_PUBLIC_URL"))
    .orElse("https://demo.invalid/")
    .get()
    .trim()

val parsedPublicUrl = runCatching { URI(publicUrl) }
    .getOrElse { throw GradleException("YELLOW_PUBLIC_URL must be a valid absolute HTTPS URL") }

if (parsedPublicUrl.scheme != "https" || parsedPublicUrl.host.isNullOrBlank()) {
    throw GradleException("YELLOW_PUBLIC_URL must be an absolute HTTPS URL")
}

android {
    namespace = "com.yellow.pms.shell"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.yellow.pms.shell"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-demo"
        buildConfigField("String", "YELLOW_PUBLIC_URL", "\"${publicUrl.replace("\\", "\\\\").replace("\"", "\\\"")}\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isDebuggable = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
