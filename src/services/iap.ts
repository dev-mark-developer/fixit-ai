import { Platform } from 'react-native';
import {
  ErrorCode,
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type EventSubscription,
  type ProductSubscription,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';

/**
 * The single auto-renewing subscription behind every paid surface in the app —
 * the mentor programme and dating premium share one entitlement.
 */
export const IAP_PRODUCT_ID = 'com.monthly';

/** IAP is iOS-only for now; Android keeps its existing stub behaviour. */
export const isIapSupported = Platform.OS === 'ios';

/**
 * Dev-only trace of the whole StoreKit round-trip. Purchases fail for reasons
 * that are invisible from the UI — a product the store doesn't know, a webhook
 * that never lands, an entitlement that reads back inactive — so each step
 * announces itself with the values you would otherwise have to guess at.
 *
 * Stripped in release builds; nothing here should run in front of a user.
 */
export function iapLog(step: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (detail === undefined) { console.log(`[iap] ${step}`); return; }
  console.log(`[iap] ${step}`, detail);
}

/** Errors carry their useful bits on different fields depending on the layer. */
function describeError(err: any): Record<string, unknown> {
  return {
    code: err?.code ?? '(none)',
    message: err?.message ?? String(err),
    productId: err?.productId,
    responseCode: err?.responseCode,
    debugMessage: err?.debugMessage,
  };
}

export class IapCancelledError extends Error {
  constructor() {
    super('Purchase cancelled');
    this.name = 'IapCancelledError';
  }
}

export class IapUnavailableError extends Error {
  constructor(message = 'In-app purchases are not available on this device.') {
    super(message);
    this.name = 'IapUnavailableError';
  }
}

/**
 * StoreKit has no product with our id in whatever environment the app is
 * running against. The raw error reads "SKU not found", which tells nobody
 * anything, so it is rewritten into the three things that actually cause it.
 */
export class IapProductMissingError extends Error {
  constructor() {
    super(
      `The "${IAP_PRODUCT_ID}" subscription isn't available in this environment. ` +
      'On a simulator, pick the StoreKit configuration file in Edit Scheme → Run → Options. ' +
      'On a device, the product must exist in App Store Connect and be at least "Ready to Submit", ' +
      'and the build must be signed with the matching bundle id.',
    );
    this.name = 'IapProductMissingError';
  }
}

/** True for the various ways StoreKit reports "I don't know that product". */
function isMissingProductError(err: any): boolean {
  const code = err?.code;
  if (code === ErrorCode.SkuNotFound || code === ErrorCode.SkuNotFound.toString()) return true;
  const text = `${code ?? ''} ${err?.message ?? ''}`.toLowerCase();
  return text.includes('sku-not-found') || text.includes('sku not found');
}

type Deferred = {
  resolve: (purchase: Purchase) => void;
  reject: (error: Error) => void;
};

let connected = false;
let connecting: Promise<void> | null = null;
let updateSub: EventSubscription | null = null;
let errorSub: EventSubscription | null = null;

/** Set only while a purchase this session is in flight. */
let pending: Deferred | null = null;

/**
 * Transactions StoreKit replays without us asking — an unfinished purchase from
 * a previous launch, or a renewal that landed while the app was open. The
 * subscription store registers a handler so entitlement can be re-checked.
 */
let replayHandler: ((purchase: Purchase) => void) | null = null;

export function onReplayedPurchase(handler: (purchase: Purchase) => void): () => void {
  replayHandler = handler;
  return () => {
    if (replayHandler === handler) replayHandler = null;
  };
}

function describePurchase(p: Purchase): Record<string, unknown> {
  return {
    id: (p as any).id ?? (p as any).transactionId,
    productId: (p as any).productId ?? (p as any).id,
    transactionDate: (p as any).transactionDate,
    hasSignedTransaction: Boolean(getSignedTransaction(p)),
  };
}

function handlePurchaseUpdate(purchase: Purchase) {
  if (pending) {
    const deferred = pending;
    pending = null;
    iapLog('purchase: Apple confirmed payment', describePurchase(purchase));
    deferred.resolve(purchase);
    return;
  }
  // No one is waiting — StoreKit is replaying an unfinished transaction from a
  // previous launch, or a renewal landed while the app was open.
  iapLog('purchase: replayed by StoreKit (not from a tap)', describePurchase(purchase));
  replayHandler?.(purchase);
}

function handlePurchaseError(error: PurchaseError) {
  if (!pending) return;
  const deferred = pending;
  pending = null;
  iapLog('purchase: StoreKit reported an error', describeError(error));
  if (error.code === ErrorCode.UserCancelled) { deferred.reject(new IapCancelledError()); return; }
  if (isMissingProductError(error)) { deferred.reject(new IapProductMissingError()); return; }
  deferred.reject(new Error(error.message || 'The purchase could not be completed.'));
}

/**
 * Opens the StoreKit connection and registers the listeners exactly once.
 * Safe to call repeatedly — concurrent callers share the same in-flight promise.
 */
export async function initIap(): Promise<void> {
  if (!isIapSupported) throw new IapUnavailableError();
  if (connected) return;
  if (connecting) return connecting;

  connecting = (async () => {
    iapLog('connect: opening StoreKit connection');
    await initConnection();
    // Registered after connecting so a replayed transaction can't arrive before
    // the handlers exist.
    updateSub = purchaseUpdatedListener(handlePurchaseUpdate);
    errorSub = purchaseErrorListener(handlePurchaseError);
    connected = true;
    iapLog('connect: connected, listeners registered');
  })();

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

export async function shutdownIap(): Promise<void> {
  if (!connected) return;
  updateSub?.remove();
  errorSub?.remove();
  updateSub = null;
  errorSub = null;
  connected = false;
  pending = null;
  await endConnection().catch(() => {});
}

/** Store metadata for the plan — used for the real localised price. */
export async function fetchSubscriptionProduct(): Promise<ProductSubscription | null> {
  if (!isIapSupported) return null;
  await initIap();
  iapLog('fetch: requesting products', { skus: [IAP_PRODUCT_ID], type: 'subs' });

  let products;
  try {
    products = await fetchProducts({ skus: [IAP_PRODUCT_ID], type: 'subs' });
  } catch (err) {
    iapLog('fetch: FAILED', describeError(err));
    throw err;
  }

  const list = (products ?? []) as ProductSubscription[];
  iapLog('fetch: store returned', {
    count: list.length,
    ids: list.map((p) => p.id),
  });

  const found = list.find((p) => p.id === IAP_PRODUCT_ID) ?? list[0] ?? null;
  if (found) {
    iapLog('fetch: using product', {
      id: found.id,
      displayPrice: (found as any).displayPrice,
      currency: (found as any).currency,
      title: (found as any).title,
    });
  } else {
    // Callers fall back to the hard-coded price, so an empty result is
    // otherwise invisible right up until Subscribe fails with "SKU not found".
    iapLog('fetch: NO PRODUCT — this is what makes Subscribe fail', {
      requested: IAP_PRODUCT_ID,
      why: new IapProductMissingError().message,
    });
  }
  return found;
}

/**
 * Runs Apple's purchase sheet and resolves with the transaction once StoreKit
 * confirms it. The transaction is deliberately left unfinished — the caller
 * finishes it only after the backend has granted entitlement, so a purchase
 * whose webhook never lands replays on the next launch instead of being lost.
 *
 * @throws {IapCancelledError} when the user dismisses the sheet.
 */
export async function purchaseSubscription(appAccountToken: string): Promise<Purchase> {
  if (!isIapSupported) throw new IapUnavailableError();
  await initIap();

  if (pending) throw new Error('A purchase is already in progress.');

  iapLog('purchase: presenting Apple sheet', {
    sku: IAP_PRODUCT_ID,
    // Logged deliberately: this is the value the store webhook must match back
    // to an account, so a mismatch here is the first thing to check.
    appAccountToken,
  });

  return new Promise<Purchase>((resolve, reject) => {
    pending = { resolve, reject };
    requestPurchase({
      type: 'subs',
      request: {
        apple: {
          sku: IAP_PRODUCT_ID,
          appAccountToken,
          // Left false so the transaction survives until the backend confirms.
          andDangerouslyFinishTransactionAutomatically: false,
        },
      },
    }).catch((err: any) => {
      if (pending?.reject !== reject) return; // already settled by a listener
      pending = null;
      iapLog('purchase: request rejected', describeError(err));
      if (err?.code === ErrorCode.UserCancelled) { reject(new IapCancelledError()); return; }
      if (isMissingProductError(err)) { reject(new IapProductMissingError()); return; }
      reject(new Error(err?.message ?? 'The purchase could not be started.'));
    });
  });
}

/** Removes the transaction from StoreKit's queue. Call once entitlement is granted. */
export async function finishPurchase(purchase: Purchase): Promise<void> {
  if (!isIapSupported) return;
  iapLog('finish: closing transaction now entitlement is granted', describePurchase(purchase));
  await finishTransaction({ purchase, isConsumable: false }).catch((err) => {
    iapLog('finish: failed (harmless if already finished)', describeError(err));
  });
}

/**
 * The active entitlement StoreKit currently holds for this Apple ID, if any.
 * This is what "Restore Purchases" reads.
 */
export async function getActiveSubscriptionPurchase(): Promise<Purchase | null> {
  if (!isIapSupported) return null;
  await initIap();
  iapLog('restore: asking StoreKit what this Apple ID owns');
  const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
  const all = purchases ?? [];
  const owned = all.filter((p) => p.productId === IAP_PRODUCT_ID);
  iapLog('restore: StoreKit returned', {
    total: all.length,
    matching: owned.length,
    ids: all.map((p) => p.productId),
  });
  if (owned.length === 0) return null;
  // Newest first — a resubscribe leaves older transactions behind it.
  const newest = owned.sort((a, b) => (b.transactionDate ?? 0) - (a.transactionDate ?? 0))[0];
  iapLog('restore: using newest entitlement', describePurchase(newest));
  return newest;
}

/**
 * Apple's signed transaction (StoreKit 2 JWS). This is what
 * `POST /subscription/restore` verifies, so a purchase without one can't be
 * restored server-side.
 */
export function getSignedTransaction(purchase: Purchase | null | undefined): string | null {
  return purchase?.purchaseToken ?? null;
}
