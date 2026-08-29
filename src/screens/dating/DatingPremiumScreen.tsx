import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import type { DatingStackParamList } from '../../types/navigation';
import { datingApi } from '../../api/dating';
import AppAlert from '../../components/common/AppAlert';
import ActivatingSubscriptionModal from '../../components/common/ActivatingSubscriptionModal';
import { Colors } from '../../utils/colors';
import { useSubscription } from '../../store/SubscriptionContext';
import { fetchSubscriptionProduct, isIapSupported } from '../../services/iap';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingPremium'>;

const PLAN_PRICE_FALLBACK = '$20';

const PLAN_FEATURES = [
  'Unlimited Likes',
  'Advance Filters',
  'Unlimited Matches',
  'See Everyone Who Likes You',
  'Ice Breaker questions setup',
  'No ads',
  'Priority Support',
];

interface DatingSubscription {
  id: number;
  planType: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export default function DatingPremiumScreen({ route, navigation }: Props) {
  const { datingType } = route.params;
  const isSpiritual = datingType === 'Spiritual';
  const accent = isSpiritual ? Colors.spiritual : Colors.dating;
  const lime = isSpiritual ? Colors.spiritualLime : Colors.datingSecondary;

  const {
    status, isPremium, refresh, purchase, restore, checkPendingActivation,
  } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState(PLAN_PRICE_FALLBACK);
  // Android has no billing integration yet, so it keeps reading the legacy
  // per-flow dating record and its "coming soon" subscribe button.
  const [androidSub, setAndroidSub] = useState<DatingSubscription | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [activating, setActivating] = useState<'waiting' | 'timeout' | null>(null);
  const [checking, setChecking] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      if (isIapSupported) {
        await refresh();
        return;
      }
      const res = await datingApi.getSubscription(datingType);
      const sub: DatingSubscription | null = res.data?.data ?? null;
      setAndroidSub(sub?.isActive ? sub : null);
    } catch {
      setAndroidSub(null);
    } finally {
      setLoading(false);
    }
  }, [datingType, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isIapSupported) return;
    // Real localised price straight off the store listing.
    fetchSubscriptionProduct()
      .then((product) => { if (product?.displayPrice) setPrice(product.displayPrice); })
      .catch(() => {});
  }, []);

  const handleSubscribe = useCallback(async () => {
    if (!isIapSupported) {
      // Play billing isn't wired up yet — logged in API_CHANGES_NEEDED.
      setAlert({
        title: 'Coming Soon',
        message: 'In-app purchases for the premium plan are being set up. Please check back soon.',
      });
      return;
    }
    setPurchasing(true);
    try {
      // The overlay goes up the moment Apple confirms payment and stays up
      // until the backend grants the entitlement.
      const outcome = await purchase(() => setActivating('waiting'));
      if (outcome === 'cancelled') return;
      if (outcome === 'active') {
        setActivating(null);
        setAlert({ title: 'You\'re Premium!', message: 'Unlimited swipes, advance filters and everyone who likes you are unlocked.' });
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
      setPurchasing(false);
    }
  }, [purchase]);

  const handleCheckAgain = useCallback(async () => {
    setChecking(true);
    try {
      const active = await checkPendingActivation();
      if (active) {
        setActivating(null);
        setAlert({ title: 'You\'re Premium!', message: 'Your subscription is now active.' });
      } else {
        setAlert({
          title: 'Still Waiting',
          message: 'The App Store has not confirmed the purchase yet. Your payment is safe — try again in a few minutes.',
        });
      }
    } finally {
      setChecking(false);
    }
  }, [checkPendingActivation]);

  const handleCancel = () => {
    setAlert(null);
    if (isIapSupported) {
      // Apple owns the cancellation flow for auto-renewing subscriptions.
      setAlert({
        title: 'Manage Subscription',
        message: 'To cancel or change your plan, open Settings → Apple ID → Subscriptions on your device.',
      });
      return;
    }
    if (!androidSub) return;
    setCancelling(true);
    datingApi.cancelSubscription(androidSub.id)
      .then(() => load())
      .catch(() => setAlert({ title: 'Error', message: 'Could not cancel your subscription. Please try again.' }))
      .finally(() => setCancelling(false));
  };

  const handleRestore = useCallback(async () => {
    if (!isIapSupported) {
      setLoading(true);
      load();
      return;
    }
    setRestoring(true);
    try {
      const outcome = await restore();
      setAlert(outcome === 'active'
        ? { title: 'Subscription Restored', message: 'Your premium access is active again.' }
        : { title: 'Nothing to Restore', message: 'We could not find an active subscription on this Apple ID.' });
    } catch {
      setAlert({ title: 'Restore Failed', message: 'Could not reach the App Store. Please try again.' });
    } finally {
      setRestoring(false);
    }
  }, [load, restore]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  const isActive = isIapSupported ? isPremium : !!androidSub;
  const renewsAt = isIapSupported ? status?.expiresAt : androidSub?.endDate;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Subscription Plan</Text>

        <View style={[styles.planCard, { borderColor: accent }]}>
          <Image
            source={require('../../assets/crown.png')}
            style={styles.medal}
            resizeMode="contain"
          />

          {isActive ? (
            <>
              <Text style={styles.planTitle}>My Plan Details</Text>
              <Text style={[styles.planPeriod, { color: accent }]}>Monthly</Text>
              <Text style={[styles.planPrice, { color: accent }]}>{price}</Text>
              {!!renewsAt && (
                <Text style={styles.billingDate}>
                  Billing Date: {new Date(renewsAt).toLocaleDateString([], {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: lime }]}
                onPress={handleCancel}
                activeOpacity={0.85}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator color={accent} size="small" />
                  : (
                    <Text style={[styles.cancelBtnText, { color: accent }]}>
                      {isIapSupported ? 'Manage Subscription' : 'Cancel Subscription'}
                    </Text>
                  )}
              </TouchableOpacity>
              <Text style={styles.renewNote}>
                Your membership renews automatically. Cancel anytime
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.planTitle}>Upgrade to Premium</Text>
              <View style={styles.priceRow}>
                <Text style={[styles.planPrice, { color: accent }]}>{price}</Text>
                <Text style={[styles.perMonth, { color: accent }]}>/Month</Text>
              </View>
              <Text style={styles.cancelAnytime}>Cancel Anytime</Text>

              <TouchableOpacity
                style={[styles.subscribeBtn, { backgroundColor: accent }]}
                onPress={handleSubscribe}
                disabled={purchasing || restoring}
                activeOpacity={0.85}
              >
                {purchasing
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.subscribeBtnText}>Subscribe Now!</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* Features */}
          <View style={styles.features}>
            {PLAN_FEATURES.map((f, i) => (
              <View key={f} style={[styles.featureRow, i > 0 && styles.featureDivider]}>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {!isActive && (
          <TouchableOpacity
            onPress={handleRestore}
            disabled={purchasing || restoring}
            activeOpacity={0.7}
          >
            {restoring
              ? <ActivityIndicator color={lime} style={styles.restoreSpinner} />
              : <Text style={[styles.restore, { color: lime }]}>Restore Purchases</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>

      <ActivatingSubscriptionModal
        visible={activating !== null}
        accent={accent}
        phase={activating ?? 'waiting'}
        checking={checking}
        onCheckAgain={handleCheckAgain}
        onDismiss={() => setActivating(null)}
      />

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
  headerBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  container: { padding: 24, paddingTop: 8, paddingBottom: 40 },

  title: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 20 },

  planCard: {
    borderWidth: 1.5,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  medal: { width: 74, height: 74, marginBottom: 14 },

  planTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  planPeriod: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
  planPrice: { fontSize: 42, fontWeight: '800' },
  perMonth: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginLeft: 2 },
  cancelAnytime: { fontSize: 12, color: Colors.textMuted, marginBottom: 18 },
  billingDate: { fontSize: 13, color: Colors.text, marginTop: 6, marginBottom: 18 },

  subscribeBtn: {
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 6,
  },
  subscribeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  cancelBtn: {
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 8,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700' },
  renewNote: { fontSize: 12, color: Colors.text, textAlign: 'center', marginBottom: 6 },

  features: { alignSelf: 'stretch', marginTop: 12 },
  featureRow: { paddingVertical: 13, alignItems: 'center' },
  featureDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  featureText: { fontSize: 14, color: Colors.text },

  restore: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginTop: 18,
  },
  restoreSpinner: { marginTop: 18 },
});
