# Add project specific ProGuard rules here.

# Keep Gson serialization classes
-keepattributes Signature
-keepattributes *Annotation*
-keep class school.karaoke.litlite.LitLite$* { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Web3j
-dontwarn org.web3j.**
-keep class org.web3j.** { *; }
