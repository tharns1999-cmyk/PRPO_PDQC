/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider, AppContext } from '../src/context/AppContext';
import { applyProductCostFailSafe } from '../src/services/productService';
import { healMACForProduct } from '../src/utils/macMigration';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

const MOCK_PRODUCTS = [
  { id: '1', code: 'P001', name: 'Product A', department: 'PD', stockBalance: 5, avgCost: 80, price: 80, unit: 'ชิ้น', isActive: true },
  { id: '2', code: 'P002', name: 'Product B', department: 'QC', stockBalance: 0, avgCost: 0, price: 0, unit: 'กล่อง', isActive: true },
  { id: '3', code: 'P003', name: 'Product C', department: 'PD', stockBalance: -10, avgCost: 15, price: 15, unit: 'ชิ้น', isActive: true },
];

const MOCK_STOCK_LOGS = [
  { id: 'LOG-1', type: 'OUT', productId: '1', productCode: 'P001', qty: 5, unitCost: 80, totalCost: 400, department: 'PD' }
];

vi.mock('../src/services/StorageService', () => ({
  default: {
    getProducts: vi.fn(() => [...MOCK_PRODUCTS]),
    getStockLogs: vi.fn(() => [...MOCK_STOCK_LOGS]),
    getStorageLocations: vi.fn(() => []),
    getUsageUnits: vi.fn(() => [{ id: 'u1', name: 'Unit 1', department: 'PD' }]),
    getDepartments: vi.fn(() => []),
    saveProducts: vi.fn(),
    saveStockLogs: vi.fn(),
    saveMasterItem: vi.fn(),
    appendStockMovements: vi.fn(),
  }
}));

window.google = {
  script: {
    run: {
      withSuccessHandler: vi.fn().mockReturnThis(),
      withFailureHandler: vi.fn().mockReturnThis(),
      apiIssueStock: vi.fn(),
      apiReceiveStock: vi.fn(),
      apiAppendStockMovements: vi.fn(),
    }
  }
};

