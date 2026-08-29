import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './axios';

/**
 * Entitlement as the backend sees it. The response of
 * `GET /api/Subscription/status` is not typed in Swagger, so every field is
 * optional here and `normalizeSubscriptionStatus` tolerates the spellings the
 * backend is likely to use.
 */
export interface SubscriptionStatus {
  /** Whether the account may use premium features right now. */
  isActive: boolean;
  /** Active | Trial | GracePeriod | Expired | Cancelled | Revoked | None */
  status: string;
  productId?: string;
  planType?: string;
  /** ISO date the current period ends. */
  expiresAt?: string;
  autoRenewEnabled?: boolean;
  isTrialPeriod?: boolean;
  store?: string;
  originalTransactionId?: string;
}

/** Statuses that still grant access — grace period included, per the IAP doc. */
const ACTIVE_STATUSES = ['active', 'trial', 'graceperiod', 'grace', 'subscribed', 'cancelled'];

function pick<T>(row: any, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key] as T;
  }
  return undefined;
}

/**
 * `Cancelled` keeps access until the period ends, so an explicit `isActive`
 * from the backend always wins; the status string is only a fallback for when
 * the response doesn't carry one.
 */
export function normalizeSubscriptionStatus(raw: any): SubscriptionStatus {
  const row = raw?.data ?? raw ?? {};
  const status = String(
    pick<string>(row, 'status', 'subscriptionStatus', 'state') ?? 'None',
  );
  const expiresAt = pick<string>(row, 'expiresAt', 'expiryDate', 'expirationDate', 'endDate');
  const explicitActive = pick<boolean>(row, 'isActive', 'isSubscribed', 'hasActiveSubscription');
  const isExpired = pick<boolean>(row, 'isExpired');

  let isActive: boolean;
  if (typeof explicitActive === 'boolean') {
    isActive = explicitActive;
  } else if (typeof isExpired === 'boolean') {
    isActive = !isExpired;
  } else {
    isActive = ACTIVE_STATUSES.includes(status.toLowerCase().replace(/[\s_-]/g, ''));
  }

  // A period that has already ended never counts, whatever the flag says.
  if (isActive && expiresAt) {
    const end = Date.parse(expiresAt);
    if (!Number.isNaN(end) && end < Date.now()) isActive = false;
  }

  return {
    isActive,
    status,
    productId: pick<string>(row, 'productId', 'iapProductId'),
    planType: pick<string>(row, 'planType', 'plan'),
    expiresAt,
    autoRenewEnabled: pick<boolean>(row, 'autoRenewEnabled', 'isAutoRenewing', 'autoRenewStatus'),
    isTrialPeriod: pick<boolean>(row, 'isTrialPeriod', 'isTrial'),
    store: pick<string>(row, 'store'),
    originalTransactionId: pick<string>(row, 'originalTransactionId', 'transactionId'),
  };
}

/**
 * Last known entitlement, kept so a failed status read at launch can't show a
 * paying user the paywall. Scoped to the account that owns it — the next person
 * to sign in on this device must not inherit it.
 */
const CACHE_KEY = 'subscription_status_v1';

export async function cacheSubscriptionStatus(
  userId: number,
  status: SubscriptionStatus,
): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ userId, status })).catch(() => {});
}

export async function readCachedSubscriptionStatus(
  userId: number,
): Promise<SubscriptionStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.userId !== userId) return null;
    // Re-normalised rather than trusted as-is: a cached "active" whose period
    // has since ended has to come back expired.
    return normalizeSubscriptionStatus(parsed.status);
  } catch {
    return null;
  }
}

export async function clearCachedSubscriptionStatus(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

export const subscriptionApi = {
  /** Source of truth for entitlement — fed by the Apple server notifications. */
  getStatus: () => api.get('/subscription/status'),

  /**
   * Hands Apple's signed transaction (StoreKit 2 JWS) to the backend so it can
   * verify and re-grant entitlement without waiting for a webhook. Used by
   * "Restore Purchases".
   */
  restore: (signedTransactionInfo: string) =>
    api.post('/subscription/restore', { signedTransactionInfo }),
};
