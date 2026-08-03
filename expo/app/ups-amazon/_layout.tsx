import { Stack } from 'expo-router';

/**
 * UPS & Amazon Hidden Services subsection layout.
 * Houses the 6-screen delivery management webflow:
 *   1. hub             — Hidden Services Hub Dashboard (entry point)
 *   2. code-ready      — Pre-Arrival Briefing / OTP screen
 *   3. not-delivered   — Missing Package Claim (A-to-Z dispute)
 *   4. intercept       — UPS Package Intercept / Reroute
 *   5. live-tracking   — Amazon Live Driver Map Tracker
 *   6. access-points   — UPS Access Point Finder
 */
export default function UpsAmazonLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F2F3F4' },
        headerShadowVisible: false,
        headerTintColor: '#1B3A78',
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: '#F2F3F4' },
        animation: 'slide_from_right',
      }}
    />
  );
}
