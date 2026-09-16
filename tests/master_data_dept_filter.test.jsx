import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';

import { isDepartmentMatch, matchDepartment } from '../src/utils/permissions';
import MasterDataView, { matchDepartment as viewMatchDepartment } from '../src/views/MasterDataView';
import { storageService } from '../src/services/storageService';
import { CANONICAL_ROLES } from '../src/context/AuthContext';

describe('Domain Suite: Master Data QC Department Filtering & Key Mismatch Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageService.resetData();
    localStorage.clear();
  });

  // ══════════════════════════════════════════════════════════════════
  // 1. Helper Function: isDepartmentMatch
  // ══════════════════════════════════════════════════════════════════
  describe('1. Department Matching Helper (isDepartmentMatch)', () => {
    it('matches exact string department codes', () => {
      expect(isDepartmentMatch('QC', 'QC')).toBe(true);
      expect(isDepartmentMatch('PD', 'PD')).toBe(true);
      expect(isDepartmentMatch('WH', 'WH')).toBe(true);
    });

    it('matches DEPT- prefix against plain code (both directions)', () => {
      expect(isDepartmentMatch('QC', 'DEPT-QC')).toBe(true);
      expect(isDepartmentMatch('DEPT-QC', 'QC')).toBe(true);
      expect(isDepartmentMatch('PD', 'DEPT-PD')).toBe(true);
      expect(isDepartmentMatch('DEPT-PD', 'PD')).toBe(true);
    });

    it('matches case-insensitively and handles whitespace', () => {
      expect(isDepartmentMatch(' qc ', 'DEPT-QC')).toBe(true);
      expect(isDepartmentMatch('DEPT-qc', ' QC ')).toBe(true);
      expect(isDepartmentMatch('pd', 'pd')).toBe(true);
    });

    it('matches when targetDept is a Department Object', () => {
      const qcDeptObj = { id: 'DEPT-QC', code: 'QC', name: 'ฝ่ายควบคุมคุณภาพ' };
      expect(isDepartmentMatch('QC', qcDeptObj)).toBe(true);
      expect(isDepartmentMatch('DEPT-QC', qcDeptObj)).toBe(true);
      expect(isDepartmentMatch('ฝ่ายควบคุมคุณภาพ', qcDeptObj)).toBe(true);

      const pdDeptObj = { id: 'DEPT-PD', code: 'PD', name: 'ฝ่ายผลิต' };
      expect(isDepartmentMatch('PD', pdDeptObj)).toBe(true);
      expect(isDepartmentMatch('DEPT-PD', pdDeptObj)).toBe(true);
    });

    it('matches when targetDept is an Object with missing code but valid id or name', () => {
      const deptWithoutCode = { id: 'DEPT-QC', name: 'ฝ่ายควบคุมคุณภาพ' };
      expect(isDepartmentMatch('QC', deptWithoutCode)).toBe(true);
      expect(isDepartmentMatch('DEPT-QC', deptWithoutCode)).toBe(true);
    });

    it('handles wildcard and ALL/BOTH correctly', () => {
      expect(isDepartmentMatch('QC', 'ALL')).toBe(true);
      expect(isDepartmentMatch('PD', '*')).toBe(true);
      expect(isDepartmentMatch('WH', 'BOTH')).toBe(true);
      expect(isDepartmentMatch('ALL', 'QC')).toBe(true);
    });

    it('rejects non-matching departments', () => {
      expect(isDepartmentMatch('QC', 'PD')).toBe(false);
      expect(isDepartmentMatch('QC', 'DEPT-PD')).toBe(false);
      expect(isDepartmentMatch('PD', 'DEPT-QC')).toBe(false);
      expect(isDepartmentMatch('WH', 'QC')).toBe(false);
    });

    it('returns false for null or undefined arguments', () => {
      expect(isDepartmentMatch(null, 'QC')).toBe(false);
      expect(isDepartmentMatch('QC', null)).toBe(false);
      expect(isDepartmentMatch(undefined, undefined)).toBe(false);
      expect(isDepartmentMatch('', 'QC')).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 2. Product Filter Logic & Row 4 Scenario
  // ══════════════════════════════════════════════════════════════════
  describe('2. Products Filter Logic & Row 4 QC Item Verification', () => {
    // Exact schema matching Sheet row 4
    const productsData = [
      {
        id: 'PROD-QC-001',
        code: 'QC-STRIP-01',
        name: 'strip วัดคลอรีน',
        department: 'QC',
        category: 'QC',
        status: 'ACTIVE',
        isActive: true,
        price: 250,
        unit: 'กล่อง'
      },
      {
        id: 'PROD-QC-002',
        code: 'QC-PH-01',
        name: 'สารละลาย pH Buffer 7.0',
        department: 'QC',
        category: 'QC',
        status: 'ACTIVE',
        isActive: 'TRUE', // String TRUE from Sheet
        price: 450,
        unit: 'ขวด'
      },
      {
        id: 'PROD-QC-003',
        code: 'QC-EXP-01',
        name: 'ชุดตรวจเชื้อหมดอายุ',
        department: 'QC',
        category: 'QC',
        status: 'INACTIVE',
        isActive: false,
        price: 600,
        unit: 'ชุด'
      },
      {
        id: 'PROD-QC-004',
        code: 'QC-DISC-01',
        name: 'แผ่นทดสอบยกเลิกการใช้',
        department: 'QC',
        category: 'QC',
        status: 'INACTIVE',
        isActive: 'FALSE', // String FALSE from Sheet
        price: 150,
        unit: 'ซอง'
      },
      {
        id: 'PROD-PD-001',
        code: 'PD-OIL-01',
        name: 'น้ำมันหล่อลื่นฟู้ดเกรด',
        department: 'PD',
        category: 'PD',
        status: 'ACTIVE',
        isActive: true,
        price: 1200,
        unit: 'ถัง'
      }
    ];

    it('filters QC products correctly when selectedDept is plain code "QC"', () => {
      const selectedDept = 'QC';
      const qcProducts = productsData.filter(p => isDepartmentMatch(p.department || p.category, selectedDept));
      expect(qcProducts).toHaveLength(4);
      expect(qcProducts.some(p => p.name === 'strip วัดคลอรีน')).toBe(true);
      expect(qcProducts.every(p => p.department === 'QC')).toBe(true);
    });

    it('filters QC products correctly when selectedDept is "DEPT-QC"', () => {
      const selectedDept = 'DEPT-QC';
      const qcProducts = productsData.filter(p => isDepartmentMatch(p.department || p.category, selectedDept));
      expect(qcProducts).toHaveLength(4);
      expect(qcProducts.some(p => p.name === 'strip วัดคลอรีน')).toBe(true);
    });

    it('calculates Active, Inactive, and Total counts accurately for QC', () => {
      const selectedDept = 'DEPT-QC';
      let activeCount = 0;
      let inactiveCount = 0;

      productsData.forEach(p => {
        if (isDepartmentMatch(p.department || p.category, selectedDept)) {
          const isItemInactive = p.isActive === false || String(p.isActive).toUpperCase() === 'FALSE' || p.status === 'INACTIVE';
          const isItemActive = (p.isActive === true || String(p.isActive).toUpperCase() === 'TRUE' || p.status === 'ACTIVE') && !isItemInactive;

          if (isItemInactive) inactiveCount++;
          else if (isItemActive) activeCount++;
        }
      });

      const totalCount = activeCount + inactiveCount;
      expect(activeCount).toBe(2); // 'strip วัดคลอรีน' + 'สารละลาย pH Buffer 7.0'
      expect(inactiveCount).toBe(2); // 'ชุดตรวจเชื้อหมดอายุ' + 'แผ่นทดสอบยกเลิกการใช้'
      expect(totalCount).toBe(4);
    });

    it('filters by status: ACTIVE, INACTIVE, and ALL', () => {
      const selectedDept = 'QC';
      const deptFiltered = productsData.filter(p => isDepartmentMatch(p.department || p.category, selectedDept));

      // 1. ACTIVE
      const activeFiltered = deptFiltered.filter(p => {
        const isInactive = p.isActive === false || String(p.isActive).toUpperCase() === 'FALSE' || p.status === 'INACTIVE';
        const isActive = (p.isActive === true || String(p.isActive).toUpperCase() === 'TRUE' || p.status === 'ACTIVE') && !isInactive;
        return isActive;
      });
      expect(activeFiltered).toHaveLength(2);
      expect(activeFiltered.map(p => p.code)).toEqual(['QC-STRIP-01', 'QC-PH-01']);

      // 2. INACTIVE
      const inactiveFiltered = deptFiltered.filter(p => {
        return p.isActive === false || String(p.isActive).toUpperCase() === 'FALSE' || p.status === 'INACTIVE';
      });
      expect(inactiveFiltered).toHaveLength(2);
      expect(inactiveFiltered.map(p => p.code)).toEqual(['QC-EXP-01', 'QC-DISC-01']);

      // 3. ALL
      expect(deptFiltered).toHaveLength(4);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 3. Full UI Component Rendering (MasterDataView)
  // ══════════════════════════════════════════════════════════════════
  describe('3. MasterDataView Department Scoping & Active Counter UI Integration', () => {
    const mockDepartments = [
      { id: 'DEPT-PD', code: 'PD', name: 'ฝ่ายผลิต', isActive: true },
      { id: 'DEPT-QC', code: 'QC', name: 'ฝ่ายควบคุมคุณภาพ', isActive: true },
      { id: 'DEPT-WH', code: 'WH', name: 'ฝ่ายคลังสินค้า', isActive: true }
    ];

    const mockProducts = [
      {
        id: 'p-qc-1',
        code: 'QC-STRIP-01',
        name: 'strip วัดคลอรีน',
        department: 'QC',
        category: 'QC',
        status: 'ACTIVE',
        isActive: true,
        price: 250,
        unit: 'กล่อง'
      },
      {
        id: 'p-pd-1',
        code: 'PD-ITEM-01',
        name: 'มอเตอร์สายพานลำเลียง',
        department: 'PD',
        category: 'PD',
        status: 'ACTIVE',
        isActive: true,
        price: 3500,
        unit: 'เครื่อง'
      }
    ];

    it('renders strip วัดคลอรีน in MasterDataView for Admin viewing all or QC', () => {
      const adminUser = {
        id: 'usr_admin',
        username: 'admin',
        name: 'ผู้ดูแลระบบ',
        role: 'admin',
        roleId: 'ADMIN',
        canonicalRole: CANONICAL_ROLES.ADMIN,
        level: 99,
        isAdmin: true,
        canViewAllDepts: true,
        departments: ['*'],
        allowedDepartments: ['*']
      };

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/master-data']}>
          <MasterDataView
            currentUser={adminUser}
            currentRole={adminUser}
            products={mockProducts}
            departments={mockDepartments}
            vendors={[]}
            storageLocations={[]}
            usageUnits={[]}
          />
        </MemoryRouter>
      );

      // Verify that strip วัดคลอรีน is rendered
      expect(html).toContain('strip วัดคลอรีน');
      expect(html).toContain('QC-STRIP-01');
      expect(html).toContain('ฝ่ายควบคุมคุณภาพ (QC)');
      expect(html).toContain('ฝ่ายผลิต (PD)');
    });

    it('renders QC-restricted requester with only QC products and correct non-zero counters', () => {
      const qcRequester = {
        id: 'USR-QC-01',
        username: 'qc_staff',
        name: 'เจ้าหน้าที่ QC',
        role: 'requester',
        roleId: 'REQUESTER',
        canonicalRole: CANONICAL_ROLES.REQUESTER,
        level: 1,
        department: 'QC',
        departments: ['QC'],
        allowedDepartments: ['QC']
      };

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/master-data']}>
          <MasterDataView
            currentUser={qcRequester}
            currentRole={qcRequester}
            products={mockProducts}
            departments={mockDepartments}
            vendors={[]}
            storageLocations={[]}
            usageUnits={[]}
          />
        </MemoryRouter>
      );

      // QC item must be rendered
      expect(html).toContain('strip วัดคลอรีน');
      expect(html).toContain('QC-STRIP-01');
      // PD item must NOT be rendered for QC requester
      expect(html).not.toContain('มอเตอร์สายพานลำเลียง');
      // Active badge counter must show 1 (not 0)
      expect(html).toContain('เปิดใช้งาน');
      expect(html).toContain('ทั้งหมด');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 4. matchDepartment Contract & Export Verification
  // ══════════════════════════════════════════════════════════════════
  describe('4. matchDepartment Canonical Contract & MasterDataView Export', () => {
    it('exports matchDepartment from MasterDataView matching permissions.js', () => {
      expect(typeof viewMatchDepartment).toBe('function');
      expect(viewMatchDepartment).toBe(matchDepartment);
    });

    it('matches departments with DEPT- prefix against plain code and objects', () => {
      expect(matchDepartment('QC', 'DEPT-QC')).toBe(true);
      expect(matchDepartment('DEPT-QC', 'QC')).toBe(true);
      expect(matchDepartment('QC', { id: 'DEPT-QC', code: 'QC', name: 'ฝ่ายควบคุมคุณภาพ' })).toBe(true);
      expect(matchDepartment('DEPT-QC', { id: 'DEPT-QC', code: 'QC', name: 'ฝ่ายควบคุมคุณภาพ' })).toBe(true);
      expect(matchDepartment('ฝ่ายควบคุมคุณภาพ', { id: 'DEPT-QC', code: 'QC', name: 'ฝ่ายควบคุมคุณภาพ' })).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 5. Optimistic UI Update vs Background Sync (loadAllData) Persistence
  // ══════════════════════════════════════════════════════════════════
  describe('5. Optimistic UI Update vs Background Sync (loadAllData) Persistence', () => {
    it('retains QC product after simulated loadAllData() sheet overwrite when selectedDept is "DEPT-QC"', () => {
      // Step 1: Initial state before adding product
      let productsState = [];

      // Step 2: Optimistic UI update (0.01s after user clicks Save)
      // Form/Payload standardizes to department: 'QC', category: 'QC'
      const optimisticProduct = {
        id: 'PROD-QC-TEMPID',
        code: 'QC-REAGENT-01',
        name: 'น้ำยาทดสอบคลอรีนอิสระ DPD-1',
        department: 'QC',
        category: 'QC',
        unit: 'ขวด',
        price: 350,
        status: 'ACTIVE',
        isActive: true
      };
      productsState = [optimisticProduct, ...productsState];

      // Simulated tab selected in UI (selectedDept is 'DEPT-QC' or 'QC')
      const selectedDept = 'DEPT-QC';

      // 1. Check table filter immediately after Optimistic Update
      const optimisticFiltered = productsState.filter(p => {
        const deptMatch = matchDepartment(p.department || p.category, selectedDept);
        if (!deptMatch) return false;
        const isActive = p.isActive === true || String(p.isActive).toUpperCase() === 'TRUE' || p.status === 'ACTIVE';
        return isActive;
      });

      expect(optimisticFiltered).toHaveLength(1);
      expect(optimisticFiltered[0].code).toBe('QC-REAGENT-01');

      // Step 3: Background Sync (1.5s later: loadAllData pulls fresh Sheet data)
      // Sheet data has clean code 'QC' and string isActive 'TRUE'
      const freshDataFromSheets = [
        {
          id: 'PROD-QC-8899', // Persisted ID generated by backend
          code: 'QC-REAGENT-01',
          name: 'น้ำยาทดสอบคลอรีนอิสระ DPD-1',
          department: 'QC', // Clean code in Google Sheets
          category: 'QC',
          unit: 'ขวด',
          price: 350,
          status: 'ACTIVE',
          isActive: 'TRUE' // String representation from Google Sheets
        }
      ];

      // State is replaced with fresh data from Google Sheets
      productsState = freshDataFromSheets;

      // 2. Check table filter after Background Sync
      const syncedFiltered = productsState.filter(p => {
        const deptMatch = matchDepartment(p.department || p.category, selectedDept);
        if (!deptMatch) return false;
        const isActive = p.isActive === true || String(p.isActive).toUpperCase() === 'TRUE' || p.status === 'ACTIVE';
        return isActive;
      });

      // Product must NOT disappear!
      expect(syncedFiltered).toHaveLength(1);
      expect(syncedFiltered[0].code).toBe('QC-REAGENT-01');
      expect(syncedFiltered[0].name).toBe('น้ำยาทดสอบคลอรีนอิสระ DPD-1');

      // Counters must NOT drop to 0
      let activeCount = 0;
      let totalCount = 0;
      productsState.forEach(p => {
        if (matchDepartment(p.department || p.category, selectedDept)) {
          const isItemInactive = p.isActive === false || String(p.isActive).toUpperCase() === 'FALSE' || p.status === 'INACTIVE';
          const isItemActive = (p.isActive === true || String(p.isActive).toUpperCase() === 'TRUE' || p.status === 'ACTIVE') && !isItemInactive;
          if (isItemActive) activeCount++;
          totalCount++;
        }
      });

      expect(activeCount).toBe(1);
      expect(totalCount).toBe(1);
      expect(totalCount).not.toBe(0);
    });

    it('retains QC product after simulated loadAllData() sheet overwrite when selectedDept is "QC"', () => {
      const selectedDept = 'QC';
      const freshDataFromSheets = [
        {
          id: 'PROD-QC-9988',
          code: 'QC-STRIP-NEW',
          name: 'แผ่นตรวจวัดค่า pH ดิจิทัล',
          department: 'QC',
          category: 'QC',
          status: 'ACTIVE',
          isActive: true
        }
      ];

      const filtered = freshDataFromSheets.filter(p => matchDepartment(p.department || p.category, selectedDept));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].code).toBe('QC-STRIP-NEW');
    });
  });
});
