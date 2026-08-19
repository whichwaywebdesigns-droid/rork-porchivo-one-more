import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import React, { useEffect, useRef, useState } from "react";
import { StatusBar, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import ConsentGate from "@/components/ConsentGate";
import { AppProvider, useApp } from "@/store/AppContext";
import { PaywallProvider } from "@/store/PaywallContext";
import { NotificationsProvider } from "@/store/NotificationsContext";
import { ShipmentsProvider } from "@/store/ShipmentsContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { initSuperwall } from "@/lib/superwall";
import { log } from "@/lib/logger";
import { PackagesProvider } from "@/store/PackagesContext";
import { DriversProvider } from "@/store/DriversContext";
import { NeighborhoodProvider } from "@/store/NeighborhoodContext";
import { PorchPartnersProvider } from "@/store/PorchPartnersContext";
import { AlertsProvider } from "@/store/AlertsContext";
import { DeliveryWindowsProvider } from "@/store/DeliveryWindowsContext";
import { AnalyticsProvider } from "@/store/AnalyticsContext";
import { OnboardingProvider } from "@/store/OnboardingContext";
import { OnboardingFlowProvider } from "@/store/OnboardingFlowContext";
import { useReviewPrompt } from "@/hooks/useReviewPrompt";
import { ReviewPromptSheet } from "@/components/ReviewPromptSheet";
import { ExperimentsProvider } from "@/store/ExperimentsContext";
import { ProfileExtensionProvider } from "@/store/ProfileExtensionContext";
import { OrganizationProvider, useOrganization } from "@/store/OrganizationContext";
import { FieldGuideProvider } from "@/store/FieldGuideContext";
import { TrustEngineProvider } from "@/store/TrustEngineContext";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { LanguageRootProvider } from "@/i18n/LanguageProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { OfflineQueueProvider } from "@/store/OfflineQueueContext";
import { OfflineBanner } from "@/components/OfflineBanner";
import { BackgroundErrorProvider } from "@/store/BackgroundErrorContext";
import { BackgroundErrorBanner } from "@/components/BackgroundErrorBanner";
import { useTheme } from "@/hooks/useTheme";
import { useColors } from "@/constants/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Sentry crash reporting
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: false,
  tracesSampleRate: 0.2,
  environment: __DEV__ ? "development" : "production",
});

// Expo Updates — check for OTA updates in background on launch
async function checkForUpdates() {
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Non-fatal: silently ignore update check failures
  }
}
void checkForUpdates();

