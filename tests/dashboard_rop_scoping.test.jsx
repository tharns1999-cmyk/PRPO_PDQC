import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';

import DashboardView from '../src/views/DashboardView';
import KPICards from '../src/components/dashboard/KPICards';
import { matchDepartment } from '../src/utils/permissions';

describe('Domain Suite: Dashboard Low-Stock (ROP) Scoping & Multi-Dept Filtering', () => {
  let mockProducts;
  let mockBudgetSummary;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProducts = [
      // 1. PD Low Stock (Stock 3 <= ROP 10)
      {
        id: 'PROD-PD-001',
        sku: 'PD-OIL-01',
        code: 'PD-OIL-01',
        name: 'น้ำมันหล่อลื่นเครื่องจักร',
        department: 'PD',
        category: 'PD',
        stockBalance: 3,
        currentStock: 3,
        reorderPoint: 10,
        rop: 10,
        unit: 'แกลลอน',
        price: 450,
        isActive: true,
        status: 'ACTIVE'
      },
      // 2. PD Normal Stock (Stock 50 > ROP 10) -> Should NOT appear in ROP
      {
        id: 'PROD-PD-002',
        sku: 'PD-GLOVE-01',
        code: 'PD-GLOVE-01',
        name: 'ถุงมือกันร้อนงานเตาอบ',
        department: 'PD',
        category: 'PD',
        stockBalance: 50,
        currentStock: 50,
        reorderPoint: 10,
        rop: 10,
        unit: 'คู่',
        price: 150,
        isActive: true,
        status: 'ACTIVE'
      },
      // 3. QC Low Stock 1 (Stock 4 <= ROP 20) -> User problem statement item: "strip วัดคลอรีน"
      {
        id: 'PROD-QC-001',
        sku: 'QC-STRIP-01',
        code: 'QC-STRIP-01',
        name: 'strip วัดคลอรีน',
        department: 'QC',
        category: 'QC',
        stockBalance: 4,
        currentStock: 4,
        reorderPoint: 20,
        rop: 20,
        unit: 'กล่อง',
        price: 320,
        isActive: true,
        status: 'ACTIVE'
      },
      // 4. QC Low Stock 2 (Stock 1 <= ROP 5)
      {
        id: 'PROD-QC-002',
        sku: 'QC-REAGENT-01',
        code: 'QC-REAGENT-01',
        name: 'สารละลายสอบเทียบ pH',
        department: 'QC',
        category: 'QC',
        stockBalance: 1,
        currentStock: 1,
        reorderPoint: 5,
        rop: 5,
        unit: 'ขวด',
        price: 850,
        isActive: true,
        status: 'ACTIVE'
      },
      // 5. Inactive Product (Stock 0 <= ROP 10) -> Must NOT appear
      {
        id: 'PROD-PD-INACTIVE',
        sku: 'PD-OLD-01',
        code: 'PD-OLD-01',
        name: 'อะไหล่สายพานเลิกใช้งาน',
        department: 'PD',
        category: 'PD',
        stockBalance: 0,
        currentStock: 0,
        reorderPoint: 10,
        rop: 10,
        unit: 'เส้น',
        price: 300,
        isActive: false,
        status: 'INACTIVE'
      }
    ];

    mockBudgetSummary = {
      PD: { allocated: 500000, actualSpent: 120000, committed: 30000 },
      QC: { allocated: 200000, actualSpent: 45000, committed: 15000 }
    };
  });

  const renderDashboard = (props) => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <DashboardView
          products={mockProducts}
          budgetSummary={mockBudgetSummary}
          prs={[]}
          pos={[]}
          {...props}
        />
      </MemoryRouter>
    );
  };

  // Helper to count low-stock table rows rendered (via "+ เปิดใบขอซื้อ" buttons)
  const countTableRows = (html) => {
    const matches = html.match(/\+ เปิดใบขอซื้อ/g);
    return matches ? matches.length : 0;
  };

  // ══════════════════════════════════════════════════════════════════
  // Test 1: Single Department User (PD Operator: สิรภัทร แจ่มมิน)
  // ══════════════════════════════════════════════════════════════════
  describe('1. Single Department User (PD Requester - สิรภัทร แจ่มมิน)', () => {
    const pdUser = {
      id: 'USER-PD-001',
      name: 'สิรภัทร แจ่มมิน',
      role: 'REQUESTER',
      roleId: 'REQUESTER_PD',
      department: 'PD',
      departments: ['PD']
    };

    it('displays only PD low-stock items and completely hides QC items like "strip วัดคลอรีน"', () => {
      const html = renderDashboard({ currentUser: pdUser });

      // PD low stock item must be visible
      expect(html).toContain('น้ำมันหล่อลื่นเครื่องจักร');
      expect(html).toContain('PD-OIL-01');

      // QC low stock items must NOT leak to PD user
      expect(html).not.toContain('strip วัดคลอรีน');
      expect(html).not.toContain('QC-STRIP-01');
      expect(html).not.toContain('สารละลายสอบเทียบ pH');
      expect(html).not.toContain('QC-REAGENT-01');

      // Normal stock and inactive items must not be listed
      expect(html).not.toContain('ถุงมือกันร้อนงานเตาอบ');
      expect(html).not.toContain('อะไหล่สายพานเลิกใช้งาน');

      // Row count must strictly be 1
      expect(countTableRows(html)).toBe(1);

      // KPI card must show 1 item
      expect(html).toContain('1 <span class="text-xs font-medium text-slate-400 font-sans">รายการ</span>');

      // Header shows single department badge without multi-dept switcher tabs
      expect(html).toContain('ฝ่ายผลิต (PD)');
      expect(html).not.toContain('ฝ่ายควบคุมคุณภาพ (QC)');
    });

    it('works equivalently when currentRole is supplied instead of currentUser', () => {
      const pdRole = {
        roleId: 'REQUESTER_PD',
        role: 'REQUESTER',
        department: 'PD',
        departments: ['PD']
      };

      const html = renderDashboard({ currentRole: pdRole });

      expect(html).toContain('น้ำมันหล่อลื่นเครื่องจักร');
      expect(html).not.toContain('strip วัดคลอรีน');
      expect(countTableRows(html)).toBe(1);
    });

    it('scopes QC single department user strictly to QC items', () => {
      const qcUser = {
        id: 'USER-QC-001',
        name: 'เจ้าหน้าที่ QC',
        role: 'REQUESTER',
        roleId: 'REQUESTER_QC',
        department: 'QC',
        departments: ['QC']
      };

      const html = renderDashboard({ currentUser: qcUser });

      // QC items must be visible
      expect(html).toContain('strip วัดคลอรีน');
      expect(html).toContain('QC-STRIP-01');
      expect(html).toContain('สารละลายสอบเทียบ pH');
      expect(html).toContain('QC-REAGENT-01');

      // PD items must NOT be visible
      expect(html).not.toContain('น้ำมันหล่อลื่นเครื่องจักร');
      expect(html).not.toContain('PD-OIL-01');

      // Row count must strictly be 2 (strip วัดคลอรีน + สารละลายสอบเทียบ pH)
      expect(countTableRows(html)).toBe(2);
      expect(html).toContain('2 <span class="text-xs font-medium text-slate-400 font-sans">รายการ</span>');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Test 2: Multi-Department User (Asst. Manager: PD & QC)
  // ══════════════════════════════════════════════════════════════════
  describe('2. Multi-Department User (Asst. Manager / Manager / Admin)', () => {
    const asstManagerUser = {
      id: 'USER-ASST-MGR',
      name: 'ผู้ช่วยผู้จัดการฝ่ายผลิตและคุณภาพ',
      role: 'ASST_MANAGER',
      roleId: 'ASST_MANAGER',
      departments: ['PD', 'QC'],
      department: 'PD'
    };

    it('renders multi-dept filter tabs and shows all accessible ROP items by default', () => {
      const html = renderDashboard({ currentUser: asstManagerUser });

      // Multi-dept tabs must be present
      expect(html).toContain('ทั้งหมด');
      expect(html).toContain('ฝ่ายผลิต (PD)');
      expect(html).toContain('ฝ่ายควบคุมคุณภาพ (QC)');

      // In default 'ALL' view, items from BOTH PD and QC are visible
      expect(html).toContain('น้ำมันหล่อลื่นเครื่องจักร');
      expect(html).toContain('strip วัดคลอรีน');
      expect(html).toContain('สารละลายสอบเทียบ pH');

      // Both department badges must appear in the table rows
      expect(html).toContain('ฝ่ายผลิต (PD)');
      expect(html).toContain('ฝ่ายควบคุมคุณภาพ (QC)');

      // Total ROP items = 1 (PD) + 2 (QC) = 3
      expect(countTableRows(html)).toBe(3);
      expect(html).toContain('3 <span class="text-xs font-medium text-slate-400 font-sans">รายการ</span>');
      expect(html).toContain('⚡ ขอซื้อทั้งหมด (3)');
    });

    it('switches to PD tab and shows only PD ROP items', () => {
      const html = renderDashboard({
        currentUser: asstManagerUser,
        deptFilter: 'PD'
      });

      expect(html).toContain('น้ำมันหล่อลื่นเครื่องจักร');
      expect(html).toContain('PD-OIL-01');

      // QC items hidden
      expect(html).not.toContain('strip วัดคลอรีน');
      expect(html).not.toContain('สารละลายสอบเทียบ pH');

      expect(countTableRows(html)).toBe(1);
      expect(html).toContain('1 <span class="text-xs font-medium text-slate-400 font-sans">รายการ</span>');
      expect(html).toContain('⚡ ขอซื้อทั้งหมด (1)');
    });

    it('switches to QC tab and shows only QC ROP items', () => {
      const html = renderDashboard({
        currentUser: asstManagerUser,
        deptFilter: 'QC'
      });

      // QC items visible
      expect(html).toContain('strip วัดคลอรีน');
      expect(html).toContain('สารละลายสอบเทียบ pH');

      // PD item hidden
      expect(html).not.toContain('น้ำมันหล่อลื่นเครื่องจักร');

      expect(countTableRows(html)).toBe(2);
      expect(html).toContain('2 <span class="text-xs font-medium text-slate-400 font-sans">รายการ</span>');
      expect(html).toContain('⚡ ขอซื้อทั้งหมด (2)');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Test 3: KPI Card Count strictly matches Table Row Count
  // ══════════════════════════════════════════════════════════════════
  describe('3. KPI Card and Low Stock Table Count Integrity', () => {
    const adminUser = {
      id: 'USER-ADMIN',
      name: 'ผู้ดูแลระบบ',
      role: 'ADMIN',
      roleId: 'ADMIN',
      departments: ['PD', 'QC', 'WH']
    };

    it('ensures KPI low-stock count strictly equals rendered table rows across all filter options', () => {
      const testCases = [
        { filter: 'ALL', expectedCount: 3 },
        { filter: 'PD', expectedCount: 1 },
        { filter: 'QC', expectedCount: 2 }
      ];

      testCases.forEach(({ filter, expectedCount }) => {
        const html = renderDashboard({
          currentUser: adminUser,
          deptFilter: filter
        });

        // 1. Check table rows count
        const rowCount = countTableRows(html);
        expect(rowCount).toBe(expectedCount);

        // 2. Check KPI card displayed count
        const expectedKpiSnippet = `${expectedCount} <span class="text-xs font-medium text-slate-400 font-sans">รายการ</span>`;
        expect(html).toContain(expectedKpiSnippet);
      });
    });

    it('displays friendly empty state when a department has zero low-stock items', () => {
      // If we remove the single PD low stock item
      const productsWithoutPdLowStock = mockProducts.filter(p => p.department !== 'PD' || p.stockBalance > p.reorderPoint);

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <DashboardView
            products={productsWithoutPdLowStock}
            budgetSummary={mockBudgetSummary}
            currentUser={{ role: 'REQUESTER', department: 'PD', departments: ['PD'] }}
          />
        </MemoryRouter>
      );

      expect(countTableRows(html)).toBe(0);
      expect(html).toContain('0 <span class="text-xs font-medium text-slate-400 font-sans">รายการ</span>');
      expect(html).toContain('ระดับสต็อกสินค้าฝ่ายผลิต (PD) ทุกรายการอยู่ในเกณฑ์ปกติ');
      expect(html).toContain('ไม่มีสินค้าที่ต้องสั่งซื้อซ้ำในขณะนี้');
    });

    it('scopes Monthly Budget KPI card to the selected department', () => {
      // PD budget: spent = 120000 + 30000 = 150000, allocated = 500000
      const pdHtml = renderToStaticMarkup(
        <MemoryRouter>
          <KPICards
            budgetSummary={mockBudgetSummary}
            currentRole={{ roleId: 'ADMIN', department: 'ALL' }}
            activeDept="PD"
            lowStockCount={1}
          />
        </MemoryRouter>
      );
      expect(pdHtml).toContain('งบประจำเดือน (ฝ่ายผลิต (PD))');
      expect(pdHtml).toContain('฿150,000');
      expect(pdHtml).toContain('จาก ฿500,000');

      // QC budget: spent = 45000 + 15000 = 60000, allocated = 200000
      const qcHtml = renderToStaticMarkup(
        <MemoryRouter>
          <KPICards
            budgetSummary={mockBudgetSummary}
            currentRole={{ roleId: 'ADMIN', department: 'ALL' }}
            activeDept="QC"
            lowStockCount={2}
          />
        </MemoryRouter>
      );
      expect(qcHtml).toContain('งบประจำเดือน (ฝ่ายควบคุมคุณภาพ (QC))');
      expect(qcHtml).toContain('฿60,000');
      expect(qcHtml).toContain('จาก ฿200,000');
    });
  });
});
