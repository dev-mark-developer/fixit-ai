import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import type { DatingStackParamList } from '../../types/navigation';
import { datingApi } from '../../api/dating';
import AppAlert from '../../components/common/AppAlert';
import { Colors } from '../../utils/colors';

type Props = NativeStackScreenProps<DatingStackParamList, 'DatingPremium'>;

const PLAN_PRICE = '$20';

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

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<DatingSubscription | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const load = async () => {
    try {
      const res = await datingApi.getSubscription(datingType);
      const sub: DatingSubscription | null = res.data?.data ?? null;
      setSubscription(sub?.isActive ? sub : null);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datingType]);

  const handleSubscribe = () => {
    // In-app purchase flow is not configured for dating premium yet —
    // logged in API_CHANGES_NEEDED.
    setAlert({
      title: 'Coming Soon',
      message: 'In-app purchases for the premium plan are being set up. Please check back soon.',
    });
  };

  const handleCancel = () => {
    if (!subscription) return;
    setAlert(null);
    setCancelling(true);
    datingApi.cancelSubscription(subscription.id)
      .then(() => load())
      .catch(() => setAlert({ title: 'Error', message: 'Could not cancel your subscription. Please try again.' }))
      .finally(() => setCancelling(false));
  };

  const handleRestore = () => {
    setLoading(true);
    load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  const isActive = !!subscription;

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
              <Text style={[styles.planPrice, { color: accent }]}>{PLAN_PRICE}</Text>
              <Text style={styles.billingDate}>
                Billing Date: {new Date(subscription!.endDate).toLocaleDateString([], {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>

              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: lime }]}
                onPress={handleCancel}
                activeOpacity={0.85}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator color={accent} size="small" />
                  : <Text style={[styles.cancelBtnText, { color: accent }]}>Cancel Subscription</Text>}
              </TouchableOpacity>
              <Text style={styles.renewNote}>
                Your membership renews automatically. Cancel anytime
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.planTitle}>Upgrade to Premium</Text>
              <View style={styles.priceRow}>
                <Text style={[styles.planPrice, { color: accent }]}>{PLAN_PRICE}</Text>
                <Text style={[styles.perMonth, { color: accent }]}>/Month</Text>
              </View>
              <Text style={styles.cancelAnytime}>Cancel Anytime</Text>

              <TouchableOpacity
                style={[styles.subscribeBtn, { backgroundColor: accent }]}
                onPress={handleSubscribe}
                activeOpacity={0.85}
              >
                <Text style={styles.subscribeBtnText}>Subscribe Now!</Text>
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
          <TouchableOpacity onPress={handleRestore} activeOpacity={0.7}>
            <Text style={[styles.restore, { color: lime }]}>Restore Purchases</Text>
          </TouchableOpacity>
        )}
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
});
