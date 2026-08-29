import React, { useCallback, useEffect, useState } from 'react';
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
import AppAlert, { AlertButton } from '../../components/common/AppAlert';
import ActivatingSubscriptionModal from '../../components/common/ActivatingSubscriptionModal';
import { useSubscription } from '../../store/SubscriptionContext';
import { useAuth } from '../../store/AuthContext';
import { IAP_PRODUCT_ID, fetchSubscriptionProduct, isIapSupported } from '../../services/iap';

type Props = NativeStackScreenProps<MentorStackParamList, 'MentorSubscription'>;

const PLAN_PRICE_FALLBACK = '$20';

export default function MentorSubscriptionScreen({ route, navigation }: Props) {
  // The mandatory paywall right after mentor signup: nothing to go back to,
  // and the account can't reach the dashboard until it's paid.
  const gate = route.params?.gate ?? false;

  const { logout } = useAuth();
  const {
    status, isPremium, refresh, purchase, restore, checkPendingActivation,
  } = useSubscription();

  // Android has no billing integration yet, so it keeps reading the legacy
  // per-flow record and its stubbed purchase.
  const [androidSub, setAndroidSub] = useState<MentorSubscription | null>(null);
  const [fetching, setFetching] = useState(!isIapSupported);
  const [price, setPrice] = useState(PLAN_PRICE_FALLBACK);

  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activating, setActivating] = useState<'waiting' | 'timeout' | null>(null);
  const [checking, setChecking] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string; buttons?: AlertButton[] } | null>(null);

  useEffect(() => {
    if (isIapSupported) {
      refresh();
      // Real localised price straight off the store listing; the hardcoded
      // label is only what shows if the product can't be read.
      fetchSubscriptionProduct()
        .then((product) => { if (product?.displayPrice) setPrice(product.displayPrice); })
        .catch(() => {});
      return;
    }
    mentorApi.getSubscription()
      .then((res) => setAndroidSub(res.data?.data ?? null))
      .catch(() => setAndroidSub(null))
      .finally(() => setFetching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proceed = () => {
    if (gate) {
      // The gate is this stack's initial route, so there is nothing to pop —
      // hand the mentor their dashboard instead.
      navigation.replace('MentorMain');
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('MentorMain');
  };

  // ── iOS: real StoreKit purchase ───────────────────────────
  const handlePurchase = useCallback(async () => {
    setLoading(true);
    try {
      // The overlay goes up the moment Apple confirms payment and stays up
      // until the backend grants the entitlement.
      const outcome = await purchase(() => setActivating('waiting'));
      if (outcome === 'cancelled') return;
      if (outcome === 'active') {
        setActivating(null);
        setSuccess(true);
        return;
      }
      // Paid, but Apple's server notification hasn't reached our backend yet.
      setActivating('timeout');
    } catch (err: any) {
      setActivating(null);
      setAlert({
        title: 'Subscription Error',
        message: err?.message ?? 'Purchase could not be completed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [purchase]);

  // ── Android: unchanged stub until Play billing is wired up ─
  const handleAndroidStub = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    try {
      await mentorApi.recordSubscription({
        planType: 'Mentor',
        store: getPlatform() === 'iOS' ? 'Apple' : 'Google',
        iapProductId: IAP_PRODUCT_ID,
        iapTransactionId: `STUB_${Date.now()}`,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        isTrialPeriod: false,
      });
      setSuccess(true);
    } catch (err: any) {
      setAlert({
        title: 'Subscription Error',
        message: err.response?.data?.message ?? 'Purchase could not be completed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubscribe = isIapSupported ? handlePurchase : handleAndroidStub;

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const outcome = await restore();
      if (outcome === 'active') setSuccess(true);
      else setAlert({
        title: 'Nothing to Restore',
        message: 'We could not find an active subscription on this Apple ID.',
      });
    } catch {
      setAlert({ title: 'Restore Failed', message: 'Could not reach the App Store. Please try again.' });
    } finally {
      setRestoring(false);
    }
  }, [restore]);

  const handleCheckAgain = useCallback(async () => {
    setChecking(true);
    try {
      const active = await checkPendingActivation();
      if (active) {
        setActivating(null);
        setSuccess(true);
      } else {
        setAlert({
          title: 'Still Waiting',
          message: 'The App Store has not confirmed the purchase yet. Your payment is safe — try again in a few minutes, or use Restore Purchases.',
        });
      }
    } finally {
      setChecking(false);
    }
  }, [checkPendingActivation]);

  const confirmLogout = () =>
    setAlert({
      title: 'Sign Out',
      message: 'You can subscribe next time you sign in.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => { logout(); } },
      ],
    });

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.mentor} />
      </View>
    );
  }

  const isActive = isIapSupported
    ? isPremium
    : !!androidSub && !androidSub.isExpired;
  const renewsAt = isIapSupported ? status?.expiresAt : androidSub?.endDate;

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
      {/* Header — the gate has no way back, only a way out of the account. */}
      <View style={[styles.header, gate && styles.headerGate]}>
        {gate ? (
          <TouchableOpacity onPress={confirmLogout} hitSlop={8}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigation.canGoBack() && navigation.goBack()} hitSlop={8}>
            <Icon name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Subscription Plan</Text>

        {gate && !isActive && (
          <Text style={styles.gateNote}>
            A subscription is required to guide seekers. Subscribe to unlock
            your mentor dashboard.
          </Text>
        )}

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
              {!!renewsAt && (
                <Text style={styles.planNote}>
                  Renews on {new Date(renewsAt).toLocaleDateString()}
                </Text>
              )}
              <AppButton
                title="Manage Subscription"
                onPress={() => setAlert({ title: 'Manage Subscription', message: 'To cancel or change your plan, go to your device\'s subscription settings (App Store or Google Play).' })}
                style={styles.planBtn}
              />
            </>
          ) : (
            <>
              <Text style={styles.planPrice}>
                {price}
                <Text style={styles.planPricePer}>/Month</Text>
              </Text>
              <Text style={styles.planNote}>Cancel Anytime</Text>
              <TouchableOpacity
                style={styles.planBtn}
                onPress={handleSubscribe}
                disabled={loading || restoring}
                activeOpacity={0.9}
              >
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.planBtnText}>Subscribe To Become a Guide</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Apple requires a restore path for any non-consumable purchase. */}
        {isIapSupported && !isActive && (
          <TouchableOpacity
            onPress={handleRestore}
            disabled={loading || restoring}
            activeOpacity={0.7}
          >
            {restoring
              ? <ActivityIndicator color={Colors.mentor} style={styles.restoreSpinner} />
              : <Text style={styles.restore}>Restore Purchases</Text>}
          </TouchableOpacity>
        )}

        <Text style={styles.footerNote}>
          You may cancel your mentor subscription anytime
        </Text>
      </ScrollView>

      <ActivatingSubscriptionModal
        visible={activating !== null}
        accent={Colors.mentor}
        phase={activating ?? 'waiting'}
        checking={checking}
        onCheckAgain={handleCheckAgain}
        onDismiss={() => setActivating(null)}
      />

      <AppAlert
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message}
        buttons={alert?.buttons}
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

  headerGate: { alignItems: 'flex-end' },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.mentor },
  gateNote: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginTop: -12,
    marginBottom: 20,
  },
  restore: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: Colors.mentor,
    textDecorationLine: 'underline',
    marginTop: 20,
  },
  restoreSpinner: { marginTop: 20 },

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
