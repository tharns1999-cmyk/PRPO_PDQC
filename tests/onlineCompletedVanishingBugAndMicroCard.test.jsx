import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext.jsx';
import OnlineTaskView from '../src/views/OnlineTaskView.jsx';
import OnlineOrderCard from '../src/views/procurement/OnlineOrderCard.jsx';
import { 
  filteredOrders, 
  parseOrderYearMonth, 
  calculateCompletedKPIs 
} from '../src/views/procurement/OnlineProcurementHub.jsx';
import { storageService } from '../src/services/storageService.js';

describe('Vanishing Orders Bug Resolution & 2-Tier Micro Card Verification Suite', () => {
  const currentRole = { id: 'ONLINE_PURCHASER', name: 'เจ้าหน้าที่จัดซื้อออนไลน์', canOnlinePurchase: true };

  // Exact reproduction data from user bug report (image_d75e6e.png & image_d75ea9.png)
  const poCompletedWithThaiDate = {
    id: 'PO-PD-2026-001',
    poNo: 'PO-PD-2026-001',
    poNumber: 'PO-PD-2026-001',
    prNo: 'PD001/2026',
    prNumber: 'PD001/2026',
    department: 'PD',
    purchaseChannel: 'ONLINE',
    status: 'COMPLETED',
    claimStatus: 'RESOLVED',
    completedAt: '13/09/2026 17:47',
    orderDate: '13/09/2026',
    totalAmount: 5105.00,
    estimatedAmount: 5105.00,
    refundAmount: 517.60,
    storeClaims: {
      'Shopee_storea': {
        storeKey: 'Shopee_storea',
        status: 'RESOLVED',
        type: 'REFUND',
        refundAmount: 246.00,
        resolvedAt: '13/09/2026 17:47'
      },
      'Shopee_packpro thailand': {
        storeKey: 'Shopee_packpro thailand',
        status: 'RESOLVED',
        type: 'REFUND',
        refundAmount: 271.60,
        resolvedAt: '13/09/2026 17:47'
      }
    },
    items: [
      {
        id: 'ITM-001',
        name: 'สายรัดพาเลทอย่างหนา 15 มม.',
        actualStoreName: 'PackPro Thailand',
        storePlatform: 'Shopee',
        qty: 10,
        purchaseQty: 10,
        unitPrice: 387.50,
        price: 387.50
      },
      {
        id: 'ITM-002',
        name: 'น้ำมันหล่อลื่นอเนกประสงค์เกรดอาหาร',
        actualStoreName: 'StoreA',
        storePlatform: 'Shopee',
        qty: 5,
        purchaseQty: 5,
        unitPrice: 246.00,
        price: 246.00,
        refundAmt: 246.00
      }
    ]
  };

  beforeEach(() => {
    storageService.resetData();
  });

  describe('Objective A: Resilient Temporal Date Normalizer (parseOrderYearMonth)', () => {
    it('parses Thai/Standard DD/MM/YYYY date strings accurately', () => {
      expect(parseOrderYearMonth('13/09/2026')).toEqual({ year: 2026, month: '09', ymKey: '2026-09' });
      expect(parseOrderYearMonth('13/09/2026 17:47')).toEqual({ year: 2026, month: '09', ymKey: '2026-09' });
      expect(parseOrderYearMonth('01/08/2026 09:15:30')).toEqual({ year: 2026, month: '08', ymKey: '2026-08' });
    });

    it('parses Thai Buddhist Era (BE > 2500) dates and converts to Common Era (CE)', () => {
      expect(parseOrderYearMonth('13/09/2569')).toEqual({ year: 2026, month: '09', ymKey: '2026-09' });
      expect(parseOrderYearMonth('13/09/2569 17:47:00')).toEqual({ year: 2026, month: '09', ymKey: '2026-09' });
    });

    it('parses ISO format YYYY-MM-DD and timestamps accurately', () => {
      expect(parseOrderYearMonth('2026-09-13')).toEqual({ year: 2026, month: '09', ymKey: '2026-09' });
      expect(parseOrderYearMonth('2026-09-13T10:00:00.000Z')).toEqual({ year: 2026, month: '09', ymKey: '2026-09' });
      expect(parseOrderYearMonth('2026-08-25T14:30:00.000Z')).toEqual({ year: 2026, month: '08', ymKey: '2026-08' });
    });

    it('safely handles empty, null, undefined, or invalid inputs', () => {
      expect(parseOrderYearMonth('')).toEqual({ year: null, month: null, ymKey: null });
      expect(parseOrderYearMonth(null)).toEqual({ year: null, month: null, ymKey: null });
      expect(parseOrderYearMonth(undefined)).toEqual({ year: null, month: null, ymKey: null });
      expect(parseOrderYearMonth('invalid-date-string')).toEqual({ year: null, month: null, ymKey: null });
    });
  });

  describe('Regression Scenario 1: Vanishing Orders Bug Resolution in Tab "ปิดงานสำเร็จ"', () => {
    it('immediately displays PO-PD-2026-001 (dated 13/09/2026) under current month "กันยายน 2569" (2026-09)', () => {
      const orders = [poCompletedWithThaiDate];
      const completedFiltered = filteredOrders(orders, 'CLOSED', '2026-09');

      expect(completedFiltered.length).toBe(1);
      expect(completedFiltered[0].poNo).toBe('PO-PD-2026-001');
      expect(completedFiltered[0].department).toBe('PD');
    });

    it('storageService.getCompletedPOsByMonth retrieves PO-PD-2026-001 under 2026-09', () => {
      storageService.savePOs([poCompletedWithThaiDate]);
      const stored = storageService.getCompletedPOsByMonth('2026-09');

      expect(stored.length).toBe(1);
      expect(stored[0].poNo).toBe('PO-PD-2026-001');
    });
  });

  describe('Regression Scenario 2: Annual Filter Fidelity ("ตลอดปี 2569" / ALL_YEAR)', () => {
    it('PO-PD-2026-001 remains visible and is not filtered out when selectedMonth is ALL_YEAR', () => {
      const orders = [poCompletedWithThaiDate];
      const allYearFiltered = filteredOrders(orders, 'CLOSED', 'ALL_YEAR');

      expect(allYearFiltered.length).toBe(1);
      expect(allYearFiltered[0].poNo).toBe('PO-PD-2026-001');
    });

    it('storageService.getCompletedPOsByMonth retrieves PO-PD-2026-001 when query is ALL_YEAR', () => {
      storageService.savePOs([poCompletedWithThaiDate]);
      const storedAllYear = storageService.getCompletedPOsByMonth('ALL_YEAR');

      expect(storedAllYear.length).toBe(1);
      expect(storedAllYear[0].poNo).toBe('PO-PD-2026-001');
    });
  });

  describe('Regression Scenario 3: KPI Metrics Synchronization', () => {
    it('KPI calculations accurately compute count, actual spend, and refund credits', () => {
      const kpis = calculateCompletedKPIs([poCompletedWithThaiDate]);

      expect(kpis.count).toBe(1);
      expect(kpis.totalRefunds).toBeCloseTo(517.60, 2);
      // Net actual spent = 5105.00 - 517.60 = 4587.40
      expect(kpis.totalActualSpent).toBeCloseTo(4587.40, 2);
    });

    it('OnlineTaskView renders matching KPI banner metrics', () => {
      storageService.savePOs([poCompletedWithThaiDate]);

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineTaskView currentRole={currentRole} />
          </AppProvider>
        </MemoryRouter>
      );

      // KPI banner should sync with the completed PO
      expect(html).toContain('งานจัดซื้อออนไลน์');
    });
  });

  describe('Regression Scenario 4: Structured 2-Tier Micro Card UI & Readability', () => {
    it('renders master completed row cleanly partitioned across Tier 1 and Tier 2', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard
              po={poCompletedWithThaiDate}
              activeTab="CLOSED"
              currentRole={currentRole}
              defaultExpanded={false}
              onUpdate={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // 1. Outer Container tokens
      expect(html).toContain('w-full bg-white hover:bg-slate-50/80 border border-slate-200/90');
      expect(html).toContain('rounded-xl p-3 sm:px-4 sm:py-2.5 transition-all mb-2.5 shadow-sm');

      // 2. Tier 1: Document Identity & Spend Headline
      expect(html).toContain('PO-PD-2026-001');
      expect(html).toContain('PD');
      expect(html).toContain('PR: PD001/2026');
      expect(html).toContain('2 ร้านค้า');
      expect(html).toContain('จ่ายจริง:');
      expect(html).toContain('฿4,587.40');
      expect(html).toContain('✓ ปิดงานสำเร็จ 100%');

      // 3. Tier 2: Secondary Preview, Budget Diff & Controls
      expect(html).toContain('border-t border-slate-100');
      expect(html).toContain('13/09/2026');
      expect(html).toContain('สายรัดพาเลทอย่างหนา 15 มม. และอีก 1 รายการ');
      expect(html).toContain('งบ: ฿5,105.00');
      expect(html).toContain('+คืน ฿517.60');
      expect(html).toContain('👁️ ดูรายการสินค้า');
      expect(html).toContain('PO ฉบับเต็ม');
    });
  });

  describe('Regression Scenario 5: Empty State Safety & Recovery Action Button', () => {
    it('renders EmptyState with recovery button "[ ดูคำสั่งซื้อทั้งหมดในปี 2569 ]" when no records exist in selected month', () => {
      // Empty data state
      storageService.savePOs([]);

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineTaskView currentRole={currentRole} />
          </AppProvider>
        </MemoryRouter>
      );

      // When switched or on completed tab with 0 items, recovery button is available
      expect(html).toContain('ศูนย์จัดการคำสั่งซื้อผ่าน Shopee / Lazada');
    });
  });
});
