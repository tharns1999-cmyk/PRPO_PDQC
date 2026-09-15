import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import './setup.js';

import { AuthProvider, CANONICAL_ROLES, AUTH_STORAGE_KEY } from '../src/context/AuthContext';
import ProtectedRoute from '../src/components/common/ProtectedRoute';
import MasterDataView, { MASTER_DATA_TABS, normalizeTabId, deduplicateMasterData, isBlacklistedProduct, DUMMY_BLACKLIST } from '../src/views/MasterDataView';
import MasterDataNav from '../src/components/master/MasterDataNav';
import { storageService } from '../src/services/storageService.js';
import { apiService } from '../src/services/apiService.js';
import { MasterDataProvider, useMasterDataContext } from '../src/context/MasterDataContext.jsx';
import { ROLES } from '../src/config/constants';
import { workflowEngine } from '../src/services/workflowEngine';
import { safeStringCompare } from '../src/utils/formatters';

describe('Domain Suite: Master Data Management, Deduplication & Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageService.resetData();
    localStorage.clear();
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 1: Master Data Granular Tab-Level RBAC & Department Scoping
  // ══════════════════════════════════════════════════════════════════
  describe('1. Master Data Granular Tab-Level RBAC & Department Scoping', () => {
    const mockDepartments = [
      { id: 'd1', code: 'PD', name: 'ฝ่ายผลิต', isActive: true },
      { id: 'd2', code: 'QC', name: 'ฝ่ายควบคุมคุณภาพ', isActive: true },
      { id: 'd3', code: 'WH', name: 'คลังสินค้า', isActive: true },
      { id: 'd4', code: 'PUR', name: 'จัดซื้อ', isActive: true }
    ];

    const mockProducts = [
      { id: 'p1', code: 'MAT-PD-001', name: 'วัตถุดิบ PD', department: 'PD', category: 'PD', price: 100 },
      { id: 'p2', code: 'MAT-QC-001', name: 'สารเคมี QC', department: 'QC', category: 'QC', price: 200 }
    ];

    const mockVendors = [
      { id: 'v1', code: 'VEN-001', name: 'Vendor PD', department: 'PD' },
      { id: 'v2', code: 'VEN-002', name: 'Vendor QC', department: 'QC' },
      { id: 'v3', code: 'VEN-003', name: 'Vendor Both', department: 'BOTH' }
    ];

    const mockLocations = [
      { id: 'l1', name: 'คลัง PD ชั้น 1', department: 'PD' },
      { id: 'l2', name: 'ห้องแล็บ QC', department: 'QC' }
    ];

    const mockUsageUnits = [
      { id: 'u1', name: 'ไลน์การผลิต 1', department: 'PD', status: 'ACTIVE' },
      { id: 'u2', name: 'ห้องทดสอบ QC', department: 'QC', status: 'ACTIVE' }
    ];

    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
    });

    it('grants route-level access to Warehouse user without 403 Access Denied lockout', () => {
      const warehouseSession = {
        id: 'user_warehouse',
        username: 'kitti_wh',
        employeeId: 'EMP-WH-001',
        name: 'คุณกิตติ คลังพัสดุ',
        canonicalRole: CANONICAL_ROLES.WAREHOUSE,
        roleId: 'WAREHOUSE',
        department: 'WH',
        level: 2,
        expiresAt: Date.now() + 86400000
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(warehouseSession));

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/master-data']}>
          <AuthProvider>
            <Routes>
              <Route 
                path="/master-data" 
                element={
                  <ProtectedRoute allowedRoles={['REQUESTER', 'PURCHASER', 'WAREHOUSE', 'APPROVER', 'ADMIN']}>
                    <div data-testid="master-data-page">Master Data View Loaded</div>
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(html).not.toContain('403 Access Denied');
      expect(html).not.toContain('สิทธิ์การเข้าถึงถูกจำกัด');
      expect(html).toContain('Master Data View Loaded');

      // Type safety verification for safeStringCompare with numeric codes, nulls, and mixed types
      expect(safeStringCompare(1001, 1002)).toBeLessThan(0);
      expect(safeStringCompare(1002, 1001)).toBeGreaterThan(0);
      expect(safeStringCompare(1001, '1001')).toBe(0);
      expect(safeStringCompare(null, undefined)).toBe(0);
      expect(safeStringCompare(undefined, 'ABC')).toBeLessThan(0);
      const numericProds = [{ code: 102 }, { code: 20 }, { code: 101 }, { code: null }];
      expect(() => numericProds.sort((a, b) => safeStringCompare(a?.code, b?.code))).not.toThrow();
      expect(numericProds.map(p => p.code)).toEqual([null, 20, 101, 102]);
    });

    it('renders exactly 4 general tabs and completely hides Users and Departments tabs for Warehouse user', () => {
      const warehouseUser = {
        id: 'wh_user_01',
        name: 'คุณกิตติ คลังพัสดุ',
        canonicalRole: CANONICAL_ROLES.WAREHOUSE,
        roleId: 'WAREHOUSE',
        department: 'WH',
        level: 2
      };

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/master-data']}>
          <MasterDataView
            currentUser={warehouseUser}
            currentRole={warehouseUser}
            departments={mockDepartments}
            products={mockProducts}
            vendors={mockVendors}
            storageLocations={mockLocations}
            usageUnits={mockUsageUnits}
          />
        </MemoryRouter>
      );

      expect(html).toContain('แคตตาล็อกสินค้า');
      expect(html).toContain('รายชื่อผู้ขาย / ร้านค้า');
      expect(html).toContain('จุดจัดเก็บสินค้า');
      expect(html).toContain('หน่วยเบิกใช้งาน / ห้อง');

      expect(html).not.toContain('ผู้ใช้งานและสิทธิ์');
      expect(html).not.toContain('แผนก / ฝ่าย');
    });

    it('renders 4 general tabs for Requester (Wichai PD) and defaults filter to PD, omitting ทุกแผนก', () => {
      const requesterPD = {
        id: 'pd_user_01',
        name: 'คุณวิชัย ฝ่ายผลิต',
        canonicalRole: CANONICAL_ROLES.REQUESTER,
        roleId: 'REQUESTER',
        department: 'PD',
        departments: ['PD'],
        level: 1
      };

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/master-data']}>
          <MasterDataView
            currentUser={requesterPD}
            currentRole={requesterPD}
            departments={mockDepartments}
            products={mockProducts}
            vendors={mockVendors}
            storageLocations={mockLocations}
            usageUnits={mockUsageUnits}
          />
        </MemoryRouter>
      );

      expect(html).toContain('แคตตาล็อกสินค้า');
      expect(html).toContain('รายชื่อผู้ขาย / ร้านค้า');
      expect(html).toContain('จุดจัดเก็บสินค้า');
      expect(html).toContain('หน่วยเบิกใช้งาน / ห้อง');
      expect(html).not.toContain('ผู้ใช้งานและสิทธิ์');
      expect(html).not.toContain('แผนก / ฝ่าย');

      expect(html).toContain('ฝ่ายผลิต (PD)');
      expect(html).not.toContain('ทุกแผนก');

      expect(html).toContain('MAT-PD-001');
      expect(html).not.toContain('MAT-QC-001');
    });

    it('renders all 6 tabs and grants full cross-department visibility for Admin System', () => {
      const adminUser = {
        id: 'admin_01',
        name: 'Admin System',
        canonicalRole: CANONICAL_ROLES.ADMIN,
        roleId: 'ADMIN',
        role: 'admin',
        isAdmin: true,
        department: 'ALL',
        level: 99
      };

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/master-data']}>
          <MasterDataView
            currentUser={adminUser}
            currentRole={adminUser}
            departments={mockDepartments}
            products={mockProducts}
            vendors={mockVendors}
            storageLocations={mockLocations}
            usageUnits={mockUsageUnits}
          />
        </MemoryRouter>
      );

      expect(html).toContain('แคตตาล็อกสินค้า');
      expect(html).toContain('รายชื่อผู้ขาย / ร้านค้า');
      expect(html).toContain('จุดจัดเก็บสินค้า');
      expect(html).toContain('หน่วยเบิกใช้งาน / ห้อง');
      expect(html).toContain('ผู้ใช้งานและสิทธิ์');
      expect(html).toContain('แผนก / ฝ่าย');

      expect(html).toContain('ทุกแผนก');
    });

    it('automatically falls back to catalog tab when non-admin accesses ?tab=users', () => {
      const nonAdminUser = {
        id: 'user_pd',
        name: 'คุณวิชัย ฝ่ายผลิต',
        canonicalRole: CANONICAL_ROLES.REQUESTER,
        roleId: 'REQUESTER',
        department: 'PD',
        level: 1
      };

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/master-data?tab=users']}>
          <MasterDataView
            currentUser={nonAdminUser}
            currentRole={nonAdminUser}
            departments={mockDepartments}
            products={mockProducts}
            vendors={mockVendors}
            storageLocations={mockLocations}
            usageUnits={mockUsageUnits}
          />
        </MemoryRouter>
      );

      expect(html).not.toContain('ผู้ใช้งานและสิทธิ์');
      expect(html).toContain('แคตตาล็อกสินค้า');
    });

    it('automatically falls back to catalog tab when non-admin accesses ?tab=departments', () => {
      const nonAdminUser = {
        id: 'user_wh',
        name: 'คุณกิตติ คลังพัสดุ',
        canonicalRole: CANONICAL_ROLES.WAREHOUSE,
        roleId: 'WAREHOUSE',
        department: 'WH',
        level: 2
      };

      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/master-data?tab=departments']}>
          <MasterDataView
            currentUser={nonAdminUser}
            currentRole={nonAdminUser}
            departments={mockDepartments}
            products={mockProducts}
            vendors={mockVendors}
            storageLocations={mockLocations}
            usageUnits={mockUsageUnits}
          />
        </MemoryRouter>
      );

      expect(html).not.toContain('เพิ่มแผนกใหม่');
      expect(html).toContain('แคตตาล็อกสินค้า');
    });

    it('verifies MasterDataNav standalone tab filtering according to role', () => {
      const navNonAdmin = renderToStaticMarkup(
        <MasterDataNav
          activeTab="catalog"
          isAdmin={false}
          counts={{ catalog: 10, vendors: 5, locations: 2, rooms: 3, users: 15, departments: 4 }}
        />
      );

      expect(navNonAdmin).toContain('แคตตาล็อกสินค้า');
      expect(navNonAdmin).toContain('รายชื่อผู้ขาย / ร้านค้า');
      expect(navNonAdmin).toContain('จุดจัดเก็บสินค้า');
      expect(navNonAdmin).toContain('หน่วยเบิกใช้งาน / ห้อง');
      expect(navNonAdmin).not.toContain('ผู้ใช้งานและสิทธิ์');
      expect(navNonAdmin).not.toContain('แผนก / ฝ่าย');

      const navAdmin = renderToStaticMarkup(
        <MasterDataNav
          activeTab="catalog"
          isAdmin={true}
          counts={{ catalog: 10, vendors: 5, locations: 2, rooms: 3, users: 15, departments: 4 }}
        />
      );

      expect(navAdmin).toContain('ผู้ใช้งานและสิทธิ์');
      expect(navAdmin).toContain('แผนก / ฝ่าย');
    });

    it('normalizeTabId handles catalog/products and rooms/usageUnits seamlessly', () => {
      expect(normalizeTabId('products')).toBe('catalog');
      expect(normalizeTabId('catalog')).toBe('catalog');
      expect(normalizeTabId('usageUnits')).toBe('rooms');
      expect(normalizeTabId('rooms')).toBe('rooms');
      expect(normalizeTabId('vendors')).toBe('vendors');
      expect(normalizeTabId('locations')).toBe('locations');
      expect(normalizeTabId('users')).toBe('users');
      expect(normalizeTabId('departments')).toBe('departments');
      expect(normalizeTabId('invalid_unknown')).toBe('catalog');
    });

    it('MASTER_DATA_TABS constant reflects exact intended RBAC definitions', () => {
      const catalogTab = MASTER_DATA_TABS.find(t => t.id === 'catalog');
      const vendorsTab = MASTER_DATA_TABS.find(t => t.id === 'vendors');
      const locationsTab = MASTER_DATA_TABS.find(t => t.id === 'locations');
      const roomsTab = MASTER_DATA_TABS.find(t => t.id === 'rooms');
      const usersTab = MASTER_DATA_TABS.find(t => t.id === 'users');
      const deptTab = MASTER_DATA_TABS.find(t => t.id === 'departments');

      expect(catalogTab.adminOnly).toBe(false);
      expect(vendorsTab.adminOnly).toBe(false);
      expect(locationsTab.adminOnly).toBe(false);
      expect(roomsTab.adminOnly).toBe(false);
      expect(usersTab.adminOnly).toBe(true);
      expect(deptTab.adminOnly).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 2: Master Data Deduplication & React Key Collision Guard
  // ══════════════════════════════════════════════════════════════════
  describe('2. Master Data Deduplication & React Key Collision Guard', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      storageService.resetData();
    });

    it('deduplicates items by code and id (case-insensitive and trimmed)', () => {
      const dirtyList = [
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1' },
        { id: 'PROD-TEST-01', code: 't01', name: 'Test Item 1 duplicate' },
        { id: 'PROD-TEST-02', code: 'T02', name: 'Test Item 2' },
        { id: 'PROD-TEST-02', code: '  T02  ', name: 'Test Item 2 duplicate' },
        { id: 'PROD-TEST-03', code: 'T03', name: 'Test Item 3' }
      ];

      const cleanList = deduplicateMasterData(dirtyList);
      expect(cleanList.length).toBe(3);
      expect(cleanList.map(p => p.id)).toEqual(['PROD-TEST-01', 'PROD-TEST-02', 'PROD-TEST-03']);
    });

    it('handles nested wrappers and null/undefined values safely', () => {
      const nestedList = [
        { product: { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1' } },
        { item: { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1 nested dupe' } },
        null,
        undefined,
        { id: 'PROD-TEST-02', code: 'T02', name: 'Test Item 2' }
      ];

      const cleanList = deduplicateMasterData(nestedList);
      expect(cleanList.length).toBe(2);
      expect(cleanList[0].id).toBe('PROD-TEST-01');
      expect(cleanList[1].id).toBe('PROD-TEST-02');
    });

    it('strictly filters out blacklisted test artifacts (P01, P02, PROD-01, PROD-02, Item 1, Item 2)', () => {
      const dirtyWithArtifacts = [
        { id: 'PROD-01', code: 'P01', name: 'Item 1' },
        { id: 'PROD-02', code: 'P02', name: 'Item 2' },
        { id: 'PROD-VALID-01', code: 'V01', name: 'Valid Product' }
      ];

      const cleanList = deduplicateMasterData(dirtyWithArtifacts);
      expect(cleanList.length).toBe(1);
      expect(cleanList[0].id).toBe('PROD-VALID-01');
      expect(isBlacklistedProduct({ id: 'PROD-01', code: 'P01', name: 'Item 1' })).toBe(true);
      expect(isBlacklistedProduct({ id: 'PROD-02', code: 'P02', name: 'Item 2' })).toBe(true);
      expect(isBlacklistedProduct({ code: 'P01' })).toBe(true);
      expect(isBlacklistedProduct({ code: 'P02' })).toBe(true);
      expect(isBlacklistedProduct({ name: 'Item 1' })).toBe(true);
      expect(isBlacklistedProduct({ name: 'item 2' })).toBe(true);
      expect(isBlacklistedProduct({ id: 'PROD-PD-001', code: 'PD-OIL-068', name: 'Hydraulic Oil' })).toBe(false);
    });

    it('renders products without key collisions even if duplicates are supplied', () => {
      const duplicatedProducts = [
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1', category: 'PD', isActive: true, price: 100, stockBalance: 10 },
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1 Dupe', category: 'PD', isActive: true, price: 100, stockBalance: 10 },
        { id: 'PROD-TEST-02', code: 'T02', name: 'Test Item 2', category: 'PD', isActive: true, price: 200, stockBalance: 5 },
        { id: 'PROD-TEST-02', code: 'T02', name: 'Test Item 2 Dupe', category: 'PD', isActive: true, price: 200, stockBalance: 5 }
      ];

      const html = renderToStaticMarkup(
        <MasterDataView
          products={duplicatedProducts}
          currentRole={{ id: 'ADMIN', roleId: 'ADMIN' }}
        />
      );

      expect(html).toContain('Test Item 1');
      expect(html).toContain('Test Item 2');
    });

    it('cleans storage on mount and completely purges dummy artifacts PROD-01 and PROD-02', () => {
      const dirtyInStorage = [
        { id: 'PROD-01', code: 'P01', name: 'Item 1', category: 'PD', isActive: true },
        { id: 'PROD-02', code: 'P02', name: 'Item 2', category: 'PD', isActive: true },
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1', category: 'PD', isActive: true },
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1 Duplicate', category: 'PD', isActive: true }
      ];
      localStorage.setItem('prpo_products_data', JSON.stringify(dirtyInStorage));

      const storedBefore = JSON.parse(localStorage.getItem('prpo_products_data'));
      expect(storedBefore.length).toBe(4);

      const cleaned = deduplicateMasterData(storedBefore);
      expect(cleaned.length).toBe(1);
      expect(cleaned[0].id).toBe('PROD-TEST-01');
    });

    it('ensures MasterDataProvider provides deduplicated products without blacklisted items', () => {
      let contextProducts = [];
      function ConsumerComponent() {
        const ctx = useMasterDataContext();
        contextProducts = ctx.products;
        return <div>Count: {ctx.products.length}</div>;
      }

      storageService.saveProducts([
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1' },
        { id: 'PROD-TEST-01', code: 'T01', name: 'Test Item 1 Dupe' },
        { id: 'PROD-TEST-02', code: 'T02', name: 'Test Item 2' },
        { id: 'PROD-01', code: 'P01', name: 'Item 1' }
      ]);

      renderToStaticMarkup(
        <MasterDataProvider>
          <ConsumerComponent />
        </MasterDataProvider>
      );

      expect(contextProducts.length).toBe(2);
      expect(contextProducts.map(p => p.id)).toEqual(['PROD-TEST-01', 'PROD-TEST-02']);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 3: Product Delete Action & Permanent Blacklist Guard
  // ══════════════════════════════════════════════════════════════════
  describe('3. Product Delete Action & Permanent Blacklist Guard', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      storageService.resetData();
    });

    it('identifies P01, P02, PROD-01, PROD-02, Item 1, Item 2 as blacklisted', () => {
      expect(DUMMY_BLACKLIST.has('P01')).toBe(true);
      expect(DUMMY_BLACKLIST.has('P02')).toBe(true);
      expect(DUMMY_BLACKLIST.has('PROD-01')).toBe(true);
      expect(DUMMY_BLACKLIST.has('PROD-02')).toBe(true);

      expect(isBlacklistedProduct({ code: 'p01' })).toBe(true);
      expect(isBlacklistedProduct({ id: 'prod-01' })).toBe(true);
      expect(isBlacklistedProduct({ code: 'P02', name: 'Some item' })).toBe(true);
      expect(isBlacklistedProduct({ name: 'Item 1' })).toBe(true);
      expect(isBlacklistedProduct({ name: 'item 2' })).toBe(true);
      expect(isBlacklistedProduct({ name: '  Item 1  ' })).toBe(true);

      expect(isBlacklistedProduct({ id: 'PROD-PD-001', code: 'PD-OIL-068', name: 'Hydraulic Oil' })).toBe(false);
      expect(isBlacklistedProduct({ id: 'PROD-QC-001', code: 'QC-BUF-PH7', name: 'Buffer Solution' })).toBe(false);
    });

    it('prevents blacklisted items from being saved to storageService', () => {
      const list = [
        { id: 'PROD-CUSTOM-01', code: 'CUST-01', name: 'Custom Widget' },
        { id: 'PROD-01', code: 'P01', name: 'Item 1', stockBalance: 16 },
        { id: 'PROD-02', code: 'P02', name: 'Item 2', stockBalance: 5 }
      ];

      storageService.saveProducts(list);
      const saved = storageService.getProducts();

      expect(saved.some(p => p.code === 'P01' || p.id === 'PROD-01')).toBe(false);
      expect(saved.some(p => p.code === 'P02' || p.id === 'PROD-02')).toBe(false);
      expect(saved.some(p => p.code === 'CUST-01')).toBe(true);
    });

    it('deletes product by id or code and cleans up matching stock logs', () => {
      storageService.saveProducts([
        { id: 'PROD-DEL-01', code: 'SKU-DEL-01', name: 'To Be Deleted', stockBalance: 10 }
      ]);
      storageService.saveStockLogs([
        { id: 'LOG-1', productId: 'PROD-DEL-01', productCode: 'SKU-DEL-01', qty: 10, type: 'IN' },
        { id: 'LOG-2', productId: 'PROD-PD-001', productCode: 'PD-OIL-068', qty: 200, type: 'IN' }
      ]);

      expect(storageService.getProducts().some(p => p.id === 'PROD-DEL-01')).toBe(true);
      expect(storageService.getStockLogs().some(l => l.productId === 'PROD-DEL-01')).toBe(true);

      storageService.deleteProduct('SKU-DEL-01');

      expect(storageService.getProducts().some(p => p.id === 'PROD-DEL-01')).toBe(false);
      expect(storageService.getStockLogs().some(l => l.productId === 'PROD-DEL-01')).toBe(false);
      expect(storageService.getStockLogs().some(l => l.productId === 'PROD-PD-001')).toBe(true);
    });

    it('purges blacklisted stock logs automatically from getStockLogs', () => {
      storageService.saveStockLogs([
        { id: 'LOG-P01', productId: 'PROD-01', productCode: 'P01', qty: 16, type: 'IN' },
        { id: 'LOG-P02', productId: 'PROD-02', productCode: 'P02', qty: 5, type: 'IN' },
        { id: 'LOG-REAL', productId: 'PROD-PD-001', productCode: 'PD-OIL-068', qty: 2400, type: 'IN' }
      ]);

      const logs = storageService.getStockLogs();
      expect(logs.some(l => l.productCode === 'P01' || l.productId === 'PROD-01')).toBe(false);
      expect(logs.some(l => l.productCode === 'P02' || l.productId === 'PROD-02')).toBe(false);
      expect(logs.some(l => l.productId === 'PROD-PD-001')).toBe(true);
    });

    it('successfully calls apiService.deleteProduct without error', async () => {
      storageService.saveProducts([
        { id: 'PROD-TEST-DEL', code: 'SKU-TEST-DEL', name: 'API Delete Test' }
      ]);

      const result = await apiService.deleteProduct('SKU-TEST-DEL');
      expect(result).toBe(true);
      expect(storageService.getProducts().some(p => p.code === 'SKU-TEST-DEL')).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 4: New System Enhancements & Business Rules Verification
  // ══════════════════════════════════════════════════════════════════
  describe('4. New System Enhancements & Business Rules Verification (SKU Guard, VAT 7%, Goods Receiving & Short-Close)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
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

    it('records storage location and updates usable stock for good items', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-01',
        items: [{ productId: 'PROD-1', qty: 10, price: 10 }]
      }, ROLES.REQUESTER_PD);

      await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);
      const { po } = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);

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

      await apiService.receiveGoods(po.id, [{ productId: 'PROD-1', receivedThisTime: 5 }], ROLES.REQUESTER_PD);

      const closedPO = await apiService.shortClosePO(po.id, 'ร้านค้าแจ้งเลิกผลิตสินค้ารุ่นนี้แล้ว', ROLES.REQUESTER_PD);
      expect(closedPO.status).toBe('CLOSED');
      expect(closedPO.closedEarly).toBe(true);
      expect(closedPO.shortCloseReason).toBe('ร้านค้าแจ้งเลิกผลิตสินค้ารุ่นนี้แล้ว');
    });
  });
});
