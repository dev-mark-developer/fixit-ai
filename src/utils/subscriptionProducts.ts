import type { DatingType } from '../store/ModuleStatusContext';

/**
 * The App Store subscription groups. A user holds at most one subscription per
 * group, so a mentor who also dates can have both, while switching dating type
 * swaps one dating plan for the other instead of charging twice.
 */
export type SubscriptionGroup = 'mentor' | 'dating';

/** The mentor programme. The id dates from when one product covered everything. */
export const MENTOR_PRODUCT_ID = 'com.monthly';

/** Dating premium: one product per dating type, both in the dating group. */
export const DATING_PRODUCT_IDS: Record<DatingType, string> = {
  NonSpiritual: 'com.nonspiritual.monthly',
  Spiritual: 'com.spiritual.monthly',
};

const GROUP_PRODUCTS: Record<SubscriptionGroup, readonly string[]> = {
  mentor: [MENTOR_PRODUCT_ID],
  dating: Object.values(DATING_PRODUCT_IDS),
};

export function productsInGroup(group: SubscriptionGroup): readonly string[] {
  return GROUP_PRODUCTS[group];
}

/** Null for a product this build doesn't sell. */
export function groupOfProduct(productId?: string | null): SubscriptionGroup | null {
  if (!productId) return null;
  const groups = Object.keys(GROUP_PRODUCTS) as SubscriptionGroup[];
  return groups.find((g) => GROUP_PRODUCTS[g].includes(productId)) ?? null;
}
