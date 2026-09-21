jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/api/axios', () => ({ __esModule: true, default: {} }));

import { normalizeSubscriptionStatus, statusGrants } from '../src/api/subscription';
import {
  DATING_PRODUCT_IDS,
  MENTOR_PRODUCT_ID,
  groupOfProduct,
  productsInGroup,
} from '../src/utils/subscriptionProducts';

const active = (productId?: string) =>
  normalizeSubscriptionStatus({ status: 'Active', productId });

describe('groupOfProduct', () => {
  it('puts both dating plans in one group and the mentor plan in its own', () => {
    expect(groupOfProduct(DATING_PRODUCT_IDS.NonSpiritual)).toBe('dating');
    expect(groupOfProduct(DATING_PRODUCT_IDS.Spiritual)).toBe('dating');
    expect(groupOfProduct(MENTOR_PRODUCT_ID)).toBe('mentor');
  });

  it('knows nothing of other products', () => {
    expect(groupOfProduct('com.something.else')).toBeNull();
    expect(groupOfProduct(undefined)).toBeNull();
  });

  it('restores within one group only', () => {
    expect(productsInGroup('mentor')).toEqual(['com.monthly']);
    expect(productsInGroup('dating')).toEqual(
      expect.arrayContaining(['com.nonspiritual.monthly', 'com.spiritual.monthly']),
    );
  });
});

describe('statusGrants', () => {
  it('unlocks only the group the subscription belongs to', () => {
    // The bug this guards: com.monthly used to unlock dating premium as well.
    expect(statusGrants(active('com.monthly'), 'mentor')).toBe(true);
    expect(statusGrants(active('com.monthly'), 'dating')).toBe(false);
    expect(statusGrants(active('com.spiritual.monthly'), 'dating')).toBe(true);
    expect(statusGrants(active('com.nonspiritual.monthly'), 'mentor')).toBe(false);
  });

  it('never unlocks anything without an active subscription', () => {
    expect(statusGrants(null, 'dating')).toBe(false);
    expect(
      statusGrants(normalizeSubscriptionStatus({ status: 'Expired', productId: 'com.monthly' }), 'mentor'),
    ).toBe(false);
  });

  it('does not lock out a payer when the status names no product', () => {
    expect(statusGrants(active(undefined), 'mentor')).toBe(true);
    expect(statusGrants(active(undefined), 'dating')).toBe(true);
  });

  it('grants nothing for a product this build does not sell', () => {
    expect(statusGrants(active('com.old.product'), 'dating')).toBe(false);
  });
});
