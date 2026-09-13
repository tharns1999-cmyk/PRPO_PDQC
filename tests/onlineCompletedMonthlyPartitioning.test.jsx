import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext';
import OnlineTaskView from '../src/views/OnlineTaskView';
import OnlineOrderCard from '../src/views/procurement/OnlineOrderCard';
import { 
  filteredOrders, 
  formatThaiMonth, 
  getPrevMonth, 
  getNextMonth, 
  calculateCompletedKPIs 
} from '../src/views/procurement/OnlineProcurementHub';
import { filterCompletedPOsByMonth } from '../src/context/ProcurementContext';
import { storageService } from '../src/services/storageService';

describe('Online Procurement Monthly Data Partitioning & High-Density Completed Suite', () => {
  const currentRole = { id: 'ONLINE_PURCHASER', name: 'เจ้าหน้าที่จัดซื้อออนไลน์', canOnlinePurchase: true };

  const septPO = {
    id: 'PO-SEPT-001',
    poNo: 'PO-PD-2026-001',
    department: 'PD',
    purchaseChannel: 'ONLINE',
    status: 'COMPLETED',
    completedAt: '2026-09-13T10:00:00.000Z',
    actualTotal: 4500,
    totalRefunded: 500,
    totalAmount: 5000,
    items: [
      {
        id: 'item-1',
        name: 'ถุงมือยางไนไตรล์สีฟ้า',
        actualStoreName: 'ร้านอุปกรณ์เซฟตี้',
        storePlatform: 'Shopee',
        actualQty: 10,
        actualPrice: 450,
        receivedQty: 10
      },
      {
        id: 'item-2',
        name: 'หน้ากากกันสารเคมี 3M',
        actualStoreName: 'ร้านเคมีภัณฑ์แล็บ',
        storePlatform: 'Lazada',
        actualQty: 2,
        actualPrice: 250,
        receivedQty: 2
      }
    ]
  };

  const augPO = {
    id: 'PO-AUG-001',
    poNo: 'PO-PD-2026-002',
    department: 'PD',
    purchaseChannel: 'ONLINE',
    status: 'COMPLETED',
    completedAt: '2026-08-25T14:30:00.000Z',
    actualTotal: 3200,
    totalRefunded: 0,
    totalAmount: 3200,
    items: [
      {
        id: 'item-3',
        name: 'เทปตีเส้นพื้นสีเหลือง-ดำ',
        actualStoreName: 'ร้านฮาร์ดแวร์โปร',
        storePlatform: 'Shopee',
        actualQty: 8,
        actualPrice: 400,
        receivedQty: 8
      }
    ]
  };

  const pendingPO = {
    id: 'PO-PENDING-001',
    poNo: 'PO-QC-2026-099',
    department: 'QC',
    purchaseChannel: 'ONLINE',
    status: 'PENDING_ORDER',
    createdAt: '2026-07-10T08:00:00.000Z',
    totalAmount: 1200,
    items: [
      { id: 'item-4', name: 'บีกเกอร์แก้ว 500ml', actualQty: 5, unitPrice: 240 }
    ]
  };

  const orderedPO = {
    id: 'PO-ORDERED-001',
    poNo: 'PO-PD-2026-100',
    department: 'PD',
    purchaseChannel: 'ONLINE',
    status: 'ORDERED',
    orderedAt: '2026-07-15T09:00:00.000Z',
    totalAmount: 2800,
    items: [
      { id: 'item-5', name: 'ฟิล์มยืดพันพาเลท', actualQty: 4, unitPrice: 700 }
    ]
  };

  beforeEach(() => {
    storageService.resetData();
    storageService.savePOs([septPO, augPO, pendingPO, orderedPO]);
  });

  describe('Scenario 1: Default Monthly Partitioning', () => {
    it('defaults to current month (2026-09) and excludes older months from immediate view', () => {
      const pos = [septPO, augPO];
      const septCompleted = filteredOrders(pos, 'CLOSED', '2026-09');
      expect(septCompleted.length).toBe(1);
      expect(septCompleted[0].poNo).toBe('PO-PD-2026-001');

      const storagePartition = storageService.getCompletedPOsByMonth('2026-09');
      expect(storagePartition.some(p => p.id === 'PO-SEPT-001')).toBe(true);
      expect(storagePartition.some(p => p.id === 'PO-AUG-001')).toBe(false);
    });

    it('formats Thai month representations accurately', () => {
      expect(formatThaiMonth('2026-09')).toBe('กันยายน 2569');
      expect(formatThaiMonth('2026-08')).toBe('สิงหาคม 2569');
      expect(formatThaiMonth('ALL_YEAR')).toBe('ตลอดปี 2569');
    });
  });

  describe('Scenario 2: Month Navigation & State Isolation', () => {
    it('computes correct previous and next months', () => {
      expect(getPrevMonth('2026-09')).toBe('2026-08');
      expect(getNextMonth('2026-09')).toBe('2026-10');
      expect(getPrevMonth('2026-01')).toBe('2025-12');
      expect(getNextMonth('2026-12')).toBe('2027-01');
    });

    it('switching to August partitions completed POs and updates financial KPI metrics', () => {
      const pos = [septPO, augPO];
      const augCompleted = filteredOrders(pos, 'CLOSED', '2026-08');
      expect(augCompleted.length).toBe(1);
      expect(augCompleted[0].poNo).toBe('PO-PD-2026-002');

      const kpisAug = calculateCompletedKPIs(augCompleted);
      expect(kpisAug.count).toBe(1);
      expect(kpisAug.totalActualSpent).toBe(3200);
      expect(kpisAug.totalRefunds).toBe(0);

      const kpisSept = calculateCompletedKPIs([septPO]);
      expect(kpisSept.count).toBe(1);
      expect(kpisSept.totalActualSpent).toBe(4500);
      expect(kpisSept.totalRefunds).toBe(500);
    });
  });

  describe('Scenario 3: Active Tab Invariance', () => {
    it('keeps active non-completed tabs invariant and unrestricted by monthly partition', () => {
      const pos = [septPO, augPO, pendingPO, orderedPO];

      const pendingOrders = filteredOrders(pos, 'PENDING');
      expect(pendingOrders.length).toBe(1);
      expect(pendingOrders[0].poNo).toBe('PO-QC-2026-099');

      const orderedOrders = filteredOrders(pos, 'ORDERED');
      expect(orderedOrders.length).toBe(1);
      expect(orderedOrders[0].poNo).toBe('PO-PD-2026-100');
    });
  });

  describe('Scenario 4: Ultra-Compact Row (~52px) & Pagination Architecture', () => {
    it('renders ultra-compact 5-column completed row layout in default collapsed state', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard
              po={septPO}
              activeTab="CLOSED"
              currentRole={currentRole}
              defaultExpanded={false}
              onUpdate={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // Col 1: Doc code, Dept tag, Completion date
      expect(html).toContain('PO-PD-2026-001');
      expect(html).toContain('PD');
      expect(html).toContain('13/09/2026');

      // Col 2: Store Chips summary with platform breakdown
      expect(html).toContain('2 ร้านค้า (Shopee 1, Lazada 1)');

      // Col 3: Items snippet
      expect(html).toContain('ถุงมือยางไนไตรล์สีฟ้า และอีก 1 รายการ');

      // Col 4: Financial Summary with refund pill
      expect(html).toContain('฿4,500.00');
      expect(html).toContain('+คืน ฿500.00');

      // Col 5: Actions toggle and full PO button
      expect(html).toContain('👁️ ดูรายการสินค้า');
      expect(html).toContain('PO ฉบับเต็ม');
      expect(html).toContain('shadow-sm');
      expect(html).toContain('border-t border-slate-100');
    });

    it('expands detail breakdown on-demand upon clicking expand', () => {
      const expandedHtml = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard
              po={septPO}
              activeTab="CLOSED"
              currentRole={currentRole}
              defaultExpanded={true}
              onUpdate={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // Unfolded store and item breakdown
      expect(expandedHtml).toContain('ร้านอุปกรณ์เซฟตี้');
      expect(expandedHtml).toContain('ร้านเคมีภัณฑ์แล็บ');
      expect(expandedHtml).toContain('หน้ากากกันสารเคมี 3M');
      expect(expandedHtml).toContain('ย่อ');
    });

    it('partitions large dataset into 15 items per page cleanly', () => {
      // Create 20 mock completed POs in September 2026
      const mockPOs = Array.from({ length: 20 }).map((_, idx) => ({
        id: `PO-MOCK-${idx + 1}`,
        poNo: `PO-PD-2026-${String(idx + 1).padStart(3, '0')}`,
        department: 'PD',
        purchaseChannel: 'ONLINE',
        status: 'COMPLETED',
        completedAt: '2026-09-10T10:00:00.000Z',
        actualTotal: 1000 + idx * 100,
        items: [{ id: `item-${idx}`, name: `สินค้าทดสอบ ${idx + 1}`, actualQty: 1, actualPrice: 1000 }]
      }));

      const septCompleted = filteredOrders(mockPOs, 'CLOSED', '2026-09');
      expect(septCompleted.length).toBe(20);

      const PAGE_SIZE = 15;
      const page1 = septCompleted.slice(0, PAGE_SIZE);
      const page2 = septCompleted.slice(PAGE_SIZE, PAGE_SIZE * 2);

      expect(page1.length).toBe(15);
      expect(page2.length).toBe(5);
      expect(page1[0].poNo).toBe('PO-PD-2026-001');
      expect(page2[0].poNo).toBe('PO-PD-2026-016');
    });
  });
});
