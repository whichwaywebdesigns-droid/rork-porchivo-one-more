import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { HeaderOfflineIndicator } from '@/components/HeaderOfflineIndicator';

export default function PackagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.primary,
        headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
        headerShadowVisible: false,
        headerRight: () => <HeaderOfflineIndicator />,
      }}
    />
  );
}
