import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext.jsx';
import OnlineOrderCard from '../src/views/procurement/OnlineOrderCard.jsx';
import { storageService } from '../src/services/storageService.js';

describe('Online Procurement High-Density Grouped Manifest Layout', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  const mockPO = {
    id: 'PO-ONLINE-TEST-01',
    poNo: 'PO-ONLINE-TEST-01',
    prNo: 'PR-PD-999',
    department: 'PD',
    purchaseChannel: 'ONLINE',
    status: 'IN_PROGRESS_ONLINE',
    vendorName: 'ร้านเคมีภัณฑ์อุตสาหกรรม',
    items: [
      {
        id: 'ITEM-1',
        productId: 'PROD-01',
        code: 'CHEM-001',
        name: 'สารละลายเคมีทดสอบความเข้มข้นสูงพิเศษ (Analytical Grade 99.8%)',
        qty: 2,
        purchaseQty: 2,
        price: 750,
        unitPrice: 750,
        unit: 'ขวด',
        purchaseUnit: 'ขวด',
        platform: 'Shopee',
        storePlatform: 'Shopee',
        actualStoreName: 'ChemicalPro Official',
        productUrl: 'https://shopee.co.th/product/123/456'
      },
      {
        id: 'ITEM-2',
        productId: 'PROD-02',
        code: 'GLOVE-002',
        name: 'ถุงมือไนไตรกันสารเคมีเกรดห้องปฏิบัติการ',
        qty: 5,
        purchaseQty: 5,
        price: 120,
        unitPrice: 120,
        unit: 'กล่อง',
        purchaseUnit: 'กล่อง',
        platform: 'Shopee',
        storePlatform: 'Shopee',
        actualStoreName: 'ChemicalPro Official',
        productUrl: 'https://shopee.co.th/product/123/789'
      }
    ]
  };

  it('1. Task Execution Mode (PENDING): Renders flat unified manifest, slim store header, and compact inline inputs', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={mockPO}
            activeTab="PENDING"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // 1. Flat Unified Container: No box-in-box bloat
    expect(html).toContain('rounded-xl border border-slate-200/90 bg-white overflow-hidden divide-y divide-slate-100');
    expect(html).not.toContain('bg-slate-50/50 rounded-2xl border border-slate-200/60');

    // 2. Slim Store Header (~32px)
    expect(html).toContain('flex items-center justify-between px-3.5 py-1.5 bg-slate-50 border-b border-slate-100 text-xs');
    expect(html).toContain('h-7 px-2 text-xs bg-white border border-slate-200 rounded-lg w-48 sm:w-64');
    expect(html).toContain('ยอดร้านนี้:');

    // 3. Task Execution Row: Single-row flow (~44px)
    expect(html).toContain('min-h-[44px]');
    expect(html).toContain('w-8 h-8 rounded-lg');
    expect(html).toContain('truncate max-w-[220px] sm:max-w-md');
    expect(html).toContain('(PR: 2 ขวด @ ฿750.00)');

    // 4. Stepper & Compact Inputs
    expect(html).toContain('h-8 w-22 p-0.5 border border-slate-200 rounded-lg bg-slate-50');
    expect(html).toContain('text-xs text-slate-500 w-8 text-center');
    expect(html).toContain('w-24 h-8 pl-4 pr-2 text-right font-mono text-xs');
    expect(html).toContain('min-w-[75px] text-right');

    // 5. Budget Summary & Confirm Button in dedicated footer
    expect(html).toContain('งบประเมิน PR:');
    expect(html).toContain('ยอดสั่งซื้อจริง:');
    expect(html).toContain('✓ ยืนยันการสั่งซื้อแล้ว');
  });

  it('2. Read-Only Mode (ORDERED): Renders high-density compact rows (~38px) with math breakdown', () => {
    const orderedPO = {
      ...mockPO,
      status: 'ORDERED_PENDING_DELIVERY'
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={orderedPO}
            activeTab="ORDERED"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Flat Unified Container
    expect(html).toContain('rounded-xl border border-slate-200/90 bg-white overflow-hidden divide-y divide-slate-100');

    // High-Density Read-Only Row (~36px)
    expect(html).toContain('py-1.5 px-3 bg-white hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-2.5 min-h-[36px] text-xs');
    
    // Math breakdown on right side: {qty} {unit} × ฿{price} = ฿{lineTotal}
    expect(html).toContain('2 ขวด × ฿750.00 =');
    expect(html).toContain('5 กล่อง × ฿120.00 =');

    // No nested Card-in-Card wrappers
    expect(html).not.toContain('p-3 space-y-2.5');
    expect(html).not.toContain('rounded-xl bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4 border border-slate-100');
  });

  it('3. Claim View (CLAIM): Focuses on disputed stores with Quick Settlement Bar, collapses non-disputed stores into Slim Muted Row', () => {
    const multiStoreClaimPO = {
      ...mockPO,
      status: 'IN_CLAIM',
      items: [
        {
          ...mockPO.items[0],
          actualStoreName: 'ChemicalPro Broken Store',
          shortageQty: 1,
          damagedQty: 0,
          claimStatus: 'PENDING'
        },
        {
          ...mockPO.items[1],
          actualStoreName: 'Clean Glove Official Store',
          shortageQty: 0,
          damagedQty: 0,
          claimStatus: null
        }
      ]
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={multiStoreClaimPO}
            activeTab="CLAIM"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // 1. Disputed Store: Highlighted with High-Contrast Issue Chip and Quick Settlement Bar
    expect(html).not.toContain('⚠️ คลังแจ้งปัญหา:');
    expect(html).toContain('🚨 ขาด 1 ขวด');
    expect(html).toContain('มูลค่าที่ต้องเคลม');
    expect(html).toContain('ChemicalPro Broken Store');
    expect(html).toContain('คืนเงิน (Refund)');
    expect(html).toContain('✓ บันทึกผลเจรจา');
    expect(html).toContain('bg-indigo-600'); // Indigo save button

    // 2. Non-disputed Store: Interactive Accordion Slim Muted Row
    expect(html).toContain('ร้าน: Clean Glove Official Store');
    expect(html).toContain('(รับของครบสมบูรณ์)');
    expect(html).toContain('เปิดดู / จัดการเคลม ▾');

    // Disputed Store shows Collapse button
    expect(html).toContain('ย่อเก็บ ▴');
  });

  it('4. Closed View (CLOSED): Default renders Compact Master Banner, expanded view locks fields and displays consolidated financial pill', () => {
    const closedPO = {
      ...mockPO,
      status: 'COMPLETED',
      refundAmount: 750,
      storeClaims: {
        'Shopee_ChemicalPro Official_https://shopee.co.th/product/123/456': {
          storeKey: 'Shopee_ChemicalPro Official_https://shopee.co.th/product/123/456',
          status: 'RESOLVED',
          type: 'REFUND',
          refundAmount: 750,
          resolvedAt: '2026-09-13T10:30:00.000Z'
        }
      }
    };

    // 1. Default Compact Master Banner
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={closedPO}
            activeTab="CLOSED"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    expect(html).toContain('PO-ONLINE-TEST-01');
    expect(html).toContain('งบ: ฿2,100.00');
    expect(html).toContain('จ่ายจริง: ฿1,350.00');
    expect(html).toContain('+คืน ฿750.00');
    expect(html).toContain('✓ ปิดงานสำเร็จ 100%');
    expect(html).toContain('ดูรายละเอียด');
    expect(html).not.toContain('placeholder="0.00"');
    expect(html).not.toContain('✓ ยืนยันการสั่งซื้อแล้ว');

    // 2. Expanded Detail View
    const expandedHtml = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={closedPO}
            activeTab="CLOSED"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            defaultExpanded={true}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Read-only: No price input, no stepper button, no confirm button
    expect(expandedHtml).not.toContain('placeholder="0.00"');
    expect(expandedHtml).not.toContain('✓ ยืนยันการสั่งซื้อแล้ว');
    expect(expandedHtml).not.toContain('✓ บันทึกผลเจรจา');

    // Clean inline claim success tag in store
    expect(expandedHtml).toContain('px-3 py-1 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800');
    expect(expandedHtml).toContain('✓ เคลมสำเร็จ: ได้รับเงินคืน ฿750.00 เข้าแผนกแล้ว');

    // Consolidated Financial Pill
    expect(expandedHtml).toContain('งบเดิม ฿2,100.00');
    expect(expandedHtml).toContain('จ่ายจริง ฿1,350.00');
    expect(expandedHtml).toContain('+คืนงบ ฿750.00');
    expect(expandedHtml).toContain('ปิดงานสำเร็จ 100%');
  });

  it('5. All View (ALL): Renders adaptive status badges with explicit color codes', () => {
    // 1. PENDING_ORDER -> Amber
    const pendingHtml = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={{ ...mockPO, status: 'PENDING_ORDER' }}
            activeTab="ALL"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );
    expect(pendingHtml).toContain('bg-amber-50 text-amber-700 border border-amber-200');

    // 2. ORDERED / IN_TRANSIT -> Indigo
    const orderedHtml = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={{ ...mockPO, status: 'IN_TRANSIT' }}
            activeTab="ALL"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );
    expect(orderedHtml).toContain('bg-indigo-50 text-indigo-700 border border-indigo-200');

    // 3. CLAIM / DISPUTE -> Rose
    const claimHtml = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={{
              ...mockPO,
              status: 'IN_CLAIM',
              items: [{ ...mockPO.items[0], shortageQty: 1, claimStatus: 'PENDING' }]
            }}
            activeTab="ALL"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );
    expect(claimHtml).toContain('bg-rose-50 text-rose-700 border border-rose-200');

    // 4. COMPLETED -> Emerald
    const completedHtml = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={{ ...mockPO, status: 'COMPLETED' }}
            activeTab="ALL"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );
    expect(completedHtml).toContain('bg-emerald-50 text-emerald-700 border border-emerald-200');
  });

  it('6. Safety Fallback: Forces all stores active with Quick Settlement Bar when PO is in CLAIM but no items have shortage/damage', () => {
    // Multi-store PO where all items have shortageQty = 0 and damagedQty = 0, but status is IN_CLAIM
    const noItemDisputeClaimPO = {
      ...mockPO,
      status: 'IN_CLAIM',
      items: [
        {
          ...mockPO.items[0],
          actualStoreName: 'Store Alpha',
          shortageQty: 0,
          damagedQty: 0,
          claimStatus: null
        },
        {
          ...mockPO.items[1],
          actualStoreName: 'Store Beta',
          shortageQty: 0,
          damagedQty: 0,
          claimStatus: null
        }
      ]
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={noItemDisputeClaimPO}
            activeTab="CLAIM"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Both non-disputed stores should collapse into Slim Muted Rows ((รับของครบสมบูรณ์))
    expect(html).toContain('Store Alpha');
    expect(html).toContain('Store Beta');
    expect(html).not.toContain('⚠️ คลังแจ้งปัญหา:');
    expect(html).toContain('(รับของครบสมบูรณ์)');
  });
});