// SDK 54 build
void initSuperwall();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isOnboarded, isLoading, session } = useApp();
  const { isOrgMember, isLoading: isOrgLoading } = useOrganization();
  const Colors = useColors();
  const { isDark } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const lastTarget = useRef<string | null>(null);
  const mountedAtRef = useRef<number>(Date.now());
  const [hasSeenSlides, setHasSeenSlides] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("porchivo_pre_auth_slides_seen").then((value) => {
      setHasSeenSlides(value === "true");
    });
  }, []);

  // In-app review prompt — only fires when onboarded and not on a welcome screen.
  // The hook internally checks session milestones (3rd, 10th, 25th open),
  // 7-day active use, cooldowns, and the storeReviewPrompt feature flag.
  const currentSegment = segments[0] as string;
  const inWelcome =
    currentSegment === "splash" ||
    currentSegment === "onboarding" ||
    currentSegment === "tracking-onboarding" ||
    currentSegment === "tracking-welcome" ||
    currentSegment === "tracking-add-delivery" ||
    currentSegment === "tracking-theft-shield" ||
    currentSegment === "tracking-notifications" ||
    currentSegment === "tracking-partners" ||
    currentSegment === "tracking-complete" ||
    currentSegment === "welcome" ||
    currentSegment === "welcome-features" ||
    currentSegment === "guest-browse" ||
    currentSegment === "login" ||
    currentSegment === "role-selection" ||
    currentSegment === "pain-point" ||
    currentSegment === "value-preview" ||
    currentSegment === "location-consent" ||
    currentSegment === "onboarding-setup" ||
    currentSegment === "notifications-permission" ||
    currentSegment === "delivery-alerts" ||
    currentSegment === "safe-dropoff" ||
    currentSegment === "reset-password" ||
    currentSegment === "auth-fail";
  const reviewPrompt = useReviewPrompt(isOnboarded, inWelcome);

  // P-17: Fallback so the native splash never lingers on a slow network —
  // hide it regardless of auth resolution after 3s.
  useEffect(() => {
    const fallback = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3000);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (isLoading || isOnboarded === null || hasSeenSlides === null) return;

    // Wait for org context to resolve before redirecting — we need isOrgMember
    // to pick the correct initial tab. Only matters when there's a session
    // (the org query is disabled without a userId, so isOrgLoading is false).
    if (session && isOrgLoading) return;

    const currentSegment = segments[0] as string;

    // Guard: wait for the navigator to resolve the initial route before
    // running any redirect logic. On the very first render the segment
    // can be an empty string (navigator hasn't mounted yet), so inWelcome
    // would be false and we'd yank the user straight to onboarding-setup —
    // skipping the splash screen entirely.
    if (!currentSegment) return;

    // Tracking onboarding screens manage their own navigation via the step
    // manager (tracking-onboarding.tsx → goHome()). They must NOT be yanked
    // by the layout redirect when the user signs up mid-flow at Step 2 —
    // doing so skips Steps 3–6 entirely.
    const inTrackingOnboarding =
      currentSegment === "tracking-onboarding" ||
      currentSegment === "tracking-welcome" ||
      currentSegment === "tracking-add-delivery" ||
      currentSegment === "tracking-theft-shield" ||
      currentSegment === "tracking-notifications" ||
      currentSegment === "tracking-partners" ||
      currentSegment === "tracking-complete";

    const inWelcome =
      inTrackingOnboarding ||
      currentSegment === "splash" ||
      currentSegment === "onboarding" ||
      currentSegment === "welcome" ||
      currentSegment === "welcome-features" ||
      currentSegment === "guest-browse" ||
      currentSegment === "login" ||
      currentSegment === "role-selection" ||
      currentSegment === "pain-point" ||
      currentSegment === "value-preview" ||
      currentSegment === "location-consent" ||
      currentSegment === "onboarding-setup" ||
      currentSegment === "notifications-permission" ||
      currentSegment === "delivery-alerts" ||
      currentSegment === "safe-dropoff" ||
      currentSegment === "reset-password" ||
      currentSegment === "auth-fail";

    let target: string | null = null;

    if (!isOnboarded && !inWelcome) {
      // Pre-auth flow: show onboarding slides once, then the welcome/login screen.
      target = session ? "/onboarding-setup" : hasSeenSlides ? "/welcome" : "/splash";
    } else if (isOnboarded && session && inWelcome && !inTrackingOnboarding) {
      // Onboarded user inside the OLD pre-auth/welcome chain -> send home.
      // Tracking onboarding screens are excluded — the step manager exits itself.
      // Tier-aware: community members go to Home tab, free-tier users to
      // Deliveries. Without this, free-tier users land on the hidden Home tab
      // and the HomeScreen safety redirect fires — which can crash during
      // React reconnection (navigator not yet ready).
      target = isOrgMember ? "/(tabs)/(home)" : "/(tabs)/packages";
    } else if (isOnboarded && !session && !inWelcome) {
      target = "/welcome";
    }

    if (target && target !== lastTarget.current) {
      lastTarget.current = target;
      log("[Layout] Navigating to:", target);
      router.replace(target as any);
    } else if (!target) {
      lastTarget.current = null;
    }
  }, [isOnboarded, isLoading, session, segments, router, hasSeenSlides, isOrgMember, isOrgLoading]);

  return (
    <View style={{ flex: 1 }}>
      {/* Global status bar — reacts to resolved theme */}
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
    <Stack
      initialRouteName="splash"
      screenOptions={{
        headerBackTitle: "Back",
        // Use surface (not white) so headers theme correctly in dark mode.
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.slate,
        headerShadowVisible: false,
        headerTitleStyle: { color: Colors.slate },
        // Global cool fade between screens — mirrors the splash dismiss fade,
        // but 30% shorter (500ms -> 350ms) for a snappier webflow.
        animation: "fade",
        animationDuration: 350,
      }}
    >
      <Stack.Screen name="splash" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      {/* 6-step tracking onboarding flow (post-carousel) */}
      <Stack.Screen name="tracking-onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="tracking-welcome" options={{ headerShown: false }} />
      <Stack.Screen name="tracking-add-delivery" options={{ headerShown: false }} />
      <Stack.Screen name="tracking-theft-shield" options={{ headerShown: false }} />
      <Stack.Screen name="tracking-notifications" options={{ headerShown: false }} />
      <Stack.Screen name="tracking-partners" options={{ headerShown: false }} />
      <Stack.Screen name="tracking-complete" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="welcome-features" options={{ headerShown: false }} />
      <Stack.Screen name="guest-browse" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="role-selection" options={{ headerShown: false }} />
      <Stack.Screen name="pain-point" options={{ headerShown: false }} />
      <Stack.Screen name="value-preview" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding-setup" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="safe-dropoff" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="location-consent" options={{ headerShown: false }} />
      <Stack.Screen name="shipment-detail" options={{ presentation: "modal", title: "Shipment Details" }} />
      <Stack.Screen name="edit-profile" options={{ presentation: "modal", title: "Edit Profile" }} />
      <Stack.Screen name="add-package" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="package-detail" options={{ presentation: "modal", title: "Package Detail" }} />
      <Stack.Screen name="partner-detail" options={{ presentation: "modal", title: "Partner Detail" }} />
      <Stack.Screen name="my-assignments" options={{ presentation: "modal", title: "My Assignments" }} />
      <Stack.Screen name="alerts" options={{ title: "Alerts" }} />
      <Stack.Screen name="privacy-policy" options={{ title: "Privacy Policy" }} />
      <Stack.Screen name="terms-of-service" options={{ title: "Terms of Service" }} />
      <Stack.Screen name="alert-detail" options={{ presentation: "modal", title: "Alert Detail" }} />
      <Stack.Screen name="community-guidelines" options={{ title: "Community Guidelines" }} />
      <Stack.Screen name="contact-support" options={{ title: "Contact Support" }} />
      <Stack.Screen name="support-ticket-detail" options={{ title: "Ticket Details" }} />
      <Stack.Screen name="how-it-works" options={{ presentation: "modal", title: "How It Works" }} />
      <Stack.Screen name="field-guide" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="chat" options={{ title: "Chat" }} />
      <Stack.Screen name="delivery-windows" options={{ title: "Delivery Windows" }} />
      <Stack.Screen name="map" options={{ title: "Map" }} />
      <Stack.Screen name="drivers" options={{ title: "Drivers" }} />
      <Stack.Screen name="partners" options={{ title: "Porch Partners" }} />
      <Stack.Screen name="neighborhood" options={{ title: "Neighborhood" }} />
      <Stack.Screen name="network-map" options={{ title: "Partner-Shipments Network" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="invite-partner" options={{ title: "Invite Partner" }} />
      <Stack.Screen name="safety-score" options={{ title: "Block Safety Score" }} />
      <Stack.Screen name="porch-risk" options={{ title: "Porch Risk", presentation: "modal" }} />
      <Stack.Screen name="notifications-permission" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="delivery-alerts" options={{ headerShown: false }} />
      <Stack.Screen name="join-community" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="org-signup" options={{ headerShown: false }} />
      <Stack.Screen name="manage-subscription" options={{ title: "Manage Subscription" }} />
      <Stack.Screen name="billing" options={{ title: "Manage Plan", presentation: "modal" }} />
      <Stack.Screen name="partner-onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="admin-funnel" options={{ headerShown: false, presentation: "modal" }} />
      {/* UPS & Amazon Hidden Services subsection — 6-screen delivery webflow */}
      <Stack.Screen name="ups-amazon" options={{ headerShown: false }} />
      {/* Revenue — referral, payout setup */}
      <Stack.Screen name="referral" options={{ headerShown: false, title: "Invite & Earn" }} />
      <Stack.Screen name="partner-payout-setup" options={{ headerShown: false }} />
      <Stack.Screen name="partner-verify" options={{ title: "Identity Verification" }} />
      <Stack.Screen name="partner-earnings" options={{ title: "Partner Earnings" }} />
      <Stack.Screen name="partner-holds" options={{ title: "Package Holds" }} />
      <Stack.Screen name="invoices" options={{ title: "Invoices" }} />
      <Stack.Screen name="trust-engine" options={{ headerShown: false }} />
      <Stack.Screen name="create-assignment" options={{ title: "Create Assignment", presentation: "modal" }} />
      <Stack.Screen name="+not-found" />
      {/* Settings — headerShown:false because PorchLightHero replaces the header */}
      <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="delete-account" options={{ title: "Delete Account", presentation: "modal" }} />
    </Stack>
    {/* In-app rating prompt — shown at session milestones after onboarding */}
    <ReviewPromptSheet
      visible={reviewPrompt.visible}
      reason={reviewPrompt.reason}
      onDismiss={reviewPrompt.dismiss}
    />
    {/* Forced re-accept gate when the legal version changes */}
    <ConsentGate />
    {/* Non-intrusive banner for background process failures (Ship24 polling, etc.) */}
    <BackgroundErrorBanner />
    <OfflineBanner />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
          <LanguageRootProvider>
          <ToastProvider>
          <OfflineQueueProvider>
          <AppProvider>
            <PaywallProvider>
            <NotificationsProvider>
            <BackgroundErrorProvider>
              <ShipmentsProvider>
                <PackagesProvider>
                  <DriversProvider>
                    <PorchPartnersProvider>
                      <NeighborhoodProvider>
                        <AlertsProvider>
                          <DeliveryWindowsProvider>
                            <AnalyticsProvider>
                              <OnboardingProvider>
                                <OnboardingFlowProvider>
                                <ExperimentsProvider>
                                <ProfileExtensionProvider>
                                  <OrganizationProvider>
                                  <FieldGuideProvider>
                                  <TrustEngineProvider>
                                  <RootLayoutNav />
                                  </TrustEngineProvider>
                                  </FieldGuideProvider>
                                  </OrganizationProvider>
                                </ProfileExtensionProvider>
                                </ExperimentsProvider>
                                </OnboardingFlowProvider>
                              </OnboardingProvider>
                            </AnalyticsProvider>
                          </DeliveryWindowsProvider>
                        </AlertsProvider>
                      </NeighborhoodProvider>
                    </PorchPartnersProvider>
                  </DriversProvider>
                </PackagesProvider>
              </ShipmentsProvider>
            </BackgroundErrorProvider>
            </NotificationsProvider>
            </PaywallProvider>
          </AppProvider>
          </OfflineQueueProvider>
          </ToastProvider>
          </LanguageRootProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
