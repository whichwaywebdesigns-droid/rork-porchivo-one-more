/**
 * WinBackScreen — Removed in HOA-provisioned model.
 * Redirects to the home screen immediately.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

export default function WinBackScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/(home)' as any);
  }, [router]);
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
});
