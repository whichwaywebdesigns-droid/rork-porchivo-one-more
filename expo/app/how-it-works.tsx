import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Shield, Package, Eye, Users, AlertTriangle, CheckCircle, BadgeDollarSign } from 'lucide-react-native';
import { useColors } from '@/constants/colors';
import { isEnabled } from '@/lib/featureFlags';

const showPorchPartners = isEnabled('PORCH_PARTNERS');

/**
 * Dedicated "How It Works" walkthrough, presented as a modal route.
 * Reachable from the Profile screen and any "See how it works" entry point.
 */
export default function HowItWorksScreen() {
  const Colors = useColors();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Stack.Screen options={{ title: 'How It Works' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: Colors.surface }]}>
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: Colors.skyBlue }]}>
              <Shield size={24} color={Colors.primary} />
            </View>
            <Text style={[styles.title, { color: Colors.primary }]}>Protecting Your Porch, Together</Text>
          </View>

          <Text style={[styles.intro, { color: Colors.slateLight }]}>
            Porch piracy affects 1 in 3 Americans every year. Porchivo turns your neighborhood into a connected safety network so no package is left unprotected.
          </Text>

          <View style={styles.step}>
            <View style={[styles.stepIconCircle, { backgroundColor: Colors.primary }]}>
              <Package size={16} color={Colors.white} />
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: Colors.slate }]}>Track Every Delivery</Text>
              <Text style={[styles.stepDesc, { color: Colors.slateLight }]}>Log incoming packages and get real-time status updates so you always know what&apos;s on your porch and when it arrives.</Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={[styles.stepIconCircle, { backgroundColor: Colors.primary }]}>
              <Eye size={16} color={Colors.white} />
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: Colors.slate }]}>Neighborhood Watch</Text>
              <Text style={[styles.stepDesc, { color: Colors.slateLight }]}>See delivery activity on your block in real time. When neighbors are aware, thieves think twice.</Text>
            </View>
          </View>

          {showPorchPartners && (
            <View style={styles.step}>
              <View style={[styles.stepIconCircle, { backgroundColor: Colors.primary }]}>
                <Users size={16} color={Colors.white} />
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: Colors.slate }]}>Porch Partners</Text>
                <Text style={[styles.stepDesc, { color: Colors.slateLight }]}>Trusted neighbors can hold packages for you when you&apos;re away. No more deliveries sitting unattended for hours.</Text>
                <Text style={[styles.stepHighlight, { color: Colors.primary }]}>Great for when you are going to be home late or about to take a vacation!</Text>
              </View>
            </View>
          )}

          {showPorchPartners && (
            <View style={styles.step}>
              <View style={[styles.stepIconCircle, { backgroundColor: Colors.success }]}>
                <BadgeDollarSign size={16} color={Colors.white} />
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: Colors.slate }]}>Earn as a Partner</Text>
                <Text style={[styles.stepDesc, { color: Colors.slateLight }]}>Want to be the trusted neighbor? Become a verified Porch Partner and earn $5–25 per hold — up to $180/mo on a flexible schedule.</Text>
                <TouchableOpacity
                  onPress={() => router.push('/partner-onboarding' as any)}
                  style={styles.earnLink}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.earnLinkText, { color: Colors.success }]}>Learn how to earn →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.step}>
            <View style={[styles.stepIconCircle, { backgroundColor: Colors.primary }]}>
              <AlertTriangle size={16} color={Colors.white} />
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: Colors.slate }]}>Instant Alerts</Text>
              <Text style={[styles.stepDesc, { color: Colors.slateLight }]}>Get notified about suspicious activity nearby and alert your neighbors with one tap if something looks wrong.</Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={[styles.stepIconCircle, { backgroundColor: Colors.success }]}>
              <CheckCircle size={16} color={Colors.white} />
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: Colors.slate }]}>Safer Together</Text>
              <Text style={[styles.stepDesc, { color: Colors.slateLight }]}>Neighborhoods using Porchivo see fewer theft incidents. The more neighbors join, the stronger your protection becomes.</Text>
            </View>
          </View>

          <View style={[styles.tip, { backgroundColor: Colors.skyBlue }]}>
            <Text style={[styles.tipText, { color: Colors.primary }]}>Tip: Invite your neighbors to strengthen your block&apos;s safety network and unlock the full power of Porchivo.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 18,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    flex: 1,
  },
  intro: {
    fontSize: 14,
    lineHeight: 21,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  stepHighlight: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 19,
    marginTop: 4,
  },
  earnLink: {
    marginTop: 6,
    alignSelf: 'flex-start' as const,
  },
  earnLinkText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  tip: {
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500' as const,
  },
});
