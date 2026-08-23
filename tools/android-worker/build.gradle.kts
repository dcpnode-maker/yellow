import com.android.build.api.dsl.LibraryExtension

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.jetbrains.kotlin.android) apply false
}

// The pinned upstream sample library also enables x86_64 for emulator use. Yellow's
// verified pilot fleet is arm64-only, so narrow the external module after its DSL has
// been evaluated instead of modifying or forking the pinned submodule.
project(":llamaLib") {
    afterEvaluate {
        extensions.configure<LibraryExtension> {
            defaultConfig.ndk.abiFilters.clear()
            defaultConfig.ndk.abiFilters += "arm64-v8a"
        }
    }
}
