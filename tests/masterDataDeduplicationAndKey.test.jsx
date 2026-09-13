import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { deduplicateMasterData, isBlacklistedProduct, DUMMY_BLACKLIST } from '../src/views/MasterDataView.jsx';
import MasterDataView from '../src/views/MasterDataView.jsx';
import { storageService } from '../src/services/storageService.js';
import { MasterDataProvider, useMasterDataContext } from '../src/context/MasterDataContext.jsx';

describe('Master Data Deduplication & React Key Collision Guard', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. deduplicateMasterData helper function', () => {
    it('deduplicates items by code and id (case-insensitive and trimmed)', () => {
      const dirtyList = [
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1' },
        { id: 'PROD-TEST-01', code: 't01', name: 'Test Item 1 duplicate' },
        { id: 'PROD-TEST-02', code: 'T02', name: 'Test Item 2' },
        { id: 'PROD-TEST-02', code: '  T02  ', name: 'Test Item 2 duplicate' },
        { id: 'PROD-TEST-03', code: 'T03', name: 'Test Item 3' }
      ];

      const cleanList = deduplicateMasterData(dirtyList);
      expect(cleanList.length).toBe(3);
      expect(cleanList.map(p => p.id)).toEqual(['PROD-TEST-01', 'PROD-TEST-02', 'PROD-TEST-03']);
    });

    it('handles nested wrappers and null/undefined values safely', () => {
      const nestedList = [
        { product: { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1' } },
        { item: { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1 nested dupe' } },
        null,
        undefined,
        { id: 'PROD-TEST-02', code: 'T02', name: 'Test Item 2' }
      ];

      const cleanList = deduplicateMasterData(nestedList);
      expect(cleanList.length).toBe(2);
      expect(cleanList[0].id).toBe('PROD-TEST-01');
      expect(cleanList[1].id).toBe('PROD-TEST-02');
    });

    it('strictly filters out blacklisted test artifacts (P01, P02, PROD-01, PROD-02, Item 1, Item 2)', () => {
      const dirtyWithArtifacts = [
        { id: 'PROD-01', code: 'P01', name: 'Item 1' },
        { id: 'PROD-02', code: 'P02', name: 'Item 2' },
        { id: 'PROD-VALID-01', code: 'V01', name: 'Valid Product' }
      ];

      const cleanList = deduplicateMasterData(dirtyWithArtifacts);
      expect(cleanList.length).toBe(1);
      expect(cleanList[0].id).toBe('PROD-VALID-01');
      expect(isBlacklistedProduct({ id: 'PROD-01', code: 'P01', name: 'Item 1' })).toBe(true);
      expect(isBlacklistedProduct({ id: 'PROD-02', code: 'P02', name: 'Item 2' })).toBe(true);
      expect(isBlacklistedProduct({ code: 'P01' })).toBe(true);
      expect(isBlacklistedProduct({ code: 'P02' })).toBe(true);
      expect(isBlacklistedProduct({ name: 'Item 1' })).toBe(true);
      expect(isBlacklistedProduct({ name: 'item 2' })).toBe(true);
      expect(isBlacklistedProduct({ id: 'PROD-PD-001', code: 'PD-OIL-068', name: 'Hydraulic Oil' })).toBe(false);
    });
  });

  describe('2. MasterDataView Render & Auto-Cleanup Migration', () => {
    it('renders products without key collisions even if duplicates are supplied', () => {
      const duplicatedProducts = [
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1', category: 'PD', isActive: true, price: 100, stockBalance: 10 },
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1 Dupe', category: 'PD', isActive: true, price: 100, stockBalance: 10 },
        { id: 'PROD-TEST-02', code: 'T02', name: 'Test Item 2', category: 'PD', isActive: true, price: 200, stockBalance: 5 },
        { id: 'PROD-TEST-02', code: 'T02', name: 'Test Item 2 Dupe', category: 'PD', isActive: true, price: 200, stockBalance: 5 }
      ];

      const html = renderToStaticMarkup(
        <MasterDataView
          products={duplicatedProducts}
          currentRole={{ id: 'ADMIN', roleId: 'ADMIN' }}
        />
      );

      expect(html).toContain('Test Item 1');
      expect(html).toContain('Test Item 2');
    });

    it('cleans storage on mount and completely purges dummy artifacts PROD-01 and PROD-02', () => {
      const dirtyInStorage = [
        { id: 'PROD-01', code: 'P01', name: 'Item 1', category: 'PD', isActive: true },
        { id: 'PROD-02', code: 'P02', name: 'Item 2', category: 'PD', isActive: true },
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1', category: 'PD', isActive: true },
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1 Duplicate', category: 'PD', isActive: true }
      ];
      localStorage.setItem('prpo_products_data', JSON.stringify(dirtyInStorage));

      const storedBefore = JSON.parse(localStorage.getItem('prpo_products_data'));
      expect(storedBefore.length).toBe(4);

      // Verify deduplicateMasterData will clean duplicates AND purge P01/P02
      const cleaned = deduplicateMasterData(storedBefore);
      expect(cleaned.length).toBe(1);
      expect(cleaned[0].id).toBe('PROD-TEST-01');
    });
  });

  describe('3. MasterDataContext Guard', () => {
    it('ensures MasterDataProvider provides deduplicated products without blacklisted items', () => {
      let contextProducts = [];
      function ConsumerComponent() {
        const ctx = useMasterDataContext();
        contextProducts = ctx.products;
        return <div>Count: {ctx.products.length}</div>;
      }

      storageService.saveProducts([
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1' },
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1 Dupe' },
        { id: 'PROD-TEST-02', code: 'T02', name: 'Test Item 2' },
        { id: 'PROD-01', code: 'P01', name: 'Item 1' } // Should be ignored
      ]);

      renderToStaticMarkup(
        <MasterDataProvider>
          <ConsumerComponent />
        </MasterDataProvider>
      );

      expect(contextProducts.length).toBe(2);
      expect(contextProducts.map(p => p.id)).toEqual(['PROD-TEST-01', 'PROD-TEST-02']);
    });
  });
});
