import type { ExpoConfig } from "expo/config";

export default (): { expo: ExpoConfig } => ({
  expo: {
    name: "Porchivo",
    slug: "porchivo-neighborhood-safety",
    version: "1.0.6",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "porchivo",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-box.png",
      resizeMode: "cover",
      backgroundColor: "#CACBCB",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.whichwayweblabs.porchivo",
      buildNumber: "27",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#102040",
        monochromeImage: "./assets/images/adaptive-icon.png",
      },
      package: "com.whichwayweblabs.porchivo",
      versionCode: 27,
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
      ],
    },
    web: {
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      [
        "expo-router",
        {
          origin: "https://rork.com/",
        },
      ],
      "expo-font",
      "expo-system-ui",
      "expo-web-browser",
      "expo-updates",
      "@sentry/react-native/expo",
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#102040",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Porchivo uses your location to show nearby package activity and neighborhood alerts.",
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Porchivo needs camera access to scan package barcodes for instant tracking."
        }
      ],
    ],
    updates: {
      url: "https://u.expo.dev/1c5be498-5328-4fb7-a200-5c98d55f298f",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: "https://rork.com/",
      },
      eas: {
        projectId: "1c5be498-5328-4fb7-a200-5c98d55f298f",
      },
      // APP_ENV is set per EAS build profile in eas.json (development/preview/production).
      // EXPO_PUBLIC_APP_ENV is the client-readable mirror used in lib/revenueCat.ts to
      // select test vs. production RevenueCat API keys.
      appEnv: process.env.APP_ENV ?? "development",
      githubTokenPresent: !!process.env.GITHUB_TOKEN,
    },
    owner: "ericgilbert1",
  },
});
