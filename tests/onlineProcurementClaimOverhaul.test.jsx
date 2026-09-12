import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';
import OnlineTaskView, { hasUnresolvedClaim } from '../src/views/OnlineTaskView';
import OnlineOrderCard from '../src/views/procurement/OnlineOrderCard';
import { OnlineProcurementHub } from '../src/views/procurement/OnlineProcurementHub';
import { storageService } from '../src/services/storageService';
import { workflowEngine } from '../src/services/workflowEngine';
import { AppProvider } from '../src/context/AppContext';

describe('Online Claim Management Overhaul & Workflow Closure', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. State Machine & Tab Filtering Logic (hasUnresolvedClaim)', () => {
    it('returns true when a PO has at least 1 unresolved store claim', () => {
      const po = {
        id: 'PO-CLAIM-01',
        poNo: 'PO-2026-001',
        status: 'IN_CLAIM',
        department: 'QC',
        items: [
          {
            id: 'item-1',
            name: 'Reagent A',
            code: 'QC-A',
            storePlatform: 'Shopee',
            actualStoreName: 'ChemStore',
            shortageQty: 2,
            unitPrice: 500,
            claimStatus: 'PENDING'
          }
        ],
        storeClaims: {}
      };

      expect(hasUnresolvedClaim(po)).toBe(true);
    });

    it('returns false when all disputed stores in the PO are resolved', () => {
      const po = {
        id: 'PO-CLAIM-01',
        poNo: 'PO-2026-001',
        status: 'IN_CLAIM',
        department: 'QC',
        items: [
          {
            id: 'item-1',
            name: 'Reagent A',
            code: 'QC-A',
            storePlatform: 'Shopee',
            actualStoreName: 'ChemStore',
            shortageQty: 2,
            unitPrice: 500,
            claimStatus: 'PENDING'
          }
        ],
        storeClaims: {
          'Shopee_ChemStore': {
            status: 'RESOLVED',
            type: 'REFUND',
            refundAmount: 1000
          }
        }
      };

      expect(hasUnresolvedClaim(po)).toBe(false);
    });

    it('returns false if PO status is COMPLETED, CLOSED, or RESOLVED regardless of items', () => {
      const poCompleted = {
        id: 'PO-CLAIM-02',
        status: 'COMPLETED',
        items: [{ shortageQty: 1, unitPrice: 200 }]
      };
      const poClosed = {
        id: 'PO-CLAIM-03',
        status: 'CLOSED',
        items: [{ shortageQty: 1, unitPrice: 200 }]
      };
      const poResolved = {
        id: 'PO-CLAIM-04',
        status: 'RESOLVED',
        items: [{ shortageQty: 1, unitPrice: 200 }]
      };

      expect(hasUnresolvedClaim(poCompleted)).toBe(false);
      expect(hasUnresolvedClaim(poClosed)).toBe(false);
      expect(hasUnresolvedClaim(poResolved)).toBe(false);
    });

    it('handles multi-store PO: returns true if Store 1 resolved but Store 2 is still pending', () => {
      const multiStorePO = {
        id: 'PO-MULTI-01',
        status: 'IN_CLAIM',
        department: 'PD',
        items: [
          {
            id: 'item-1',
            name: 'Item From Store 1',
            storePlatform: 'Shopee',
            actualStoreName: 'Store 1',
            shortageQty: 1,
            unitPrice: 300
          },
          {
            id: 'item-2',
            name: 'Item From Store 2',
            storePlatform: 'Lazada',
            actualStoreName: 'Store 2',
            shortageQty: 2,
            unitPrice: 400
          }
        ],
        storeClaims: {
          'Shopee_Store 1': { status: 'RESOLVED', type: 'REFUND', refundAmount: 300 }
          // Lazada_Store 2 is not yet resolved!
        }
      };

      expect(hasUnresolvedClaim(multiStorePO)).toBe(true);

      // Once Store 2 is also resolved:
      multiStorePO.storeClaims['Lazada_Store 2'] = {
        status: 'RESOLVED',
        type: 'REPLACEMENT',
        newTrackingNo: 'TH123456'
      };

      expect(hasUnresolvedClaim(multiStorePO)).toBe(false);
    });
  });

  describe('2. Urgent SLA Pulse Indicator on Tab รอเคลม', () => {
    it('renders pulsating ping radar dot and urgent rose badge when claim items exist', () => {
      const mockPOs = [
        {
          id: 'PO-ONLINE-01',
          poNo: 'PO-QC-2026-001',
          purchaseChannel: 'ONLINE',
          status: 'IN_CLAIM',
          department: 'QC',
          totalAmount: 1500,
          items: [
            {
              id: 'it-1',
              name: 'Chemical X',
              storePlatform: 'Shopee',
              actualStoreName: 'Shop A',
              shortageQty: 1,
              unitPrice: 1500,
              claimStatus: 'PENDING'
            }
          ]
        }
      ];

      storageService.savePOs(mockPOs);

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineTaskView currentRole={{ id: 'PURCHASER', name: 'Purchaser' }} />
          </AppProvider>
        </MemoryRouter>
      );

      // Must contain "รอเคลม" text
      expect(html).toContain('รอเคลม');
      // Must contain animate-ping for the radar indicator
      expect(html).toContain('animate-ping');
      // Must contain bg-rose-500 badge
      expect(html).toContain('bg-rose-500');
    });
  });

  describe('3. Clean Bordered Settlement Card (Kill Monster Pink Form)', () => {
    it('renders compact issue alert and 4-column single-line grid with indigo button instead of monster pink form', () => {
      const disputedPO = {
        id: 'PO-DISPUTE-01',
        poNo: 'PO-2026-DISP',
        status: 'IN_CLAIM',
        department: 'QC',
        vendorName: 'Shopee Shop',
        items: [
          {
            id: 'it-1',
            code: 'CH-01',
            name: 'Reagent Bottle',
            purchaseQty: 5,
            unit: 'ขวด',
            purchaseUnit: 'ขวด',
            unitPrice: 200,
            actualPrice: 200,
            storePlatform: 'Shopee',
            actualStoreName: 'ChemDirect',
            shortageQty: 2,
            damagedQty: 0,
            claimStatus: 'PENDING'
          }
        ],
        storeClaims: {}
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard
              po={disputedPO}
              activeTab="CLAIM"
              currentRole={{ id: 'PURCHASER', name: 'Online Purchaser' }}
              onUpdate={vi.fn()}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // Card Header Status Badge in CLAIM tab must be red
      expect(html).toContain('🔴 รอเคลม (1 ร้านค้า)');
      // Must NOT display "ปิดงานสำเร็จ (เคลมครบ)" in claim tab
      expect(html).not.toContain('ปิดงานสำเร็จ (เคลมครบ)');

      // Compact issue alert banner check
      expect(html).toContain('⚠️ คลังแจ้งปัญหา:');
      expect(html).toContain('ขาด 2 ขวด');
      expect(html).toContain('มูลค่า ฿400.00');

      // Form inputs: Dropdown, Refund Amount (with คืนเต็มจำนวน), Progress Note, Save Button
      expect(html).toContain('💰 คืนเงิน (Refund)');
      expect(html).toContain('📦 ร้านส่งของใหม่มาเปลี่ยน (Replacement)');
      expect(html).toContain('❌ ยกเลิกรายการ');
      expect(html).toContain('คืนเต็มจำนวน');
      expect(html).toContain('บันทึกความคืบหน้าสั้น ๆ เช่น แชทร้านค้าโอนเงินคืนแล้ว...');

      // Button must be indigo/emerald style, NOT rose-600 red
      expect(html).toContain('✓ บันทึกผลเจรจา');
      expect(html).toContain('bg-indigo-600');
      // No giant monster pink form container
      expect(html).not.toContain('from-rose-50/60 to-white');
    });
  });

  describe('4. Automated Settlement & Budget Rollback (Workflow Closure)', () => {
    it('workflowEngine.resolveClaim handles CANCEL and store-level resolution to COMPLETED', async () => {
      const initialPO = {
        id: 'PO-WF-01',
        poNo: 'PO-WF-01',
        purchaseChannel: 'ONLINE',
        status: 'IN_CLAIM',
        department: 'PD',
        items: [{ id: '1', code: 'C1', name: 'Item', price: 500, qty: 2, shortageQty: 1 }]
      };
      storageService.savePOs([initialPO]);

      const res = await workflowEngine.resolveClaim('PO-WF-01', {
        type: 'CANCEL',
        refundAmount: 500,
        note: 'ยกเลิกรายการร้านค้า',
        storeKey: 'Shopee_Shop',
        allStoresResolved: true
      }, { name: 'Admin', title: 'Admin' });

      // Status must transition to COMPLETED
      expect(res.status).toBe('COMPLETED');
      expect(res.claimStatus).toBe('RESOLVED');
      expect(res.storeClaims['Shopee_Shop'].status).toBe('RESOLVED');

      // Budget transaction log must record restored amount
      const txs = storageService.getBudgetTransactions();
      const claimTx = txs.find(t => t.refId === 'PO-WF-01');
      expect(claimTx).toBeDefined();
      expect(claimTx.amount).toBe(500);
      expect(claimTx.note).toContain('จัดซื้อเจรจาเคลมสำเร็จ ได้รับเงินคืน ฿500 เข้าแผนก');
    });

    it('OnlineProcurementHub exports the same unified component', () => {
      expect(OnlineProcurementHub).toBeDefined();
      expect(OnlineProcurementHub).toBe(OnlineTaskView);
    });
  });
});
