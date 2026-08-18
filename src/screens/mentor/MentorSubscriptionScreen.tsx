import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MentorStackParamList } from '../../types/navigation';
import { Colors } from '../../utils/colors';
import { getPlatform } from '../../utils/device';
import { mentorApi, MentorSubscription } from '../../api/mentor';
import AppButton from '../../components/common/AppButton';
import AppAlert from '../../components/common/AppAlert';

type Props = NativeStackScreenProps<MentorStackParamList, 'MentorSubscription'>;

// Kept for reference — features are no longer shown on the redesigned plan card.
const PLAN_FEATURES = [
  'Unlimited assigned seekers',
  'Push notifications for new assignments',
  'Mentor dashboard with progress tracking',
  'Priority support from our team',
  'Access to all future guru features',
];

const IAP_PRODUCT_ID = 'com.fixit.mentor.monthly';
const PLAN_PRICE = '$20';

export default function MentorSubscriptionScreen({ navigation }: Props) {
  const [subscription, setSubscription] = useState<MentorSubscription | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
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
    setSuccess(true);
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

  // ── Success (Congratulations) state ────────────────────────
  if (success) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.successWrap}>
          <Image
            source={require('../../assets/congratulation.png')}
            style={styles.successImage}
            resizeMode="contain"
          />
          <Text style={styles.successTitle}>Congratulations!</Text>
          <Text style={styles.successSubtitle}>
            You Have Successfully Subscribed To The Mentorship Program!
          </Text>
          <Text style={styles.successBody}>
            You're all set to guide seekers on their journey. Your mentor
            dashboard is now unlocked.
          </Text>
        </View>
        <View style={styles.successFooter}>
          <AppButton title="Continue" onPress={proceed} style={styles.continueBtn} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() && navigation.goBack()} hitSlop={8}>
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Subscription Plan</Text>

        {/* Plan card */}
        <View style={styles.planCard}>
          <Image
            source={require('../../assets/crown.png')}
            style={styles.planMedal}
            resizeMode="contain"
          />
          <Text style={styles.planName}>Mentorship Program</Text>

          {isActive ? (
            <>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>✓ Active</Text>
              </View>
              <Text style={styles.planNote}>
                Renews on {new Date(subscription!.endDate).toLocaleDateString()}
                {` · ${subscription!.daysRemaining} days left`}
              </Text>
              <AppButton
                title="Manage Subscription"
                onPress={() => setAlert({ title: 'Manage Subscription', message: 'To cancel or change your plan, go to your device\'s subscription settings (App Store or Google Play).' })}
                style={styles.planBtn}
              />
            </>
          ) : (
            <>
              <Text style={styles.planPrice}>
                {PLAN_PRICE}
                <Text style={styles.planPricePer}>/Month</Text>
              </Text>
              <Text style={styles.planNote}>Cancel Anytime</Text>
              <TouchableOpacity
                style={styles.planBtn}
                onPress={handleSubscribe}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.planBtnText}>Subscribe To Become a Guide</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.footerNote}>
          You may cancel your mentor subscription anytime
        </Text>
      </ScrollView>

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  container: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 24 },

  planCard: {
    borderWidth: 2,
    borderColor: '#3B49F0',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  planMedal: { width: 72, height: 72, marginBottom: 16 },
  planName: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  planPrice: { fontSize: 34, fontWeight: '800', color: '#B5C334' },
  planPricePer: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
  planNote: { fontSize: 13, color: Colors.textMuted, marginTop: 4, marginBottom: 20 },
  planBtn: {
    backgroundColor: Colors.mentor,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  planBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  activeBadgeText: { fontSize: 14, fontWeight: '700', color: '#065F46' },

  footerNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },

  // Success
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successImage: { width: 150, height: 150, marginBottom: 28 },
  successTitle: { fontSize: 22, fontWeight: '800', color: Colors.mentor, marginBottom: 6, textAlign: 'center' },
  successSubtitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 16,
  },
  successBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  successFooter: { paddingHorizontal: 24, paddingBottom: 12 },
  continueBtn: { backgroundColor: Colors.mentor },
});
