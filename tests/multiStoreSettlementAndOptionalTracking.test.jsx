import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';
import OnlineTaskView, { hasUnresolvedClaim } from '../src/views/OnlineTaskView';
import OnlineOrderCard from '../src/views/procurement/OnlineOrderCard';
import { storageService } from '../src/services/storageService';
import { workflowEngine } from '../src/services/workflowEngine';
import { AppProvider } from '../src/context/AppContext';

describe('Multi-Store Settlement & Optional Tracking/Note (Image 1 & Image 2 Fixes)', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. Directive 1: Optional Validation (Image 1 Fix)', () => {
    it('renders tracking number input with placeholder "ระบุเลขพัสดุชดเชย (ถ้ามี)..." without required attribute', () => {
      const disputedPO = {
        id: 'PO-TEST-OPTIONAL-01',
        poNo: 'PO-2026-OPT1',
        status: 'IN_CLAIM',
        department: 'QC',
        items: [
          {
            id: 'item-1',
            name: 'Reagent A',
            storePlatform: 'Shopee',
            actualStoreName: 'ChemStore',
            shortageQty: 1,
            unitPrice: 300,
            claimStatus: 'PENDING'
          }
        ],
        storeClaims: {
          'Shopee_ChemStore': {
            type: 'REPLACEMENT',
            status: 'DISPUTED'
          }
        }
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

      // The placeholder for tracking when replacement option exists
      expect(html).toContain('ระบุเลขพัสดุชดเชย (ถ้ามี)...');
      // No required attribute on tracking
      expect(html).not.toMatch(/placeholder="ระบุเลขพัสดุชดเชย \(ถ้ามี\)\.\.\."[^>]*required/);
      // Note input placeholder and no required
      expect(html).toContain('บันทึกช่วยจำ (เช่น ทักแชทร้านค้าแล้ว)...');
      expect(html).not.toMatch(/placeholder="บันทึกช่วยจำ[^>]*required/);
    });

    it('allows resolving claim via workflowEngine with empty tracking number and empty note', async () => {
      const initialPO = {
        id: 'PO-OPT-02',
        poNo: 'PO-OPT-02',
        purchaseChannel: 'ONLINE',
        status: 'IN_CLAIM',
        department: 'QC',
        items: [{ id: '1', code: 'C1', name: 'Reagent', price: 300, qty: 1, shortageQty: 1 }]
      };
      storageService.savePOs([initialPO]);

      // Resolve with empty tracking and empty note
      const res = await workflowEngine.resolveClaim('PO-OPT-02', {
        type: 'REPLACEMENT',
        newTrackingNo: '',
        note: '',
        storeKey: 'Shopee_ChemStore',
        allStoresResolved: true
      }, { name: 'Tharn Online Purchaser', title: 'Purchaser' });

      expect(res.status).toBe('ORDERED_PENDING_DELIVERY');
      expect(res.storeClaims['Shopee_ChemStore']).toBeDefined();
      expect(res.storeClaims['Shopee_ChemStore'].isResolved).toBe(true);
      expect(res.storeClaims['Shopee_ChemStore'].newTrackingNo).toBe('');
    });
  });

  describe('2. Directive 2: Store-Level Multi-Store Settlement (Image 2 Fix)', () => {
    it('workflowEngine preserves PO in IN_CLAIM when only 1 store of 2 is resolved', async () => {
      const initialPO = {
        id: 'PO-MULTI-TEST-01',
        poNo: 'PO-MULTI-01',
        purchaseChannel: 'ONLINE',
        status: 'IN_CLAIM',
        claimStatus: 'IN_CLAIM',
        department: 'PD',
        items: [
          { id: '1', code: 'C1', name: 'Item Store 1', price: 400, qty: 1, shortageQty: 1, storePlatform: 'Shopee', actualStoreName: 'Store1' },
          { id: '2', code: 'C2', name: 'Item Store 2', price: 600, qty: 1, shortageQty: 1, storePlatform: 'Lazada', actualStoreName: 'Store2' }
        ],
        storeClaims: {}
      };
      storageService.savePOs([initialPO]);

      // Resolve ONLY Store 1 (allStoresResolved = false)
      const res = await workflowEngine.resolveClaim('PO-MULTI-TEST-01', {
        type: 'REFUND',
        refundAmount: 400,
        note: 'เคลมเงินคืนร้าน 1',
        storeKey: 'Shopee_Store1',
        allStoresResolved: false
      }, { name: 'Tharn Online Purchaser', title: 'Purchaser' });

      // PO MUST NOT transition to COMPLETED!
      expect(res.status).not.toBe('COMPLETED');
      expect(['IN_CLAIM', 'PARTIALLY_RECEIVED_IN_CLAIM']).toContain(res.status);
      expect(res.claimStatus).toBe('IN_CLAIM');

      // Store 1 claim must be saved and marked isResolved: true
      expect(res.storeClaims['Shopee_Store1']).toBeDefined();
      expect(res.storeClaims['Shopee_Store1'].status).toBe('RESOLVED');
      expect(res.storeClaims['Shopee_Store1'].isResolved).toBe(true);
      expect(res.storeClaims['Shopee_Store1'].refundAmount).toBe(400);

      // Store 2 is still pending
      expect(res.storeClaims['Lazada_Store2']).toBeUndefined();
    });

    it('hasUnresolvedClaim returns true when 1 store is resolved and 1 store is pending', () => {
      const poWithPartialStoreResolution = {
        id: 'PO-MULTI-TEST-01',
        poNo: 'PO-MULTI-01',
        status: 'PARTIALLY_RECEIVED_IN_CLAIM',
        department: 'PD',
        items: [
          { id: '1', code: 'C1', name: 'Item Store 1', unitPrice: 400, qty: 1, shortageQty: 1, storePlatform: 'Shopee', actualStoreName: 'Store1', claimStatus: 'PENDING' },
          { id: '2', code: 'C2', name: 'Item Store 2', unitPrice: 600, qty: 1, shortageQty: 1, storePlatform: 'Lazada', actualStoreName: 'Store2', claimStatus: 'PENDING' }
        ],
        storeClaims: {
          'Shopee_Store1': {
            status: 'RESOLVED',
            isResolved: true,
            type: 'REFUND',
            refundAmount: 400
          }
        }
      };

      // Since Store 2 is not resolved, PO must still be in CLAIM tab
      expect(hasUnresolvedClaim(poWithPartialStoreResolution)).toBe(true);
    });

    it('renders Badge 🔴 รอเคลม (1 ร้านค้า) and displays ✓ บันทึกผลเจรจาเรียบร้อย for resolved store in UI', () => {
      const poWithPartialStoreResolution = {
        id: 'PO-MULTI-TEST-01',
        poNo: 'PO-MULTI-01',
        status: 'PARTIALLY_RECEIVED_IN_CLAIM',
        department: 'PD',
        items: [
          { id: '1', code: 'C1', name: 'Item Store 1', unitPrice: 400, qty: 1, shortageQty: 1, storePlatform: 'Shopee', actualStoreName: 'Store1', claimStatus: 'PENDING' },
          { id: '2', code: 'C2', name: 'Item Store 2', unitPrice: 600, qty: 1, shortageQty: 1, storePlatform: 'Lazada', actualStoreName: 'Store2', claimStatus: 'PENDING' }
        ],
        storeClaims: {
          'Shopee_Store1': {
            status: 'RESOLVED',
            isResolved: true,
            type: 'REFUND',
            refundAmount: 400,
            resolvedAt: new Date().toISOString()
          }
        }
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard
              po={poWithPartialStoreResolution}
              activeTab="CLAIM"
              currentRole={{ id: 'PURCHASER', name: 'Online Purchaser' }}
              onUpdate={vi.fn()}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // 1. Badge must reflect 1 remaining store needing claim
      expect(html).toContain('🔴 รอเคลม (1 ร้านค้า)');

      // 2. Store 1 must display resolved banner
      expect(html).toContain('✓ บันทึกผลเจรจาเรียบร้อย');
      expect(html).toContain('ได้รับเงินคืน ฿400.00 เข้าแผนกแล้ว');

      // 3. Store 2 must still display action button or quick settlement bar
      expect(html).toContain('ร้าน: Store2');
      expect(html).toContain('✓ บันทึกผลเจรจา');
    });

    it('transitions PO to COMPLETED only after all disputed stores are resolved', async () => {
      const initialPO = {
        id: 'PO-MULTI-TEST-02',
        poNo: 'PO-MULTI-02',
        purchaseChannel: 'ONLINE',
        status: 'IN_CLAIM',
        department: 'PD',
        items: [
          { id: '1', code: 'C1', name: 'Item Store 1', price: 400, qty: 1, shortageQty: 1, storePlatform: 'Shopee', actualStoreName: 'Store1' },
          { id: '2', code: 'C2', name: 'Item Store 2', price: 600, qty: 1, shortageQty: 1, storePlatform: 'Lazada', actualStoreName: 'Store2' }
        ],
        storeClaims: {
          'Shopee_Store1': {
            status: 'RESOLVED',
            isResolved: true,
            type: 'REFUND',
            refundAmount: 400
          }
        }
      };
      storageService.savePOs([initialPO]);

      // Resolve Store 2 (now all stores are resolved: allStoresResolved = true)
      const res = await workflowEngine.resolveClaim('PO-MULTI-TEST-02', {
        type: 'REFUND',
        refundAmount: 600,
        note: 'เคลมเงินคืนร้าน 2 ครบแล้ว',
        storeKey: 'Lazada_Store2',
        allStoresResolved: true
      }, { name: 'Tharn Online Purchaser', title: 'Purchaser' });

      // NOW it transitions to COMPLETED
      expect(res.status).toBe('COMPLETED');
      expect(res.claimStatus).toBe('RESOLVED');
      expect(res.storeClaims['Lazada_Store2'].isResolved).toBe(true);

      // And hasUnresolvedClaim becomes false
      expect(hasUnresolvedClaim(res)).toBe(false);
    });
  });
});
