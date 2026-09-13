import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup.js';
import { storageService, DUMMY_BLACKLIST, isBlacklistedProduct } from '../src/services/storageService.js';
import { apiService } from '../src/services/apiService.js';

describe('Product Delete Action & Permanent Blacklist Guard', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. Blacklist Guard Immunity', () => {
    it('identifies P01, P02, PROD-01, PROD-02, Item 1, Item 2 as blacklisted', () => {
      expect(DUMMY_BLACKLIST.has('P01')).toBe(true);
      expect(DUMMY_BLACKLIST.has('P02')).toBe(true);
      expect(DUMMY_BLACKLIST.has('PROD-01')).toBe(true);
      expect(DUMMY_BLACKLIST.has('PROD-02')).toBe(true);

      expect(isBlacklistedProduct({ code: 'p01' })).toBe(true);
      expect(isBlacklistedProduct({ id: 'prod-01' })).toBe(true);
      expect(isBlacklistedProduct({ code: 'P02', name: 'Some item' })).toBe(true);
      expect(isBlacklistedProduct({ name: 'Item 1' })).toBe(true);
      expect(isBlacklistedProduct({ name: 'item 2' })).toBe(true);
      expect(isBlacklistedProduct({ name: '  Item 1  ' })).toBe(true);

      // Real items are not blacklisted
      expect(isBlacklistedProduct({ id: 'PROD-PD-001', code: 'PD-OIL-068', name: 'Hydraulic Oil' })).toBe(false);
      expect(isBlacklistedProduct({ id: 'PROD-QC-001', code: 'QC-BUF-PH7', name: 'Buffer Solution' })).toBe(false);
    });

    it('prevents blacklisted items from being saved to storageService', () => {
      const list = [
        { id: 'PROD-CUSTOM-01', code: 'CUST-01', name: 'Custom Widget' },
        { id: 'PROD-01', code: 'P01', name: 'Item 1', stockBalance: 16 },
        { id: 'PROD-02', code: 'P02', name: 'Item 2', stockBalance: 5 }
      ];

      storageService.saveProducts(list);
      const saved = storageService.getProducts();

      expect(saved.some(p => p.code === 'P01' || p.id === 'PROD-01')).toBe(false);
      expect(saved.some(p => p.code === 'P02' || p.id === 'PROD-02')).toBe(false);
      expect(saved.some(p => p.code === 'CUST-01')).toBe(true);
    });
  });

  describe('2. storageService.deleteProduct & Stock Card Purge', () => {
    it('deletes product by id or code and cleans up matching stock logs', () => {
      // Setup product and stock log
      storageService.saveProducts([
        { id: 'PROD-DEL-01', code: 'SKU-DEL-01', name: 'To Be Deleted', stockBalance: 10 }
      ]);
      storageService.saveStockLogs([
        { id: 'LOG-1', productId: 'PROD-DEL-01', productCode: 'SKU-DEL-01', qty: 10, type: 'IN' },
        { id: 'LOG-2', productId: 'PROD-PD-001', productCode: 'PD-OIL-068', qty: 200, type: 'IN' }
      ]);

      expect(storageService.getProducts().some(p => p.id === 'PROD-DEL-01')).toBe(true);
      expect(storageService.getStockLogs().some(l => l.productId === 'PROD-DEL-01')).toBe(true);

      // Execute delete by SKU code
      storageService.deleteProduct('SKU-DEL-01');

      expect(storageService.getProducts().some(p => p.id === 'PROD-DEL-01')).toBe(false);
      expect(storageService.getStockLogs().some(l => l.productId === 'PROD-DEL-01')).toBe(false);
      // Other stock logs remain intact
      expect(storageService.getStockLogs().some(l => l.productId === 'PROD-PD-001')).toBe(true);
    });

    it('purges blacklisted stock logs automatically from getStockLogs', () => {
      // Simulate dirty stock logs with P01 / P02
      storageService.saveStockLogs([
        { id: 'LOG-P01', productId: 'PROD-01', productCode: 'P01', qty: 16, type: 'IN' },
        { id: 'LOG-P02', productId: 'PROD-02', productCode: 'P02', qty: 5, type: 'IN' },
        { id: 'LOG-REAL', productId: 'PROD-PD-001', productCode: 'PD-OIL-068', qty: 2400, type: 'IN' }
      ]);

      const logs = storageService.getStockLogs();
      expect(logs.some(l => l.productCode === 'P01' || l.productId === 'PROD-01')).toBe(false);
      expect(logs.some(l => l.productCode === 'P02' || l.productId === 'PROD-02')).toBe(false);
      expect(logs.some(l => l.productId === 'PROD-PD-001')).toBe(true);
    });
  });

  describe('3. apiService.deleteProduct Integration', () => {
    it('successfully calls apiService.deleteProduct without error', async () => {
      storageService.saveProducts([
        { id: 'PROD-TEST-DEL', code: 'SKU-TEST-DEL', name: 'API Delete Test' }
      ]);

      const result = await apiService.deleteProduct('SKU-TEST-DEL');
      expect(result).toBe(true);
      expect(storageService.getProducts().some(p => p.code === 'SKU-TEST-DEL')).toBe(false);
    });
  });
});
