import { describe, it, expect } from 'vitest';
import { getStoreGroupKey } from '../src/views/procurement/OnlineOrderCard';

describe('Precise Multi-Store Grouping Logic (getStoreGroupKey)', () => {
  it('groups items by Platform + StoreName when storeName exists', () => {
    const item1 = {
      id: 'it-1',
      name: 'Product A',
      platform: 'Shopee',
      storeName: 'Shop A'
    };
    const item2 = {
      id: 'it-2',
      name: 'Product B',
      platform: 'Shopee',
      storeName: 'Shop A'
    };
    const item3 = {
      id: 'it-3',
      name: 'Product C',
      platform: 'Shopee',
      storeName: 'Shop B'
    };

    const key1 = getStoreGroupKey(item1, 0);
    const key2 = getStoreGroupKey(item2, 1);
    const key3 = getStoreGroupKey(item3, 2);

    expect(key1).toBe('Shopee_shop a');
    expect(key2).toBe('Shopee_shop a');
    expect(key1).toBe(key2); // Same shop grouped together
    expect(key3).toBe('Shopee_shop b');
    expect(key1).not.toBe(key3); // Different shop separated
  });

  it('separates items on the same platform when store name is not given but URLs are different', () => {
    const item1 = {
      id: 'it-1',
      name: 'Screwdriver Set',
      platform: 'Shopee',
      productUrl: 'https://shopee.co.th/bosch_official_store/123456'
    };
    const item2 = {
      id: 'it-2',
      name: 'Drill Bits',
      platform: 'Shopee',
      productUrl: 'https://shopee.co.th/makita_tools_th/789012'
    };

    const key1 = getStoreGroupKey(item1, 0);
    const key2 = getStoreGroupKey(item2, 1);

    expect(key1).toBe('Shopee_bosch_official_store');
    expect(key2).toBe('Shopee_makita_tools_th');
    expect(key1).not.toBe(key2);
  });

  it('isolates items when neither store name nor URL exists (prevents blanket grouping)', () => {
    const item1 = {
      id: 'it-1',
      name: 'Item Alpha',
      platform: 'Shopee'
    };
    const item2 = {
      id: 'it-2',
      name: 'Item Beta',
      platform: 'Shopee'
    };

    const key1 = getStoreGroupKey(item1, 0);
    const key2 = getStoreGroupKey(item2, 1);

    expect(key1).toBe('Shopee_item_it-1');
    expect(key2).toBe('Shopee_item_it-2');
    expect(key1).not.toBe(key2);
  });

  it('ignores placeholder text like "ระบุร้านภายหลัง" when determining store key', () => {
    const item = {
      id: 'it-x',
      name: 'Generic Tool',
      platform: 'Shopee',
      actualStoreName: 'Shopee (ระบุร้านภายหลัง)'
    };

    const key = getStoreGroupKey(item, 5);
    expect(key).toBe('Shopee_item_it-x');
  });

  it('prefers actualStoreName over storeName and never uses item.name', () => {
    const item = {
      id: 'it-y',
      name: 'Actual Product Name',
      platform: 'Lazada',
      actualStoreName: 'Real Shop XYZ',
      storeName: 'Old Shop'
    };

    const key = getStoreGroupKey(item, 0);
    expect(key).toBe('Lazada_real shop xyz');
    expect(key).not.toContain('product');
  });
});
