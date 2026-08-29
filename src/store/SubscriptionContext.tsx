import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import type { Purchase } from 'react-native-iap';
import { useAuth } from './AuthContext';
import { iapLog } from '../services/iap';
import {
  SubscriptionStatus,
  cacheSubscriptionStatus,
  clearCachedSubscriptionStatus,
  normalizeSubscriptionStatus,
  readCachedSubscriptionStatus,
  subscriptionApi,
} from '../api/subscription';
import {
  IapCancelledError,
  finishPurchase,
  getActiveSubscriptionPurchase,
  getSignedTransaction,
  initIap,
  isIapSupported,
  onReplayedPurchase,
  purchaseSubscription,
  shutdownIap,
} from '../services/iap';
import { resolveAppAccountToken } from '../utils/appAccountToken';

/** How long to wait for Apple's server notification to reach our backend. */
const ACTIVATION_TIMEOUT_MS = 30_000;
const ACTIVATION_POLL_MS = 2_000;

export type PurchaseOutcome =
  /** Backend confirmed the entitlement — premium is live. */
  | 'active'
  /** Apple took the payment but the webhook hasn't landed yet. */
  | 'pending'
  /** User dismissed the Apple sheet. */
  | 'cancelled';

export type RestoreOutcome = 'active' | 'none';

