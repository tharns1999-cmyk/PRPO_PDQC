import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import './setup.js';

import { 
  AuthProvider, 
  CANONICAL_ROLES, 
  AUTH_STORAGE_KEY 
} from '../src/context/AuthContext';
import ProtectedRoute from '../src/components/common/ProtectedRoute';
import MasterDataView, { MASTER_DATA_TABS, normalizeTabId } from '../src/views/MasterDataView';
import MasterDataNav from '../src/components/master/MasterDataNav';

describe('Master Data Granular Tab-Level RBAC & Department Scoping Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

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

  describe('Scenario 1: Warehouse User Access (image_0b198c.png Fix)', () => {
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

      // Must NOT render 403 lockout card
      expect(html).not.toContain('403 Access Denied');
      expect(html).not.toContain('สิทธิ์การเข้าถึงถูกจำกัด');
      expect(html).toContain('Master Data View Loaded');
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

      // The 4 Public Tabs must be present
      expect(html).toContain('แคตตาล็อกสินค้า');
      expect(html).toContain('รายชื่อผู้ขาย / ร้านค้า');
      expect(html).toContain('จุดจัดเก็บสินค้า');
      expect(html).toContain('หน่วยเบิกใช้งาน / ห้อง');

      // Admin-only tabs must NOT exist in DOM
      expect(html).not.toContain('ผู้ใช้งานและสิทธิ์');
      expect(html).not.toContain('แผนก / ฝ่าย');
    });
  });

  describe('Scenario 2: Requester Access & Department Scoping (PD vs QC)', () => {
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

      // 4 public tabs present, admin tabs omitted
      expect(html).toContain('แคตตาล็อกสินค้า');
      expect(html).toContain('รายชื่อผู้ขาย / ร้านค้า');
      expect(html).toContain('จุดจัดเก็บสินค้า');
      expect(html).toContain('หน่วยเบิกใช้งาน / ห้อง');
      expect(html).not.toContain('ผู้ใช้งานและสิทธิ์');
      expect(html).not.toContain('แผนก / ฝ่าย');

      // Department filter pill must display and default to PD
      expect(html).toContain('ฝ่ายผลิต (PD)');
      // For department-restricted requesters, 'ทุกแผนก' pill must be omitted
      expect(html).not.toContain('ทุกแผนก');

      // In catalog table: PD products are rendered, QC products are excluded
      expect(html).toContain('MAT-PD-001');
      expect(html).not.toContain('MAT-QC-001');
    });
  });

  describe('Scenario 3: Admin Full Access (image_0b128a.png)', () => {
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

      // All 6 tabs must be visible
      expect(html).toContain('แคตตาล็อกสินค้า');
      expect(html).toContain('รายชื่อผู้ขาย / ร้านค้า');
      expect(html).toContain('จุดจัดเก็บสินค้า');
      expect(html).toContain('หน่วยเบิกใช้งาน / ห้อง');
      expect(html).toContain('ผู้ใช้งานและสิทธิ์');
      expect(html).toContain('แผนก / ฝ่าย');

      // Admin has 'ทุกแผนก' pill
      expect(html).toContain('ทุกแผนก');
    });
  });

  describe('Scenario 4: Direct Tab Tampering Guard', () => {
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

      // Must NOT render users management tab content
      expect(html).not.toContain('ผู้ใช้งานและสิทธิ์');
      // Must fall back to catalog view
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

      // Must NOT render department configuration view
      expect(html).not.toContain('เพิ่มแผนกใหม่');
      // Must fall back to catalog view
      expect(html).toContain('แคตตาล็อกสินค้า');
    });
  });

  describe('Item Action Permissions & MasterDataNav Extraction', () => {
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
});
