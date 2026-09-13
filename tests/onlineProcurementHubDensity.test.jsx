import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext.jsx';
import OnlineOrderCard from '../src/views/procurement/OnlineOrderCard.jsx';
import { storageService } from '../src/services/storageService.js';

describe('Online Procurement Hub High-Density Layout & Regression Scenarios', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  const mockCompletedPO = {
    id: 'PO-PD-2026-001',
    poNo: 'PO-PD-2026-001',
    prNo: 'PR-PD-2026-088',
    department: 'PD',
    purchaseChannel: 'ONLINE',
    status: 'COMPLETED',
    claimStatus: 'RESOLVED',
    vendorName: 'Shopee Marketplace',
    estimatedAmount: 5105.00,
    totalAmount: 5105.00,
    refundAmount: 517.60,
    storeClaims: {
      'Shopee_storea': {
        storeKey: 'Shopee_storea',
        status: 'RESOLVED',
        type: 'REFUND',
        refundAmount: 246.00,
        resolvedAt: '2026-09-13T09:39:00.000Z'
      },
      'Shopee_packpro thailand': {
        storeKey: 'Shopee_packpro thailand',
        status: 'RESOLVED',
        type: 'REFUND',
        refundAmount: 271.60,
        resolvedAt: '2026-09-13T09:39:00.000Z'
      }
    },
    items: [
      {
        id: 'ITM-001',
        productId: 'PROD-001',
        sku: 'ITM-001',
        name: 'สายรัดพาเลทอย่างหนา 15 มม.',
        qty: 10,
        purchaseQty: 10,
        price: 387.50,
        unitPrice: 387.50,
        unit: 'ม้วน',
        platform: 'Shopee',
        storePlatform: 'Shopee',
        actualStoreName: 'PackPro Thailand',
        productUrl: 'https://shopee.co.th/product/111/222'
      },
      {
        id: 'ITM-002',
        productId: 'PROD-002',
        sku: 'ITM-002',
        name: 'น้ำมันหล่อลื่นอเนกประสงค์เกรดอาหาร',
        qty: 5,
        purchaseQty: 5,
        price: 246.00,
        unitPrice: 246.00,
        unit: 'ถัง',
        platform: 'Shopee',
        storePlatform: 'Shopee',
        actualStoreName: 'StoreA',
        refundAmt: 246.00,
        shortageQty: 1,
        productUrl: 'https://shopee.co.th/product/333/444'
      }
    ]
  };

  const mockPendingPO = {
    id: 'PO-PD-2026-002',
    poNo: 'PO-PD-2026-002',
    prNo: 'PR-PD-2026-089',
    department: 'PD',
    purchaseChannel: 'ONLINE',
    status: 'PENDING_ORDER',
    vendorName: 'Shopee Official Store',
    estimatedAmount: 2400.00,
    totalAmount: 2400.00,
    items: [
      {
        id: 'ITM-003',
        productId: 'PROD-003',
        sku: 'ITM-003',
        name: 'ถุงมือกันบาด Level 5',
        qty: 20,
        purchaseQty: 20,
        price: 120.00,
        unitPrice: 120.00,
        unit: 'คู่',
        platform: 'Shopee',
        storePlatform: 'Shopee',
        actualStoreName: 'SafetyFirst Shop',
        productUrl: 'https://shopee.co.th/product/555/666'
      }
    ]
  };

  const mockClaimPO = {
    id: 'PO-PD-2026-003',
    poNo: 'PO-PD-2026-003',
    prNo: 'PR-PD-2026-090',
    department: 'PD',
    purchaseChannel: 'ONLINE',
    status: 'IN_CLAIM',
    hasDispute: true,
    vendorName: 'ToolMaster Store',
    estimatedAmount: 3500.00,
    totalAmount: 3500.00,
    items: [
      {
        id: 'ITM-004',
        productId: 'PROD-004',
        sku: 'ITM-004',
        name: 'ชุดเครื่องมือช่างซ่อมบำรุง',
        qty: 2,
        purchaseQty: 2,
        price: 1750.00,
        unitPrice: 1750.00,
        unit: 'ชุด',
        platform: 'Shopee',
        storePlatform: 'Shopee',
        actualStoreName: 'ToolMaster Store',
        shortageQty: 1,
        damagedQty: 0,
        hasDispute: true,
        productUrl: 'https://shopee.co.th/product/777/888'
      }
    ]
  };

  it('Scenario 1 (Default Compact View in Completed Tab): Collapsed Compact Master Banner (~68px) renders key identifiers, consolidated financials, and completion badge without inner tables', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={mockCompletedPO}
            activeTab="CLOSED"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Master Banner layout & height tokens
    expect(html).toContain('rounded-xl p-3 sm:px-4 sm:py-2.5 transition-all mb-2.5');
    expect(html).toContain('cursor-pointer');

    // Left: Document numbers, department, store chip
    expect(html).toContain('PO-PD-2026-001');
    expect(html).toContain('PD');
    expect(html).toContain('PR: PR-PD-2026-088');
    expect(html).toContain('2 ร้านค้า');

    // Center: Consolidated Financial Metrics
    expect(html).toContain('งบ: ฿5,105.00');
    expect(html).toContain('จ่ายจริง: ฿4,587.40');
    expect(html).toContain('+คืน ฿517.60');

    // Right: Completion pill & Expand chevron button
    expect(html).toContain('✓ ปิดงานสำเร็จ 100%');
    expect(html).toContain('ดูรายละเอียด');

    // Col 3: Items snippet is rendered in compact row while full item table remains collapsed
    expect(html).toContain('สายรัดพาเลทอย่างหนา 15 มม. และอีก 1 รายการ');
    expect(html).not.toContain('น้ำมันหล่อลื่นอเนกประสงค์เกรดอาหาร');
  });

  it('Scenario 2 (Expand / Collapse Interaction): Clicking or setting defaultExpanded=true renders slim data rows, low-profile store dividers, and collapse triggers', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={mockCompletedPO}
            activeTab="CLOSED"
            defaultExpanded={true}
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Expanded Container tokens (p-3.5, mb-2.5)
    expect(html).toContain('rounded-2xl p-3.5 shadow-xs transition-all mb-2.5 font-sans');

    // Collapse controls (Header & Footer)
    expect(html).toContain('title="ย่อการ์ดสรุป"');
    expect(html).toContain('title="ย่อการ์ดนี้"');

    // Store Divider
    expect(html).toContain('ยอดร้านนี้:');

    // Slim data rows & 28px square thumbnails
    expect(html).toContain('w-7 h-7 rounded-md');
    expect(html).toContain('ITM-001');
    expect(html).toContain('ITM-002');
    expect(html).toContain('10 ม้วน × ฿387.50 =');

    // Consolidated Reconciliation Footer Pill
    expect(html).toContain('งบเดิม ฿5,105.00');
    expect(html).toContain('จ่ายจริง ฿4,587.40');
    expect(html).toContain('+คืนงบ ฿517.60');
  });

  it('Scenario 3 (Actionable Tab Readiness): Actionable tabs (PENDING, CLAIM) default to expanded view with compact inputs and quick settlement bar', () => {
    // 1. PENDING Tab: Defaults to expanded with editable inputs
    const pendingHtml = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={mockPendingPO}
            activeTab="PENDING"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    expect(pendingHtml).toContain('PO-PD-2026-002');
    expect(pendingHtml).toContain('รอดำเนินการสั่งซื้อ');
    expect(pendingHtml).toContain('ระบุชื่อร้านค้าจริง...');
    expect(pendingHtml).toContain('✓ ยืนยันการสั่งซื้อแล้ว');
    expect(pendingHtml).toContain('งบประเมิน PR:');

    // 2. CLAIM Tab: Defaults to expanded with Quick Settlement Action Bar
    const claimHtml = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={mockClaimPO}
            activeTab="CLAIM"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    expect(claimHtml).toContain('PO-PD-2026-003');
    expect(claimHtml).toContain('🚨 ขาด 1 ชุด');
    expect(claimHtml).toContain('มูลค่าที่ต้องเคลม');
    expect(claimHtml).toContain('คืนเงิน (Refund)');
    expect(claimHtml).toContain('✓ บันทึกผลเจรจา');
  });

  it('Scenario 4 (Visual Harmony & Elimination of Bulky Alert Banners): Resolves refund and replacement with clean micro-badges adjacent to item rows', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={mockCompletedPO}
            activeTab="CLOSED"
            defaultExpanded={true}
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'จัดซื้อออนไลน์', canOnlinePurchase: true }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Bulky full-width green alert banner container is eliminated
    expect(html).not.toContain('px-3.5 py-1.5 bg-slate-50/40');
    expect(html).not.toContain('text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 mt-1');

    // Low-profile inline store refund strip is rendered
    expect(html).toContain('px-3 py-1 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800');
    expect(html).toContain('✓ เคลมสำเร็จ: ได้รับเงินคืน ฿246.00 เข้าแผนกแล้ว');

    // Item row contains adjacent settlement micro-badge
    expect(html).toContain('✓ ได้รับเงินคืน ฿246.00 เข้าแผนกแล้ว (16:39)');
  });
});
