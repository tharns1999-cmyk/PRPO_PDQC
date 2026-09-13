import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { getUnifiedProductList } from '../src/views/PRCreateView';
import PRCreateView from '../src/views/PRCreateView';
import ProductSelectDropdown from '../src/components/procurement/ProductSelectDropdown';
import { AppProvider } from '../src/context/AppContext';

describe('PR Product Combobox/Dropdown Deduplication & Unified Master Data', () => {
  const duplicateProducts = [
    {
      id: 'PROD-001',
      code: 'itm-001',
      name: 'ถุงมือยางใหม่',
      category: 'PD',
      department: 'PD',
      unit: 'ชิ้น',
      price: 15,
      stockBalance: 100,
      reorderPoint: 20
    },
    {
      id: 'PROD-001-DUP',
      code: 'itm-001',
      name: 'ถุงมือยางใหม่ (รายการซ้ำ)',
      category: 'PD',
      department: 'PD',
      unit: 'ชิ้น',
      price: 15,
      stockBalance: 100,
      reorderPoint: 20
    },
    {
      id: 'PROD-PD-003',
      code: 'PD-BLT-380',
      name: 'สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15)',
      category: 'PD',
      department: 'PD',
      unit: 'เส้น',
      price: 620,
      stockBalance: 14,
      reorderPoint: 8
    },
    {
      id: 'PROD-PD-003-COPY',
      code: 'PD-BLT-380',
      name: 'สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15) - ซ้ำ',
      category: 'PD',
      department: 'PD',
      unit: 'เส้น',
      price: 620,
      stockBalance: 14,
      reorderPoint: 8
    },
    {
      id: 'PROD-INACTIVE',
      code: 'PD-OLD-001',
      name: 'สินค้าเก่าเลิกใช้',
      category: 'PD',
      department: 'PD',
      isActive: false
    },
    {
      id: 'P01',
      code: 'P01',
      name: 'Item 1 Mock Artifact',
      category: 'PD',
      department: 'PD'
    }
  ];

  const mockInventory = [
    {
      code: 'itm-001',
      stock: 150,
      rop: 25,
      unit: 'ชิ้น',
      department: 'PD'
    },
    {
      code: 'PD-BLT-380',
      remainingQty: 18,
      minStock: 10,
      unit: 'เส้น',
      department: 'PD'
    }
  ];

  describe('1. getUnifiedProductList Function', () => {
    it('deduplicates products with duplicate codes down to 1 item per unique code', () => {
      const result = getUnifiedProductList(duplicateProducts, []);
      const codes = result.map(p => p.code.toLowerCase());
      
      expect(codes.filter(c => c === 'itm-001')).toHaveLength(1);
      expect(codes.filter(c => c === 'pd-blt-380')).toHaveLength(1);
      expect(result.length).toBe(2);
    });

    it('enriches product with inventory stock and rop without creating new array items', () => {
      const result = getUnifiedProductList(duplicateProducts, mockInventory);
      
      const item1 = result.find(p => p.code.toLowerCase() === 'itm-001');
      expect(item1).toBeDefined();
      expect(item1.stock).toBe(150);
      expect(item1.rop).toBe(25);

      const belt = result.find(p => p.code.toLowerCase() === 'pd-blt-380');
      expect(belt).toBeDefined();
      expect(belt.stock).toBe(18);
      expect(belt.rop).toBe(10);

      expect(result).toHaveLength(2);
    });

    it('strictly filters out inactive items and blacklisted test artifacts (P01, P02, PROD-01)', () => {
      const result = getUnifiedProductList(duplicateProducts, mockInventory);
      const codes = result.map(p => p.code);
      
      expect(codes).not.toContain('PD-OLD-001');
      expect(codes).not.toContain('P01');
      expect(codes).not.toContain('P02');
    });
  });

  describe('2. PRCreateView Dropdown Options without Duplicates', () => {
    it('deduplicates options so that each product appears exactly once', () => {
      const unified = getUnifiedProductList(duplicateProducts, mockInventory);
      const pdProducts = unified.filter(p => p.department === 'PD');
      
      expect(pdProducts).toHaveLength(2);
      expect(pdProducts.map(p => p.code)).toEqual(['itm-001', 'PD-BLT-380']);
      expect(pdProducts.map(p => p.name)).toEqual([
        'ถุงมือยางใหม่',
        'สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15)'
      ]);

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <PRCreateView
              products={duplicateProducts}
              inventory={mockInventory}
              departments={[{ code: 'PD', name: 'ฝ่ายผลิต (PD)' }]}
              currentRole={{ id: 'REQUESTER_PD', department: 'PD', canCreatePR: true }}
            />
          </AppProvider>
        </MemoryRouter>
      );

      // Verify selected initial product name is rendered
      expect(html).toContain('ถุงมือยางใหม่');

      // The duplicate names and inactive/blacklisted items must NOT be present
      expect(html).not.toContain('ถุงมือยางใหม่ (รายการซ้ำ)');
      expect(html).not.toContain('สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15) - ซ้ำ');
      expect(html).not.toContain('สินค้าเก่าเลิกใช้');
      expect(html).not.toContain('Item 1 Mock Artifact');
    });
  });

  describe('3. ProductSelectDropdown Component', () => {
    it('renders deduplicated options correctly with unique collision-safe keys', () => {
      const html = renderToStaticMarkup(
        <ProductSelectDropdown
          products={duplicateProducts}
          inventory={mockInventory}
          department="PD"
          value="PROD-001"
          onChange={vi.fn()}
          defaultOpen={true}
        />
      );

      expect(html).toContain('itm-001');
      expect(html).toContain('PD-BLT-380');
      expect(html).toContain('ถุงมือยางใหม่');
      expect(html).not.toContain('ถุงมือยางใหม่ (รายการซ้ำ)');
      expect(html).not.toContain('สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15) - ซ้ำ');
    });
  });
});
