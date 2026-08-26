import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.rork.porchivo"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.whichwayweblabs.porchivo"
        minSdk = 24
        targetSdk = 36
        versionCode = 1787757778
        versionName = "1.0.8"

        // Supabase credentials — read from local.properties, system env vars,
        // or the Expo .env file (EXPO_PUBLIC_ prefixed vars) as a final fallback.
        val localProps = rootProject.file("local.properties")
        val props = Properties()
        if (localProps.exists()) props.load(localProps.inputStream())

        // Also load expo/.env so the Android app shares the same Supabase credentials
        val expoEnv = rootProject.file("../expo/.env")
        val expoProps = Properties()
        if (expoEnv.exists()) {
            expoEnv.readLines().forEach { line ->
                val trimmed = line.trim()
                if (trimmed.isNotEmpty() && !trimmed.startsWith("#") && "=" in trimmed) {
                    val idx = trimmed.indexOf('=')
                    expoProps.setProperty(trimmed.substring(0, idx).trim(), trimmed.substring(idx + 1).trim())
                }
            }
        }

        fun envOrProp(vararg names: String): String =
            names.firstNotNullOfOrNull { name ->
                props.getProperty(name)
                    ?: System.getenv(name)?.takeIf { it.isNotBlank() }
                    ?: expoProps.getProperty(name)?.takeIf { it.isNotBlank() }
            } ?: ""

        buildConfigField("String", "SUPABASE_URL", "\"${envOrProp("SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${envOrProp("SUPABASE_ANON_KEY", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY")}\"")
        buildConfigField("String", "REVENUECAT_ANDROID_API_KEY", "\"${envOrProp("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.android)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.json)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.koin.androidx.compose)
    implementation(libs.androidx.security.crypto)
    implementation(libs.revenuecat.purchases)
    debugImplementation(libs.androidx.ui.tooling)
}