interface SubscriptionContextType {
  status: SubscriptionStatus | null;
  /** True while the first status read is in flight. */
  loading: boolean;
  /** The one entitlement gating the mentor programme and dating premium. */
  isPremium: boolean;
  /** Whether a purchase can actually be started on this device. */
  canPurchase: boolean;
  refresh: () => Promise<SubscriptionStatus | null>;
  /**
   * @param onAwaitingActivation fires the moment Apple confirms payment, before
   *   the wait for the webhook begins — that gap is what the caller covers with
   *   the "Activating your subscription…" overlay.
   */
  purchase: (onAwaitingActivation?: () => void) => Promise<PurchaseOutcome>;
  restore: () => Promise<RestoreOutcome>;
  /**
   * Re-polls after a purchase that timed out waiting for the webhook.
   * Returns true once the backend reports the entitlement.
   */
  checkPendingActivation: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { authenticated, user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * A transaction Apple confirmed but the backend hasn't acknowledged. It stays
   * unfinished on the StoreKit queue so it replays on the next launch, and is
   * finished as soon as entitlement shows up.
   */
  const unconfirmedRef = useRef<Purchase | null>(null);

  // Only the newest status read may write state.
  const reqRef = useRef(0);

  // Read inside `readStatus` so caching doesn't make it depend on `user` —
  // every consumer's useCallback chain hangs off its identity.
  const userIdRef = useRef<number | null>(null);
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user?.id]);

  /** Set once a live read has written state, so the cache stops being applied. */
  const liveLandedRef = useRef(false);

  const readStatus = useCallback(async (): Promise<SubscriptionStatus | null> => {
    const reqId = ++reqRef.current;
    try {
      const res = await subscriptionApi.getStatus();
      const next = normalizeSubscriptionStatus(res.data);
      iapLog('status: backend replied', {
        isActive: next.isActive,
        status: next.status,
        expiresAt: next.expiresAt,
        // The untyped raw body, so a field we failed to normalise is visible
        // rather than silently read as "not subscribed" (gap #21).
        raw: res.data,
      });
      if (reqId !== reqRef.current) return next;
      liveLandedRef.current = true;
      setStatus(next);
      if (userIdRef.current !== null) cacheSubscriptionStatus(userIdRef.current, next);
      return next;
    } catch (err: any) {
      if (reqId !== reqRef.current) return null;
      iapLog('status: read FAILED (keeping last known entitlement)', {
        httpStatus: err?.response?.status,
        message: err?.message,
      });
      // A failed read must not silently downgrade a user who is subscribed —
      // keep whatever we last knew rather than flipping them to locked.
      return null;
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setStatus(null);
      setLoading(false);
      return null;
    }
    return readStatus();
  }, [authenticated, readStatus]);

  // Initial read, and a re-read whenever the signed-in account changes. The
  // cached entitlement is painted first so a slow or failed read can't flash
  // the paywall at someone who is already paying.
  useEffect(() => {
    if (!authenticated || !user) {
      setStatus(null);
      setLoading(false);
      unconfirmedRef.current = null;
      clearCachedSubscriptionStatus();
      return;
    }

    let cancelled = false;
    const userId = user.id;
    liveLandedRef.current = false;
    setLoading(true);
    readCachedSubscriptionStatus(userId).then((cached) => {
      // The live read is authoritative — only seed if it hasn't landed yet.
      if (!cancelled && cached && !liveLandedRef.current) setStatus(cached);
    });
    readStatus();

    return () => { cancelled = true; };
  }, [authenticated, user, readStatus]);

  /** Finish the held transaction once the backend agrees the user is entitled. */
  const settleUnconfirmed = useCallback(async () => {
    const held = unconfirmedRef.current;
    if (!held) return;
    unconfirmedRef.current = null;
    await finishPurchase(held);
  }, []);

  const pollUntilActive = useCallback(async (): Promise<boolean> => {
    const startedAt = Date.now();
    const deadline = startedAt + ACTIVATION_TIMEOUT_MS;
    let attempt = 0;
    iapLog('activation: waiting for the store webhook to grant entitlement', {
      timeoutMs: ACTIVATION_TIMEOUT_MS,
      pollMs: ACTIVATION_POLL_MS,
    });
    // First read goes out immediately — a fast webhook shouldn't cost 2s.
    for (;;) {
      attempt += 1;
      const next = await readStatus();
      const elapsedMs = Date.now() - startedAt;
      if (next?.isActive) {
        iapLog('activation: GRANTED', { attempt, elapsedMs });
        return true;
      }
      if (Date.now() + ACTIVATION_POLL_MS >= deadline) {
        iapLog('activation: TIMED OUT — webhook never granted entitlement', {
          attempts: attempt,
          elapsedMs,
          note: 'Transaction left unfinished, so StoreKit replays it next launch.',
        });
        return false;
      }
      iapLog('activation: still not active, retrying', { attempt, elapsedMs });
      await new Promise<void>((r) => { setTimeout(r, ACTIVATION_POLL_MS); });
    }
  }, [readStatus]);

  const purchase = useCallback(async (
    onAwaitingActivation?: () => void,
  ): Promise<PurchaseOutcome> => {
    if (!user) throw new Error('You need to be signed in to subscribe.');

    const appAccountToken = resolveAppAccountToken(user.id, user.appAccountToken);

    iapLog('subscribe: starting', { userId: user.id, appAccountToken });

    let bought: Purchase;
    try {
      bought = await purchaseSubscription(appAccountToken);
    } catch (err) {
      if (err instanceof IapCancelledError) {
        iapLog('subscribe: cancelled by user');
        return 'cancelled';
      }
      iapLog('subscribe: FAILED', { message: (err as any)?.message });
      throw err;
    }

    // Paid. Everything from here is waiting on Apple's server notification.
    unconfirmedRef.current = bought;
    onAwaitingActivation?.();
    const active = await pollUntilActive();
    if (active) {
      await settleUnconfirmed();
      iapLog('subscribe: done — entitlement active');
      return 'active';
    }
    iapLog('subscribe: paid but pending — showing the "taking longer" state');
    return 'pending';
  }, [user, pollUntilActive, settleUnconfirmed]);

  const checkPendingActivation = useCallback(async () => {
    const next = await readStatus();
    if (next?.isActive) {
      await settleUnconfirmed();
      return true;
    }
    return false;
  }, [readStatus, settleUnconfirmed]);

  /**
   * Reads the entitlement StoreKit holds for this Apple ID and hands Apple's
   * signed transaction to the backend, which verifies it and re-grants access
   * without waiting on a webhook.
   */
  const restore = useCallback(async (): Promise<RestoreOutcome> => {
    if (!isIapSupported) return 'none';

    const owned = await getActiveSubscriptionPurchase();
    const jws = getSignedTransaction(owned);
    if (!owned || !jws) {
      iapLog('restore: nothing usable on device, asking the backend', {
        hasPurchase: Boolean(owned),
        hasSignedTransaction: Boolean(jws),
      });
      // Nothing on the device, but the backend may still know better.
      const next = await readStatus();
      return next?.isActive ? 'active' : 'none';
    }

    iapLog('restore: sending signed transaction to the backend', {
      jwsLength: jws.length,
    });
    try {
      await subscriptionApi.restore(jws);
      iapLog('restore: backend accepted the transaction');
    } catch (err: any) {
      iapLog('restore: backend rejected it', {
        httpStatus: err?.response?.status,
        message: err?.message,
      });
      // Verification is the backend's call; fall through and read the status,
      // which is the only thing that decides access.
    }

    const next = await readStatus();
    if (next?.isActive) {
      unconfirmedRef.current = owned;
      await settleUnconfirmed();
      return 'active';
    }
    return 'none';
  }, [readStatus, settleUnconfirmed]);

  /**
   * StoreKit replays anything left unfinished on launch, plus renewals that
   * land while the app is open. Both mean "re-read entitlement".
   */
  useEffect(() => {
    if (!authenticated || !isIapSupported) return;

    initIap().catch(() => {});

    const off = onReplayedPurchase((replayed) => {
      unconfirmedRef.current = replayed;
      readStatus().then((next) => {
        if (next?.isActive) settleUnconfirmed();
      });
    });

    return () => {
      off();
      shutdownIap().catch(() => {});
    };
  }, [authenticated, readStatus, settleUnconfirmed]);

  return (
    <SubscriptionContext.Provider
      value={{
        status,
        loading,
        isPremium: !!status?.isActive,
        canPurchase: isIapSupported,
        refresh,
        purchase,
        restore,
        checkPendingActivation,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
