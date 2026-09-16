import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup.js';

import { storageService } from '../src/services/storageService';
import { apiService } from '../src/services/apiService';
import { matchDepartment, isDepartmentMatch } from '../src/utils/permissions';
import { generateNextProductCode, generateNextCode, generateNextVendorCode } from '../src/utils/idGenerator';
import { getUnifiedProductList } from '../src/views/PRCreateView';
import { deduplicateMasterData } from '../src/views/MasterDataView';

describe('Domain Suite: Department-Scoped SKU & Vendor Code Uniqueness & Auto-Sequence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageService.resetData();
    localStorage.clear();

    // Initial state: PD has Code "1" and "2", QC is empty
    storageService.saveProducts([
      {
        id: 'PROD-PD-001',
        code: '1',
        name: 'ถุงมือกันร้อน (ฝ่ายผลิต)',
        department: 'PD',
        category: 'PD',
        price: 150,
        stockUnit: 'คู่'
      },
      {
        id: 'PROD-PD-002',
        code: '2',
        name: 'น้ำยาหล่อเย็นเครื่องจักร (ฝ่ายผลิต)',
        department: 'PD',
        category: 'PD',
        price: 450,
        stockUnit: 'แกลลอน'
      }
    ]);

    // Initial vendors: PD has VND-01
    storageService.saveVendors([
      {
        id: 'VEN-PD-001',
        code: 'VND-01',
        name: 'บริษัท ซัพพลายเออร์ ฝ่ายผลิต จำกัด',
        department: 'PD'
      }
    ]);
  });

  // ══════════════════════════════════════════════════════════════════
  // 1. Product SKU Scoping & Composite Uniqueness (Department + Code)
  // ══════════════════════════════════════════════════════════════════
  describe('1. Product SKU / Code Scoping per Department', () => {
    it('allows QC department to use Code "1" even when PD already has Code "1"', async () => {
      const qcProduct = await apiService.saveProduct({
        code: '1',
        name: 'สารละลายสอบเทียบ pH (QC)',
        category: 'QC',
        department: 'QC',
        price: 800,
        stockUnit: 'ขวด'
      });

      expect(qcProduct).toBeDefined();
      expect(qcProduct.code).toBe('1');
      expect(qcProduct.department).toBe('QC');

      const allProds = storageService.getProducts();
      const code1Items = allProds.filter(p => String(p.code).trim() === '1');
      expect(code1Items.length).toBe(2);

      const pdItem = code1Items.find(p => matchDepartment(p.department, 'PD'));
      const qcItem = code1Items.find(p => matchDepartment(p.department, 'QC'));

      expect(pdItem).toBeDefined();
      expect(pdItem.name).toBe('ถุงมือกันร้อน (ฝ่ายผลิต)');
      expect(qcItem).toBeDefined();
      expect(qcItem.name).toBe('สารละลายสอบเทียบ pH (QC)');
    });

    it('blocks saving duplicate Code "1" when both items belong to the same department (QC)', async () => {
      // First save in QC succeeds
      await apiService.saveProduct({
        code: '1',
        name: 'สารละลายสอบเทียบ pH (QC)',
        category: 'QC',
        department: 'QC',
        price: 800,
        stockUnit: 'ขวด'
      });

      // Second save in QC with the same code "1" must be rejected
      await expect(
        apiService.saveProduct({
          code: ' 1 ',
          name: 'แผ่นทดสอบความสะอาด (QC อีกชิ้น)',
          category: 'QC',
          department: 'QC',
          price: 300,
          stockUnit: 'กล่อง'
        })
      ).rejects.toThrow(/มีอยู่ในระบบแล้ว/);
    });

    it('allows updating an existing product without triggering duplicate code error against itself', async () => {
      const updated = await apiService.saveProduct({
        id: 'PROD-PD-001',
        code: '1',
        name: 'ถุงมือกันร้อนเกรดทนความร้อนสูง (PD Updated)',
        category: 'PD',
        department: 'PD',
        price: 180,
        stockUnit: 'คู่'
      });

      expect(updated.name).toBe('ถุงมือกันร้อนเกรดทนความร้อนสูง (PD Updated)');
      const stored = storageService.getProducts().find(p => p.id === 'PROD-PD-001');
      expect(stored.name).toBe('ถุงมือกันร้อนเกรดทนความร้อนสูง (PD Updated)');
    });

    it('handles DEPT- prefix equivalence (e.g. DEPT-QC matches QC)', async () => {
      // Create with DEPT-QC
      await apiService.saveProduct({
        code: 'TEST-01',
        name: 'แถบวัดคลอรีน',
        category: 'DEPT-QC',
        department: 'DEPT-QC',
        price: 250,
        stockUnit: 'หลอด'
      });

      // Attempt duplicate using plain QC
      await expect(
        apiService.saveProduct({
          code: 'test-01',
          name: 'แถบวัดคลอรีน ซ้ำ',
          category: 'QC',
          department: 'QC',
          price: 250,
          stockUnit: 'หลอด'
        })
      ).rejects.toThrow(/มีอยู่ในระบบแล้ว/);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 2. Product Auto-Sequence Generation (generateNextProductCode)
  // ══════════════════════════════════════════════════════════════════
  describe('2. Product SKU Auto-Sequence Generation per Department', () => {
    it('calculates Next SKU independently for PD (where max is 2 -> next is 3)', () => {
      const products = storageService.getProducts();
      const nextPD = generateNextProductCode(products, 'PD');
      expect(nextPD).toBe('3');
      expect(generateNextCode(products, 'PD')).toBe('3');
    });

    it('calculates Next SKU independently for QC (where list is empty -> next is 1)', () => {
      const products = storageService.getProducts();
      const nextQC = generateNextProductCode(products, 'QC');
      expect(nextQC).toBe('1');
    });

    it('calculates Next SKU for QC after adding QC products (e.g. Code 1 -> next is 2)', () => {
      const products = [
        ...storageService.getProducts(),
        { id: 'PROD-QC-001', code: '1', department: 'QC', category: 'QC' }
      ];
      const nextQC = generateNextProductCode(products, 'QC');
      expect(nextQC).toBe('2');

      // PD still calculates based on PD items
      const nextPD = generateNextProductCode(products, 'PD');
      expect(nextPD).toBe('3');
    });

    it('ignores non-numeric or alphanumeric codes when computing numeric sequence', () => {
      const mixedProducts = [
        { id: 'P1', code: 'PD-OIL-01', department: 'PD' },
        { id: 'P2', code: '5', department: 'PD' },
        { id: 'P3', code: 'PD-SPECIAL', department: 'PD' },
        { id: 'P4', code: '2', department: 'PD' }
      ];
      expect(generateNextProductCode(mixedProducts, 'PD')).toBe('6');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 3. Vendor Code Scoping per Department & ALL
  // ══════════════════════════════════════════════════════════════════
  describe('3. Vendor Code Scoping per Department & ALL', () => {
    it('allows QC department to save Vendor Code "VND-01" even when PD has "VND-01"', async () => {
      const qcVendor = await apiService.saveVendor({
        code: 'VND-01',
        name: 'บริษัท เครื่องมือทดสอบแล็บ จำกัด (QC)',
        department: 'QC'
      });

      expect(qcVendor).toBeDefined();
      expect(qcVendor.code).toBe('VND-01');
      expect(qcVendor.department).toBe('QC');

      const allVendors = storageService.getVendors();
      const vnd01List = allVendors.filter(v => v.code === 'VND-01');
      expect(vnd01List.length).toBe(2);
    });

    it('blocks saving duplicate Vendor Code "VND-01" within the same department (QC)', async () => {
      // First vendor in QC
      await apiService.saveVendor({
        code: 'VND-01',
        name: 'บริษัท เครื่องมือทดสอบแล็บ จำกัด (QC)',
        department: 'QC'
      });

      // Second vendor in QC with identical code must be blocked
      await expect(
        apiService.saveVendor({
          code: 'vnd-01',
          name: 'บริษัท แล็บวิทยาศาสตร์ จำกัด (QC ซ้ำ)',
          department: 'QC'
        })
      ).rejects.toThrow(/มีอยู่ในระบบแล้ว/);
    });

    it('blocks duplicate when a vendor has department scope "ALL"', async () => {
      // Create universal vendor in ALL
      await apiService.saveVendor({
        code: 'VND-SHARED-01',
        name: 'บริษัท ส่วนกลาง ซัพพลาย จำกัด',
        department: 'ALL'
      });

      // Creating same code in QC conflicts with ALL
      await expect(
        apiService.saveVendor({
          code: 'vnd-shared-01',
          name: 'พยายามสร้างซ้ำใน QC',
          department: 'QC'
        })
      ).rejects.toThrow(/มีอยู่ในระบบแล้ว/);
    });

    it('calculates generateNextVendorCode with department-specific prefix and sequence', () => {
      const vendors = [
        { id: 'V1', code: 'VND-PD-01', department: 'PD' },
        { id: 'V2', code: 'VND-PD-02', department: 'PD' },
        { id: 'V3', code: 'VND-QC-01', department: 'QC' }
      ];

      expect(generateNextVendorCode(vendors, 'PD')).toBe('VND-PD-03');
      expect(generateNextVendorCode(vendors, 'QC')).toBe('VND-QC-02');
      expect(generateNextVendorCode(vendors, 'ALL')).toBe('VND-03');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 4. storageService direct consistency checks
  // ══════════════════════════════════════════════════════════════════
  describe('4. storageService direct operations with department scope', () => {
    it('storageService.saveProduct allows same code in different department and blocks within same', () => {
      // Save code 99 in PD
      storageService.saveProduct({
        id: 'P-PD-99',
        code: '99',
        name: 'ของ PD',
        department: 'PD'
      });

      // Save code 99 in QC (allowed)
      const qcProd = storageService.saveProduct({
        id: 'P-QC-99',
        code: '99',
        name: 'ของ QC',
        department: 'QC'
      });
      expect(qcProd.code).toBe('99');
      expect(qcProd.department).toBe('QC');

      // Save another code 99 in QC (rejected)
      expect(() => {
        storageService.saveProduct({
          code: '99',
          name: 'ของ QC ซ้ำ',
          department: 'QC'
        });
      }).toThrow(/มีอยู่ในระบบแล้ว/);
    });

    it('storageService.saveVendor allows same code in different department', () => {
      storageService.saveVendor({
        id: 'V-PD-10',
        code: 'VND-10',
        name: 'Vendor PD',
        department: 'PD'
      });

      const qcVen = storageService.saveVendor({
        id: 'V-QC-10',
        code: 'VND-10',
        name: 'Vendor QC',
        department: 'QC'
      });

      expect(qcVen.code).toBe('VND-10');
      expect(qcVen.department).toBe('QC');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 5. Regression Test: QC Code 1 Survival across AppContext, storageService, and MasterDataView
  // ══════════════════════════════════════════════════════════════════
  describe('5. Regression: QC Code 1 must survive sync and deduplication across all layers', () => {
    it('retains all 4 products (PD 2 items, QC 2 items) without dropping QC Code 1', () => {
      const mockSheetsData = [
        { id: 'PROD-PD-1', code: 1, name: 'ถุงมือกันร้อน', department: 'PD', category: 'PD', status: 'ACTIVE', isActive: 'TRUE' },
        { id: 'PROD-PD-2', code: 2, name: 'ถ่านไฟฉาย', department: 'PD', category: 'PD', status: 'ACTIVE', isActive: 'TRUE' },
        { id: 'PROD-QC-1', code: 3, name: 'strip วัดคลอรีน', department: 'QC', category: 'QC', status: 'ACTIVE', isActive: 'TRUE' },
        { id: 'PROD-QC-2', code: 1, name: 'ที่วัดความร้อน', department: 'QC', category: 'QC', status: 'ACTIVE', isActive: 'TRUE' }
      ];

      // 1. getUnifiedProductList (used by AppContext hydration, PRCreateView, and ProductSelectDropdown)
      const unified = getUnifiedProductList(mockSheetsData);
      expect(unified.length).toBe(4);
      const qc1InUnified = unified.find(p => p.id === 'PROD-QC-2');
      expect(qc1InUnified).toBeDefined();
      expect(qc1InUnified.name).toBe('ที่วัดความร้อน');
      expect(String(qc1InUnified.code)).toBe('1');
      const pd1InUnified = unified.find(p => p.id === 'PROD-PD-1');
      expect(pd1InUnified).toBeDefined();
      expect(pd1InUnified.name).toBe('ถุงมือกันร้อน');
      expect(String(pd1InUnified.code)).toBe('1');

      // 2. storageService.saveProducts & getProducts
      storageService.saveProducts(mockSheetsData);
      const stored = storageService.getProducts();
      expect(stored.length).toBe(4);
      const qc1InStored = stored.find(p => p.id === 'PROD-QC-2');
      expect(qc1InStored).toBeDefined();
      expect(qc1InStored.name).toBe('ที่วัดความร้อน');
      expect(String(qc1InStored.code)).toBe('1');
      const pd1InStored = stored.find(p => p.id === 'PROD-PD-1');
      expect(pd1InStored).toBeDefined();
      expect(pd1InStored.name).toBe('ถุงมือกันร้อน');
      expect(String(pd1InStored.code)).toBe('1');

      // 3. deduplicateMasterData (used by MasterDataView)
      const deduped = deduplicateMasterData(mockSheetsData);
      expect(deduped.length).toBe(4);
      const qc1InDeduped = deduped.find(p => p.id === 'PROD-QC-2');
      expect(qc1InDeduped).toBeDefined();
      expect(qc1InDeduped.name).toBe('ที่วัดความร้อน');
      expect(String(qc1InDeduped.code)).toBe('1');
      const pd1InDeduped = deduped.find(p => p.id === 'PROD-PD-1');
      expect(pd1InDeduped).toBeDefined();
      expect(pd1InDeduped.name).toBe('ถุงมือกันร้อน');
      expect(String(pd1InDeduped.code)).toBe('1');

      // 4. Verify department counts (PD: 2, QC: 2)
      const pdItems = deduped.filter(p => matchDepartment(p.department || p.category, 'PD'));
      const qcItems = deduped.filter(p => matchDepartment(p.department || p.category, 'QC'));
      expect(pdItems.length).toBe(2);
      expect(qcItems.length).toBe(2);
    });
  });
});
