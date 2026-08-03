import { Link, Stack, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Shield } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useApp } from "@/store/AppContext";

export default function NotFoundScreen() {
  const router = useRouter();
  const { isOnboarded, session } = useApp();
  // P-16: send the user somewhere coherent. If they're authed + onboarded,
  // home works. Otherwise the redirect effect would bounce /home -> /welcome,
  // so link straight to /welcome to avoid a confusing double-redirect.
  const href = isOnboarded && session ? "/(tabs)/(home)" : "/welcome";
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View style={styles.container}>
        <Shield size={48} color={Colors.slateLighter} />
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.subtitle}>This screen doesn't exist in Porchivo.</Text>
        <Link href={href as any} style={styles.link} onPress={() => router.replace(href as any)}>
          <Text style={styles.linkText}>Go back home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.background,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.slate,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.slateLight,
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  linkText: {
    fontSize: 15,
    color: Colors.white,
    fontWeight: "600" as const,
  },
});