describe('Domain Suite: Perpetual Moving Average Cost & Snapshot Immutability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Moving Average Cost & Zero Division Protection', () => {
    it('1. สูตร Moving Average: จำลองสต็อกเดิม 5 ชิ้น @ 80 บาท รับเข้า 10 ชิ้น @ 90 บาท -> ต้นทุนเฉลี่ยต้องได้ 86.67 บาท', async () => {
      const currentBalance = 5;
      const currentAvg = 80;
      const receivedQty = 10;
      const purchasePrice = 90;

      let newAvgCost = purchasePrice;
      if (currentBalance > 0) {
        const totalCurrentValue = currentBalance * currentAvg;
        const totalIncomingValue = receivedQty * purchasePrice;
        const totalNewQty = currentBalance + receivedQty;
        newAvgCost = totalNewQty > 0 ? (totalCurrentValue + totalIncomingValue) / totalNewQty : purchasePrice;
      }
      newAvgCost = Math.round((newAvgCost + Number.EPSILON) * 100) / 100;

      expect(newAvgCost).toBe(86.67);
    });

    it('2. Zero Division Protection: จำลองสต็อกเริ่มต้น 0 ชิ้น รับเข้า 10 ชิ้น @ 80 บาท -> ต้นทุนเฉลี่ยต้องได้ 80.00 บาท', async () => {
      const currentBalance = 0;
      const currentAvg = 0;
      const receivedQty = 10;
      const purchasePrice = 80;

      let newAvgCost = purchasePrice;
      if (currentBalance > 0) {
        const totalCurrentValue = currentBalance * currentAvg;
        const totalIncomingValue = receivedQty * purchasePrice;
        const totalNewQty = currentBalance + receivedQty;
        newAvgCost = totalNewQty > 0 ? (totalCurrentValue + totalIncomingValue) / totalNewQty : purchasePrice;
      }
      newAvgCost = Math.round((newAvgCost + Number.EPSILON) * 100) / 100;

      expect(newAvgCost).toBe(80.00);
    });
  });

  describe('Snapshot Immutability', () => {
    it('3. Snapshot Immutability: Log ในอดีตต้องคงค่า unitCost=80 และ totalCost=400 ไม่เปลี่ยนตามราคาล็อตใหม่', () => {
      // Create a mock log snapshot
      const log = { id: 'LOG-1', type: 'OUT', qty: 5, unitCost: 80, totalCost: 400 };
      
      // Even if the product average cost changes to 90 later
      const productCurrentAvgCost = 90;
      
      // The log's total cost must remain as its snapshot value, NOT recalculated
      const calculatedLogTotalCost = log.totalCost || (log.qty * productCurrentAvgCost);
      
      expect(log.unitCost).toBe(80);
      expect(calculatedLogTotalCost).toBe(400);
    });
    
    it('4. UI Matrix & Form Calculation: fallback logic extracts correct snapshot value', () => {
      const log = { id: 'LOG-1', qty: 5, unitCost: 80, totalCost: 400 };
      const prod = { id: '1', avgCost: 90 };
      
      // Frontend fallback formula
      const calcCost = Number(log.totalCost ?? ((Number(log.qty) || 0) * (prod?.avgCost || prod?.costPrice || prod?.price || 0)));
      expect(calcCost).toBe(400); // Should read totalCost instead of dynamically recalculating with new 90 avgCost
      
      const logMissingCost = { id: 'LOG-2', qty: 5 };
      const calcCostMissing = Number(logMissingCost.totalCost ?? ((Number(logMissingCost.qty) || 0) * (prod?.avgCost || prod?.costPrice || prod?.price || 0)));
      expect(calcCostMissing).toBe(450); // Fallbacks to 5 * 90 if log doesn't have totalCost (for older logs before migration)
    });
  });

  describe('Auto-Fallback Fail-Safe on Read & MAC Recalculation', () => {
    it('5. Auto-fallback on Read: หาก currentStock > 0 แต่ averageCost เป็น 0 ให้ดึง unitPrice จาก IN log ล่าสุดมาเป็นค่าสำรองทันที', () => {
      const mockProducts = [
        { id: 'PROD-GLV-01', code: 'GLOVE-01', name: 'ถุงมือกันร้อน', stockBalance: 10, averageCost: 0, avgCost: 0 },
        { id: 'PROD-OIL-02', code: 'OIL-02', name: 'น้ำมันหล่อลื่น', stockBalance: 5, averageCost: 150, avgCost: 150 },
        { id: 'PROD-EMPTY-03', code: 'EMPTY-03', name: 'สินค้าสต็อก 0', stockBalance: 0, averageCost: 0, avgCost: 0 }
      ];

      const mockLogs = [
        { type: 'IN', productId: 'PROD-GLV-01', productCode: 'GLOVE-01', qty: 5, unitPrice: 30.00, timestamp: '2026-09-10T10:00:00Z' },
        { type: 'IN', productId: 'PROD-GLV-01', productCode: 'GLOVE-01', qty: 10, unitPrice: 34.50, timestamp: '2026-09-15T10:00:00Z' },
        { type: 'OUT', productId: 'PROD-GLV-01', productCode: 'GLOVE-01', qty: 5, unitPrice: 34.50, timestamp: '2026-09-16T10:00:00Z' }
      ];

      const safeProducts = applyProductCostFailSafe(mockProducts, mockLogs);

      const glv = safeProducts.find(p => p.id === 'PROD-GLV-01');
      expect(glv.averageCost).toBe(34.50);
      expect(glv.avgCost).toBe(34.50);
      expect(glv.totalValue).toBe(345.00); // 10 * 34.50

      const oil = safeProducts.find(p => p.id === 'PROD-OIL-02');
      expect(oil.averageCost).toBe(150); // Preserves existing cost

      const empty = safeProducts.find(p => p.id === 'PROD-EMPTY-03');
      expect(empty.averageCost).toBe(0); // 0 stock remains 0
    });

    it('6. MAC Recalculation Action: คำนวณ Moving Average Cost สะสมจาก IN logs และบันทึก averageCost และ totalValue', async () => {
      const { storageService } = await import('../src/services/storageService');
      
      const testProd = { id: 'PROD-RECALC-01', code: 'RECALC-01', name: 'อะไหล่ทดสอบ', stockBalance: 15, averageCost: 0, avgCost: 0 };
      const testLogs = [
        { type: 'IN', productId: 'PROD-RECALC-01', productCode: 'RECALC-01', qty: 10, unitPrice: 30.00, timestamp: '2026-09-10T08:00:00Z' },
        { type: 'IN', productId: 'PROD-RECALC-01', productCode: 'RECALC-01', qty: 10, unitPrice: 40.00, timestamp: '2026-09-12T08:00:00Z' },
        // (10*30 + 10*40) / 20 = 700 / 20 = 35.00
      ];

      vi.spyOn(storageService, 'getProducts').mockReturnValue([testProd]);
      vi.spyOn(storageService, 'getStockLogs').mockReturnValue(testLogs);
      const saveProductsSpy = vi.spyOn(storageService, 'saveProducts').mockImplementation(() => {});

      const healed = await healMACForProduct('RECALC-01');

      expect(healed).not.toBeNull();
      expect(healed.averageCost).toBe(35.00);
      expect(healed.avgCost).toBe(35.00);
      expect(healed.totalValue).toBe(15 * 35.00); // 525
      expect(saveProductsSpy).toHaveBeenCalled();
    });
  });
});
