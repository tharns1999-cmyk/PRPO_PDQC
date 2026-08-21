import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { ROLES } from '../src/config/constants';
import { workflowEngine } from '../src/services/workflowEngine';
import { storageService } from '../src/services/storageService';
import { apiService } from '../src/services/apiService';

describe('New System Enhancements & Business Rules Verification', () => {
  beforeEach(() => {
    storageService.resetData();
    storageService.saveVendors([
      { id: 'VEN-01', code: 'VND-001', name: 'บริษัท วัสดุไทย จำกัด' },
      { id: 'VEN-02', code: 'VND-002', name: 'บริษัท เคมีอุตสาหกรรม จำกัด' }
    ]);
    storageService.saveProducts([
      { id: 'PROD-1', code: 'ITM-001', name: 'ถุงมือยาง (ชิ้น)', category: 'PD', price: 10, supplierId: 'VEN-01', stockBalance: 100, unit: 'ชิ้น', purchaseUnit: 'ชิ้น', stockUnit: 'ชิ้น', conversionRate: 1 },
      { id: 'PROD-2', code: 'ITM-002', name: 'น้ำมันหล่อลื่น (ลิตร)', category: 'PD', price: 500, supplierId: 'VEN-02', stockBalance: 20, unit: 'ลิตร', purchaseUnit: 'ถัง', stockUnit: 'ลิตร', conversionRate: 50 }
    ]);
  });

  describe('1. Duplicate Code Guardrail (Trim & Case-insensitive)', () => {
    it('prevents saving product with duplicate code (ignoring spaces and casing)', async () => {
      await expect(apiService.saveProduct({
        code: '  itm-001  ',
        name: 'ถุงมือยางใหม่',
        category: 'PD',
        price: 15,
        stockUnit: 'ชิ้น'
      })).rejects.toThrow(/มีอยู่ในระบบแล้ว/);
    });

    it('allows updating the existing product with the same code', async () => {
      const updated = await apiService.saveProduct({
        id: 'PROD-1',
        code: 'ITM-001',
        name: 'ถุงมือยางเกรด A',
        category: 'PD',
        price: 12,
        stockUnit: 'ชิ้น'
      });
      expect(updated.name).toBe('ถุงมือยางเกรด A');
    });

    it('prevents saving vendor with duplicate code (case-insensitive)', async () => {
      await expect(apiService.saveVendor({
        code: 'vnd-001',
        name: 'บริษัท ซ้ำซ้อน จำกัด',
        department: 'PD'
      })).rejects.toThrow(/มีอยู่ในระบบแล้ว/);
    });
  });

  describe('2. PR Financial Calculation (Discounts, 2-Mode VAT 7%, Rounding Adjustment)', () => {
    it('calculates Mode 1 VAT (AFTER_DISCOUNT) with line discount, order discount, and rounding', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-01',
        items: [
          {
            productId: 'PROD-1',
            price: 100,
            qty: 10,
            discountPercent: 10,
            discountAmount: 100,
            source: 'FACTORY'
          }
        ],
        financials: {
          subtotal: 1000,
          itemDiscountTotal: 100,
          combinedDiscountType: 'fixed',
          combinedDiscountValue: 100,
          combinedDiscountAmount: 100,
          totalDiscount: 200,
          vatMode: 'AFTER_DISCOUNT',
          vatAmount: 56,
          roundingAdj: 0.50,
          grandTotal: 856.50
        }
      }, ROLES.REQUESTER_PD);

      expect(pr.financials.subtotal).toBe(1000);
      expect(pr.financials.totalDiscount).toBe(200);
      expect(pr.financials.vatAmount).toBe(56);
      expect(pr.financials.roundingAdj).toBe(0.50);
      expect(pr.financials.grandTotal).toBe(856.50);
      expect(pr.totalAmount).toBe(856.50);
      expect(pr.items[0].source).toBe('FACTORY');
    });

    it('calculates Mode 2 VAT (BEFORE_DISCOUNT): VAT calculated on subtotal before subtracting order discount', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-01',
        items: [
          {
            productId: 'PROD-1',
            price: 1000,
            qty: 1,
            discountPercent: 0,
            discountAmount: 0,
            source: 'OFFICE'
          }
        ],
        financials: {
          subtotal: 1000,
          itemDiscountTotal: 0,
          combinedDiscountType: 'fixed',
          combinedDiscountValue: 100,
          combinedDiscountAmount: 100,
          totalDiscount: 100,
          vatMode: 'BEFORE_DISCOUNT',
          vatAmount: 70,
          roundingAdj: -0.20,
          grandTotal: 969.80
        }
      }, ROLES.REQUESTER_PD);

      expect(pr.financials.vatMode).toBe('BEFORE_DISCOUNT');
      expect(pr.financials.vatAmount).toBe(70);
      expect(pr.financials.grandTotal).toBe(969.80);
      expect(pr.items[0].source).toBe('OFFICE');
    });
  });

  describe('3. Goods Receiving: Storage Location, Defective/NG Item, & Short-Close PO', () => {
    it('records storage location and updates usable stock for good items', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-01',
        items: [{ productId: 'PROD-1', qty: 10, price: 10 }]
      }, ROLES.REQUESTER_PD);

      await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);
      const { po } = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);

      // Receive 10 items at location "A-12"
      const result = await apiService.receiveGoods(
        po.id,
        [{ productId: 'PROD-1', receivedThisTime: 10 }],
        ROLES.REQUESTER_PD,
        'รับครบถ้วน',
        {
          receivingLocations: { 'PROD-1': 'A-12' },
          problematicItems: { 'PROD-1': { isProblematic: false, defectReason: '' } },
          grAttachments: [{ name: 'slip.jpg', type: 'image/jpeg', previewUrl: 'data:...' }]
        }
      );

      expect(result.status).toBe('CLOSED');
      const updatedProd = storageService.getProducts().find(p => p.id === 'PROD-1');
      expect(updatedProd.stockBalance).toBe(110);
      expect(result.items[0].receivingLocation).toBe('A-12');
      expect(result.grAttachments.length).toBe(1);
    });

    it('does NOT add defective items to usable stockBalance and logs them as NG', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-01',
        items: [{ productId: 'PROD-1', qty: 5, price: 10 }]
      }, ROLES.REQUESTER_PD);

      await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);
      const { po } = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);

      const initialStock = storageService.getProducts().find(p => p.id === 'PROD-1').stockBalance;

      // Receive 5 items but marked as DEFECTIVE
      const result = await apiService.receiveGoods(
        po.id,
        [{ productId: 'PROD-1', receivedThisTime: 5 }],
        ROLES.REQUESTER_PD,
        'พบของชำรุด',
        {
          receivingLocations: { 'PROD-1': 'A-NG-BIN' },
          problematicItems: {
            'PROD-1': { isProblematic: true, defectReason: 'ถุงมือฉีกขาดทั้ง 5 ชิ้น' }
          }
        }
      );

      const currentProd = storageService.getProducts().find(p => p.id === 'PROD-1');
      expect(currentProd.stockBalance).toBe(initialStock);
      expect(result.items[0].receivedNgQty).toBe(5);
      expect(result.ngItems.length).toBe(1);
      expect(result.ngItems[0].defectReason).toBe('ถุงมือฉีกขาดทั้ง 5 ชิ้น');
    });

    it('supports short-closing a PO with a mandatory reason', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-01',
        items: [{ productId: 'PROD-1', qty: 20, price: 10 }]
      }, ROLES.REQUESTER_PD);

      await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);
      const { po } = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);

      // Partially receive 5
      await apiService.receiveGoods(po.id, [{ productId: 'PROD-1', receivedThisTime: 5 }], ROLES.REQUESTER_PD);

      // Short-close the remaining 15
      const closedPO = await apiService.shortClosePO(po.id, 'ร้านค้าแจ้งเลิกผลิตสินค้ารุ่นนี้แล้ว', ROLES.REQUESTER_PD);
      expect(closedPO.status).toBe('CLOSED');
      expect(closedPO.closedEarly).toBe(true);
      expect(closedPO.shortCloseReason).toBe('ร้านค้าแจ้งเลิกผลิตสินค้ารุ่นนี้แล้ว');
    });
  });
});
