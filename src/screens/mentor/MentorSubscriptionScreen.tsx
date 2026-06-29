import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MentorStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { getPlatform } from '../../utils/device';
import { mentorApi, MentorSubscription } from '../../api/mentor';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';

type Props = NativeStackScreenProps<MentorStackParamList, 'MentorSubscription'>;

const PLAN_FEATURES = [
  'Unlimited assigned seekers',
  'Push notifications for new assignments',
  'Mentor dashboard with progress tracking',
  'Priority support from our team',
  'Access to all future guru features',
];

const IAP_PRODUCT_ID = 'com.fixit.mentor.monthly';
const PLAN_PRICE = '$9.99 / month';

export default function MentorSubscriptionScreen({ navigation }: Props) {
  const [subscription, setSubscription] = useState<MentorSubscription | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    mentorApi.getSubscription()
      .then((res) => setSubscription(res.data?.data ?? null))
      .catch(() => setSubscription(null))
      .finally(() => setFetching(false));
  }, []);

  const proceed = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('MentorMain');
    }
  };

  const recordAndProceed = async (transactionId: string) => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    try {
      await mentorApi.recordSubscription({
        planType: 'Mentor',
        store: getPlatform() === 'iOS' ? 'Apple' : 'Google',
        iapProductId: IAP_PRODUCT_ID,
        iapTransactionId: transactionId,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        isTrialPeriod: false,
      });
    } catch {
      // Non-fatal
    }
    proceed();
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // TO ENABLE IAP: replace with react-native-iap purchase flow
      const fakeTransactionId = `STUB_${Date.now()}`;
      await recordAndProceed(fakeTransactionId);
    } catch (err: any) {
      setAlert({ title: 'Subscription Error', message: err.response?.data?.message ?? 'Purchase could not be completed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.mentor} />
      </View>
    );
  }

  const isActive = subscription && !subscription.isExpired;

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🌟</Text>
          <Text style={styles.heroTitle}>Mentor Plan</Text>
          {isActive ? (
            <>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>✓ Active</Text>
              </View>
              <Text style={styles.heroNote}>
                Renews on {new Date(subscription!.endDate).toLocaleDateString()}
                {` · ${subscription!.daysRemaining} days remaining`}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.heroPricing}>{PLAN_PRICE}</Text>
              <Text style={styles.heroNote}>Cancel anytime · Billed monthly</Text>
            </>
          )}
        </View>

        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>What's included</Text>
          {PLAN_FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.featureCheck}>✓</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {isActive ? (
          <>
            <AppButton
              title="Manage Subscription"
              onPress={() => setAlert({ title: 'Manage Subscription', message: 'To cancel or change your plan, go to your device\'s subscription settings (App Store or Google Play).' })}
              variant="outline"
              style={styles.subscribeBtn}
            />
            <AppButton
              title="Done"
              onPress={proceed}
              style={styles.skipBtn}
            />
          </>
        ) : (
          <AppButton
            title="Subscribe Now"
            onPress={handleSubscribe}
            loading={loading}
            style={styles.subscribeBtn}
          />
        )}

        <Text style={styles.disclaimer}>
          Subscriptions renew automatically. You can manage or cancel anytime
          from your device's account settings.
        </Text>
      </ScrollView>

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: 24,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  heroIcon: { fontSize: 56, marginBottom: 14 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: Colors.mentor, marginBottom: 8 },
  heroPricing: { fontSize: 32, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  heroNote: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  activeBadgeText: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  featuresCard: {
    backgroundColor: Colors.mentorLight,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 28,
    gap: 12,
  },
  featuresTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start' },
  featureCheck: { fontSize: 14, fontWeight: '700', color: Colors.mentor, marginRight: 10, marginTop: 1 },
  featureText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  subscribeBtn: { marginBottom: 12 },
  skipBtn: { marginBottom: 20 },
  disclaimer: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
