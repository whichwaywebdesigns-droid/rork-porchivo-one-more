# ProGuard / R8 keep rules for Porchivo
#
# Ktor serialization — keep @Serializable classes and serializer companions
-keep class com.rork.porchivo.data.** { *; }
-keep class io.ktor.** { *; }
-keepclassmembers class * { @kotlinx.serialization.Serializable <fields>; }

# Coil — keep image loading components
-keep class coil.** { *; }

# Koin — keep dependency injection components
-keep class org.koin.** { *; }

# Compose — keep runtime and material3
-keep class androidx.compose.** { *; }
-keep class androidx.compose.material3.** { *; }
