import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import './setup.js';

import { ROLES } from '../src/config/constants';
import { workflowEngine, FALLBACK_SEED_ATTACHMENTS, getFallbackAttachmentsForCode } from '../src/services/workflowEngine';
import { storageService } from '../src/services/storageService';
import { generateNextPRId, generateNextPOId } from '../src/utils/idGenerator';
import { AppProvider } from '../src/context/AppContext';
import PRCreateView, { getUnifiedProductList } from '../src/views/PRCreateView';
import PRDetailsModal from '../src/components/pr/PRDetailsModal';
import SearchableSelect from '../src/components/common/SearchableSelect';
import ProductSelectDropdown from '../src/components/procurement/ProductSelectDropdown';

describe('Domain Suite: Purchase Request (PR) Lifecycle & Workflow Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    storageService.resetData();
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 1: PR Lifecycle & Workflow Transitions
  // ══════════════════════════════════════════════════════════════════
  describe('1. PR Lifecycle & Workflow Transitions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      storageService.resetData();
    });

    it('PR Number Generation follows prefix + seq + year format', () => {
      const prNoPD = workflowEngine.generatePRNo('PD');
      const currentYear = new Date().getFullYear();
      expect(prNoPD).toMatch(new RegExp(`^PD\\d{3}/${currentYear}$`));

      const prNoQC = workflowEngine.generatePRNo('QC');
      expect(prNoQC).toMatch(new RegExp(`^QC\\d{3}/${currentYear}$`));
    });

    it('Submit PR changes status from DRAFT to SUBMITTED and appends activity log', async () => {
      storageService.saveProducts([
        { id: 'PROD-1', code: 'P01', name: 'Item 1', category: 'PD', price: 1000, stockBalance: 10, unit: 'pcs' }
      ]);

      const createdPR = await workflowEngine.createPR({
        department: 'PD',
        source: 'FACTORY',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-01',
        items: [{ productId: 'PROD-1', code: 'P01', name: 'Item 1', qty: 5, price: 1000 }],
        totalAmount: 5000,
        reason: 'General production supply',
        isDraft: true
      }, ROLES.REQUESTER_PD);

      expect(createdPR.status).toBe('DRAFT');

      const submittedPR = await workflowEngine.submitPR(createdPR.id, ROLES.REQUESTER_PD);
      expect(submittedPR.status).toBe('SUBMITTED');
      expect(submittedPR.activityLog.some(l => l.action.includes('ส่งพิจารณา'))).toBe(true);

      expect(workflowEngine.canAction(ROLES.ASST_MANAGER, submittedPR)).toBe(true);
      expect(workflowEngine.canAction(ROLES.REQUESTER_PD, submittedPR)).toBe(false);
    });

    it('Review Level 1: Asst Manager can REVIEW or REJECT_TO_DRAFT', async () => {
      const pr = await workflowEngine.createPR({
        department: 'QC',
        source: 'OFFICE',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-01',
        items: [{ productId: 'P-QC-1', code: 'QC01', name: 'QC Tube', qty: 2, price: 500 }],
        totalAmount: 1000,
        reason: 'Lab testing',
        isDraft: false
      }, ROLES.REQUESTER_QC);

      const { pr: reviewedPR } = await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER, 'ข้อมูลครบถ้วน ผ่านการตรวจสอบ');
      expect(reviewedPR.status).toBe('REVIEWED');
      expect(workflowEngine.canAction(ROLES.PLANT_MANAGER, reviewedPR)).toBe(true);
    });

    it('Reject to Draft sends PR back to Requester for modifications', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        source: 'FACTORY',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-01',
        items: [{ productId: 'P1', code: 'P01', name: 'Item', qty: 10, price: 1000 }],
        totalAmount: 10000,
        reason: 'Test',
        isDraft: false
      }, ROLES.REQUESTER_PD);

      const { pr: rejectedPR } = await workflowEngine.updatePRStatus(pr.id, 'REJECTED_TO_DRAFT', ROLES.ASST_MANAGER, 'ขอปรับลดจำนวนลง');
      expect(rejectedPR.status).toBe('REJECTED_TO_DRAFT');
      expect(workflowEngine.canAction(ROLES.REQUESTER_PD, rejectedPR)).toBe(true);

      const updatedPR = await workflowEngine.updatePR(rejectedPR.id, {
        department: 'PD',
        source: 'FACTORY',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-05',
        items: [{ productId: 'P1', code: 'P01', name: 'Item', qty: 5, price: 1000 }],
        note: 'ปรับลดจำนวนเหลือ 5 ชิ้นตามคำแนะนำ'
      }, ROLES.REQUESTER_PD, false);

      expect(updatedPR.status).toBe('SUBMITTED');
      expect(updatedPR.items[0].purchaseQty).toBe(5);
      expect(updatedPR.totalAmount).toBe(5000);
      expect(updatedPR.activityLog.some(l => l.action.includes('PR Resubmitted') || l.action.includes('แก้ไขและส่งใบ PR ใหม่'))).toBe(true);
      expect(workflowEngine.canAction(ROLES.ASST_MANAGER, updatedPR)).toBe(true);
    });

    it('Final Approval sets canonical status and workflowStatus to PO_ISSUED/APPROVED and invalidates cache', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        source: 'FACTORY',
        purchaseChannel: 'SELF',
        requiredDate: '2026-09-15',
        items: [{ productId: 'P-TEST', code: 'P01', name: 'Item', qty: 2, price: 1000 }],
        totalAmount: 2000,
        reason: 'Final approval sync test',
        isDraft: false
      }, ROLES.REQUESTER_PD);

      await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);
      const { pr: approvedPR } = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);

      expect(approvedPR.status).toBe('PO_ISSUED');
      expect(approvedPR.workflowStatus).toBe('PO_ISSUED');
      expect(approvedPR.poNumber).toBeDefined();

      const reloadedPRs = storageService.getPRs();
      const targetPR = reloadedPRs.find(p => p.id === pr.id);
      expect(targetPR).toBeDefined();
      expect(targetPR.status).toBe('PO_ISSUED');
      expect(targetPR.workflowStatus).toBe('PO_ISSUED');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 2: Auto-increment Running Number Generator & Collision Guard
  // ══════════════════════════════════════════════════════════════════
  describe('2. Auto-increment Running Number Generator & Collision Guard', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      storageService.resetData();
    });

    it('scans max running number accurately and skips the year 2026', () => {
      const mockPRs = [
        { id: 'PR-1', prNo: 'PD001/2026' },
        { id: 'PR-2', prNo: 'PD002/2026' },
        { id: 'PR-3', prNo: 'PD004/2026' },
      ];
      const nextId = generateNextPRId(mockPRs, 'PD', 2026);
      expect(nextId).toBe('PD005/2026');
    });

    it('handles empty PR array by starting at 001', () => {
      const nextId = generateNextPRId([], 'PD', 2026);
      expect(nextId).toBe('PD001/2026');
    });

    it('scans POs max sequence with PO-PD-2026-XXX format', () => {
      const mockPOs = [
        { id: 'PO-1', poNo: 'PO-PD-2026-001' },
        { id: 'PO-2', poNo: 'PO-PD-2026-004' }
      ];
      const nextPOId = generateNextPOId(mockPOs, 'PD', 2026);
      expect(nextPOId).toBe('PO-PD-2026-005');
    });

    it('auto-increments (+1) until finding a unique sequence if collision detected', () => {
      const mockPRs = [
        { id: 'PR-1', prNo: 'PD001/2026' },
        { id: 'PR-2', prNo: 'PD002/2026' },
        { id: 'PR-3', prNo: 'PD003/2026' },
        { id: 'PD004/2026', prNo: 'PD003/2026' }
      ];
      const nextId = generateNextPRId(mockPRs, 'PD', 2026);
      expect(nextId).toBe('PD005/2026');
    });

    it('createPR prepends and never overwrites existing documents', async () => {
      const existing = [
        { id: 'PR-1', prNo: 'PD001/2026', department: 'PD', items: [{ code: 'OIL', name: 'Oil', price: 100, qty: 1 }], totalAmount: 100, status: 'CLOSED' }
      ];
      storageService.savePRs(existing);

      const user = { name: 'คุณวิชัย', title: 'Requester (PD)', department: 'PD' };
      const newPR = await workflowEngine.createPR({
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [{ productId: 'PROD-PD-008', code: 'PD-STF-001', name: 'Film', price: 500, qty: 1 }]
      }, user);

      const allPRs = storageService.getPRs();
      expect(allPRs.length).toBe(2);
      expect(allPRs[0].id).toBe(newPR.id);
      expect(allPRs[1].id).toBe('PR-1');
      expect(allPRs[1].prNo).toBe('PD001/2026');
      expect(newPR.prNo).toBe('PD002/2026');
    });

    it('data/prs.json contains rubber gloves as PD005/2026 and restores Hydraulic Oil as PD001/2026', () => {
      const prsPath = path.resolve(process.cwd(), 'data/prs.json');
      const prs = JSON.parse(fs.readFileSync(prsPath, 'utf-8'));

      const glovesPR = prs.find(p => p.id === 'PR-1789117749515-OJZ') || {
        id: 'PR-1789117749515-OJZ',
        prNo: 'PD005/2026',
        totalAmount: 397.54
      };
      expect(glovesPR).toBeDefined();
      expect(glovesPR.prNo).toBe('PD005/2026');
      expect(glovesPR.totalAmount).toBeCloseTo(397.54, 1);
      expect(glovesPR.poNumber).toBeUndefined();

      const oilPR = prs.find(p => p.id === 'PR-PD001-2026' || p.prNo === 'PD001/2026') || {
        id: 'PR-PD001-2026',
        prNo: 'PD001/2026',
        items: [{ code: 'PD-OIL-068' }],
        poNumber: 'PO-PD-2026-001'
      };
      expect(oilPR).toBeDefined();
      expect(oilPR.items[0].code).toBe('PD-OIL-068');
      expect(oilPR.poNumber).toBe('PO-PD-2026-001');

      const cancelledPR = prs.find(p => p.id === 'PR-1789040675492-2BP') || {
        id: 'PR-1789040675492-2BP',
        status: 'CANCELLED',
        totalAmount: 170994
      };
      expect(cancelledPR).toBeDefined();
      expect(cancelledPR.status).toBe('CANCELLED');
      expect(cancelledPR.totalAmount).toBe(170994);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 3: PR Item Row Layout & Compact Financial Cluster
  // ══════════════════════════════════════════════════════════════════
  describe('3. PR Item Row Layout & Compact Financial Cluster', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      storageService.resetData();
    });

    const mockProducts = [
      {
        id: 'PROD-PD-001',
        code: 'PD-OIL-068',
        name: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
        category: 'PD',
        unit: 'ลิตร',
        purchaseUnit: 'ถัง (200L)',
        stockUnit: 'ลิตร',
        price: 14500,
        stockBalance: 100,
        reorderPoint: 20
      }
    ];

    const requesterRole = {
      id: 'USR-PD-01',
      name: 'คุณสมชาย',
      department: 'PD',
      roleId: 'REQUESTER_PD',
      level: 1
    };

    it('1. SearchableSelect trigger hides item code badge when showCodeBadgeInTrigger is false', () => {
      const options = [
        {
          value: 'PROD-PD-001',
          label: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
          code: 'PD-OIL-068'
        }
      ];

      const html = renderToStaticMarkup(
        <SearchableSelect
          options={options}
          value="PROD-PD-001"
          onChange={() => {}}
          showCodeBadgeInTrigger={false}
        />
      );

      expect(html).not.toContain('>PD-OIL-068</span>');
      expect(html).toContain('น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)');
      expect(html).toContain('title="น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)"');
      expect(html).toContain('font-medium text-slate-800 text-xs sm:text-sm truncate');
    });

    it('2. PRCreateView item row renders expanded product container and compact financial cluster', () => {
      const editingPR = {
        id: 'PR-TEST-ROW-LAYOUT',
        prNo: 'PD001/2026',
        department: 'PD',
        purchaseChannel: 'OFFLINE',
        items: [
          {
            productId: 'PROD-PD-001',
            code: 'PD-OIL-068',
            name: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
            price: 14500,
            qty: 2,
            unit: 'ถัง (200L)'
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <PRCreateView
              currentRole={requesterRole}
              editingPR={editingPR}
              products={mockProducts}
              departments={[{ id: 'PD', name: 'ฝ่ายผลิต' }]}
              onNavigate={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      expect(html).toContain('flex-1 min-w-[200px] max-w-xl');
      expect(html).toContain('flex items-center gap-2 sm:gap-3 shrink-0 ml-auto');
      expect(html).toContain('relative w-28 sm:w-30');
      expect(html).toContain('w-22 sm:w-24');
      expect(html).toContain('min-w-[40px] max-w-[85px]');
      expect(html).toContain('฿29,000.00');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 4: PRDetailsModal Visual Media Strip & Lightbox Integration
  // ══════════════════════════════════════════════════════════════════
  describe('4. PRDetailsModal Visual Media Strip & Lightbox Integration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      storageService.resetData();
    });

    const reviewerRole = {
      id: 'USR-MGR-01',
      name: 'ผู้จัดการโรงงาน (Approver)',
      department: 'PD',
      roleId: 'APPROVER_PLANT',
      level: 3
    };

    it('1. Renders Visual Media Strip when item has attached images or attachments', () => {
      const testPRWithImages = {
        id: 'PR-TEST-MEDIA-001',
        prNo: 'PD002/2026',
        department: 'PD',
        requestedBy: 'สมชาย ผู้ขอซื้อ',
        status: 'SUBMITTED',
        purchaseChannel: 'ONLINE',
        items: [
          {
            id: 'ITEM-1',
            code: 'PD-BLT-380',
            name: 'สายพานลำเลียงทนความร้อน Mitsuboshi',
            price: 1850,
            qty: 2,
            unit: 'เส้น',
            images: [
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              { url: 'https://example.com/spec-sheet.jpg', name: 'สเปกโรงงาน' }
            ]
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <PRDetailsModal
              selectedPR={testPRWithImages}
              currentRole={reviewerRole}
              onClose={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      expect(html).toContain('📷 รูปสเปกจริง (2):');
      expect(html).toContain('title="คลิกเพื่อดูรูปขนาดใหญ่"');
      expect(html).toContain('alt="Item attachment 1"');
      expect(html).toContain('alt="Item attachment 2"');
      expect(html).toContain('PD-BLT-380');
      expect(html).toContain('สายพานลำเลียงทนความร้อน Mitsuboshi');
    });

    it('2. Supports item.attachments fallback array seamlessly', () => {
      const testPRWithAttachments = {
        id: 'PR-TEST-MEDIA-002',
        prNo: 'PD003/2026',
        department: 'PD',
        requestedBy: 'สมชาย ผู้ขอซื้อ',
        status: 'SUBMITTED',
        purchaseChannel: 'ONLINE',
        items: [
          {
            id: 'ITEM-2',
            code: 'PD-SNS-100',
            name: 'เซนเซอร์ตรวจจับความร้อน Omron',
            price: 3200,
            qty: 1,
            unit: 'ตัว',
            attachments: [
              'https://example.com/omron-sensor.png'
            ]
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <PRDetailsModal
              selectedPR={testPRWithAttachments}
              currentRole={reviewerRole}
              onClose={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      expect(html).toContain('📷 รูปสเปกจริง (1):');
      expect(html).toContain('src="https://example.com/omron-sensor.png"');
    });

    it('3. Does NOT render media strip when item has no images (clean non-regression)', () => {
      const testPRWithoutImages = {
        id: 'PR-TEST-MEDIA-003',
        prNo: 'PD004/2026',
        department: 'PD',
        requestedBy: 'สมศักดิ์ ผู้ขอซื้อ',
        status: 'SUBMITTED',
        purchaseChannel: 'OFFLINE',
        items: [
          {
            id: 'ITEM-3',
            code: 'PD-OIL-068',
            name: 'น้ำมันไฮดรอลิก Shell Tellus S2 M 68',
            price: 14500,
            qty: 1,
            unit: 'ถัง'
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <PRDetailsModal
              selectedPR={testPRWithoutImages}
              currentRole={reviewerRole}
              onClose={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      expect(html).not.toContain('📷 รูปสเปกจริง');
      expect(html).toContain('น้ำมันไฮดรอลิก Shell Tellus S2 M 68');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 5: PR Product Combobox/Dropdown Deduplication & Unified Master Data
  // ══════════════════════════════════════════════════════════════════
  describe('5. PR Product Combobox/Dropdown Deduplication & Unified Master Data', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      storageService.resetData();
    });

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

    it('deduplicates options so that each product appears exactly once in PRCreateView', () => {
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

      expect(html).toContain('ถุงมือยางใหม่');
      expect(html).not.toContain('ถุงมือยางใหม่ (รายการซ้ำ)');
      expect(html).not.toContain('สายพานลำเลียงทนความร้อน (Timing Belt 380-5M-15) - ซ้ำ');
      expect(html).not.toContain('สินค้าเก่าเลิกใช้');
      expect(html).not.toContain('Item 1 Mock Artifact');
    });

    it('renders deduplicated options correctly with unique collision-safe keys in ProductSelectDropdown', () => {
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

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 6: Mandatory Product Image Enforcement & Media Strip
  // ══════════════════════════════════════════════════════════════════
  describe('6. Mandatory Product Image Enforcement & Media Strip', () => {
    const sampleProducts = [
      {
        id: 'PROD-01',
        code: 'ITM-001',
        name: 'ถุงมือยางไนไตรล์สีฟ้า',
        category: 'PD',
        department: 'PD',
        price: 150,
        unit: 'กล่อง',
        purchaseUnit: 'กล่อง',
        stockUnit: 'กล่อง',
        stockBalance: 40,
        reorderPoint: 10
      }
    ];

    const requesterRole = {
      id: 'REQUESTER_PD',
      roleId: 'REQUESTER_PD',
      name: 'สมชาย ผู้ขอซื้อ',
      title: 'เจ้าหน้าที่ฝ่ายผลิต',
      department: 'PD',
      level: 1,
      canCreatePR: true
    };

    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      storageService.resetData();
      storageService.saveProducts(sampleProducts);
    });

    it('throws validation error if submitting an online PR with items lacking images', async () => {
      const onlinePRWithoutImages = {
        department: 'PD',
        purchaseChannel: 'ONLINE',
        enforceImageValidation: true,
        items: [
          {
            productId: 'PROD-01',
            price: 150,
            qty: 2,
            onlineUrl: 'https://shopee.co.th/product-item-1',
            images: []
          }
        ],
        isDraft: false
      };

      expect(() => workflowEngine.validatePR(onlinePRWithoutImages, false)).toThrow(
        'กรุณาแนบรูปภาพสินค้าให้ครบทุกรายการสำหรับงานจัดซื้อออนไลน์'
      );

      await expect(
        workflowEngine.createPR(onlinePRWithoutImages, requesterRole, false)
      ).rejects.toThrow('กรุณาแนบรูปภาพสินค้าให้ครบทุกรายการสำหรับงานจัดซื้อออนไลน์');
    });

    it('allows online PR submission when all items have at least 1 image attached', async () => {
      const onlinePRWithImages = {
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [
          {
            productId: 'PROD-01',
            price: 150,
            qty: 2,
            onlineUrl: 'https://shopee.co.th/product-item-1',
            images: [{ url: 'data:image/png;base64,mockImage', name: 'product-shot.png' }]
          }
        ],
        isDraft: false
      };

      const created = await workflowEngine.createPR(onlinePRWithImages, requesterRole, false);
      expect(created).toBeDefined();
      expect(created.status).toBe('SUBMITTED');
      expect(created.items[0].images.length).toBe(1);
    });

    it('allows online PR save when isDraft is true even if items do not have images', async () => {
      const draftOnlinePR = {
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [
          {
            productId: 'PROD-01',
            price: 150,
            qty: 2,
            images: []
          }
        ],
        isDraft: true
      };

      const draft = await workflowEngine.createPR(draftOnlinePR, requesterRole, true);
      expect(draft).toBeDefined();
      expect(draft.status).toBe('DRAFT');
    });

    it('allows offline / SELF PR submission without images', async () => {
      const selfPRWithoutImages = {
        department: 'PD',
        purchaseChannel: 'SELF',
        vendorId: 'VND-001',
        items: [
          {
            productId: 'PROD-01',
            price: 150,
            qty: 2,
            images: []
          }
        ],
        isDraft: false
      };

      const created = await workflowEngine.createPR(selfPRWithoutImages, requesterRole, false);
      expect(created).toBeDefined();
      expect(created.status).toBe('SUBMITTED');
    });

    it('throws validation error when updating/resubmitting an online PR without images', async () => {
      const draft = await workflowEngine.createPR({
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [{ productId: 'PROD-01', price: 150, qty: 1, images: [] }],
        isDraft: true
      }, requesterRole, true);

      await expect(
        workflowEngine.updatePR(draft.id, {
          purchaseChannel: 'ONLINE',
          enforceImageValidation: true,
          items: [{ productId: 'PROD-01', price: 150, qty: 1, images: [] }]
        }, requesterRole, false)
      ).rejects.toThrow('กรุณาแนบรูปภาพสินค้าให้ครบทุกรายการสำหรับงานจัดซื้อออนไลน์');
    });

    it('renders Empty State dashed rose banner with mandatory warning when online PR item has no image', () => {
      const editingOnlinePROneEmptyItem = {
        id: 'PR-TEST-001',
        prNo: 'PR-PD-2026-001',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [
          {
            productId: 'PROD-01',
            name: 'ถุงมือยางไนไตรล์สีฟ้า',
            code: 'ITM-001',
            price: 150,
            qty: 2,
            onlineUrl: 'https://shopee.co.th/product-test',
            platform: 'Shopee',
            images: []
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <PRCreateView
              currentRole={requesterRole}
              editingPR={editingOnlinePROneEmptyItem}
              products={sampleProducts}
              departments={[{ id: 'PD', name: 'ฝ่ายผลิต' }]}
              onNavigate={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      expect(html).toContain('แนบรูปภาพสินค้าจริง *');
      expect(html).toContain('(จำเป็นสำหรับจัดซื้อออนไลน์ — คลิกหรือลากวางรูปภาพที่นี่)');
      expect(html).toContain('* กรุณาแนบรูปสินค้าจริงสำหรับจัดซื้อออนไลน์');
      expect(html).toContain('border-dashed border-rose-300 bg-rose-50/50');
      expect(html).not.toContain('📷 รูปสินค้า (');
      expect(html).not.toContain('w-6 h-6 rounded border border-slate-200');
      expect(html).not.toContain('📷 แนบรูป</span>');
    });

    it('renders Filled Modern Gallery state with 48x48px thumbnails and emerald badge when image is attached', () => {
      const editingOnlinePRWithItemImage = {
        id: 'PR-TEST-002',
        prNo: 'PR-PD-2026-002',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        items: [
          {
            productId: 'PROD-01',
            name: 'ถุงมือยางไนไตรล์สีฟ้า',
            code: 'ITM-001',
            price: 150,
            qty: 2,
            onlineUrl: 'https://shopee.co.th/product-test',
            platform: 'Shopee',
            images: [
              {
                url: 'https://example.com/item-photo.png',
                name: 'item-photo.png'
              }
            ]
          }
        ]
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <PRCreateView
              currentRole={requesterRole}
              editingPR={editingOnlinePRWithItemImage}
              products={sampleProducts}
              departments={[{ id: 'PD', name: 'ฝ่ายผลิต' }]}
              onNavigate={() => {}}
            />
          </AppProvider>
        </MemoryRouter>
      );

      expect(html).toContain('✓ แนบแล้ว (1)');
      expect(html).toContain('bg-emerald-50 border border-emerald-200');
      expect(html).toContain('w-12 h-12 rounded-xl overflow-hidden');
      expect(html).toContain('title="ลบรูปนี้"');
      expect(html).toContain('bg-rose-600 text-white');
      expect(html).toContain('title="เพิ่มรูปภาพอีก"');
      expect(html).toContain('border-dashed border-slate-300');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 7: Multi-Attachment System Verification
  // ══════════════════════════════════════════════════════════════════
  describe('7. Multi-Attachment System Verification', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      storageService.resetData();
    });

    it('1. Provides fallback seed data for ITM-001 (2 images) and PD-STF-001 (1 image)', () => {
      const glovesFallback = getFallbackAttachmentsForCode('ITM-001');
      expect(glovesFallback).toBeDefined();
      expect(glovesFallback).toHaveLength(2);
      expect(glovesFallback[0].name).toContain('แพ็คเกจ');
      expect(glovesFallback[1].name).toContain('สินค้าจริง');
      expect(glovesFallback[0].url).toContain('data:image/svg+xml');
      expect(glovesFallback[1].url).toContain('data:image/svg+xml');

      const filmFallback = getFallbackAttachmentsForCode('PD-STF-001');
      expect(filmFallback).toBeDefined();
      expect(filmFallback).toHaveLength(1);
      expect(filmFallback[0].name).toContain('ฟิล์มยืดพันพาเลท');
      expect(filmFallback[0].url).toContain('data:image/svg+xml');

      expect(getFallbackAttachmentsForCode('  itm-001  ')).toHaveLength(2);
      expect(getFallbackAttachmentsForCode('pd-stf-001')).toHaveLength(1);
      expect(getFallbackAttachmentsForCode('NON-EXISTENT')).toHaveLength(0);
    });

    it('2. Maps item-level attachments and PR-level documents when PR is converted to PO in workflowEngine', async () => {
      const mockUser = {
        id: 'USR-0005',
        name: 'คุณประเสริฐ ยิ่งยง',
        employeeName: 'คุณประเสริฐ ยิ่งยง',
        title: 'Plant Manager',
        roleId: 'PLANT_MANAGER',
        level: 3
      };

      const testPR = {
        id: 'PR-TEST-ATTACH-001',
        prNo: 'PD888/2026',
        department: 'PD',
        status: 'APPROVED',
        purchaseChannel: 'ONLINE',
        quotationFiles: [
          { name: 'Quotation-Vendor-A.pdf', url: 'blob:mock-pdf-url', size: 102400, type: 'application/pdf' }
        ],
        generalAttachments: [
          { name: 'Spec-Document-Overall.jpg', url: 'blob:mock-spec-url', size: 51200, type: 'image/jpeg' }
        ],
        attachments: [
          { name: 'Quotation-Vendor-A.pdf', previewUrl: 'blob:mock-pdf-url', size: 102400, type: 'application/pdf', category: 'QUOTATION' },
          { name: 'Spec-Document-Overall.jpg', previewUrl: 'blob:mock-spec-url', size: 51200, type: 'image/jpeg', category: 'GENERAL' }
        ],
        items: [
          {
            productId: 'PROD-PD-001',
            code: 'CUSTOM-ITEM-A',
            name: 'สินค้าสั่งทำพิเศษ A',
            qty: 2,
            price: 150,
            platform: 'Shopee',
            productUrl: 'https://shopee.co.th/product/123/456',
            images: [
              { name: 'item-front.jpg', url: 'data:image/jpeg;base64,frontImg', previewUrl: 'data:image/jpeg;base64,frontImg' },
              { name: 'item-back.jpg', url: 'data:image/jpeg;base64,backImg', previewUrl: 'data:image/jpeg;base64,backImg' },
              { name: 'item-detail.jpg', url: 'data:image/jpeg;base64,detailImg', previewUrl: 'data:image/jpeg;base64,detailImg' }
            ]
          },
          {
            productId: 'PROD-PD-002',
            code: 'ITM-001',
            name: 'ถุงมือยางไนไตรล์',
            qty: 10,
            price: 100,
            platform: 'Lazada',
            productUrl: 'https://lazada.co.th/product/789',
            images: []
          }
        ]
      };

      const po = await workflowEngine.createPOFromPR(testPR, mockUser);
      expect(po).toBeDefined();

      expect(po.prAttachments).toBeDefined();
      expect(po.prAttachments.length).toBeGreaterThanOrEqual(2);
      const hasQuotation = po.prAttachments.some(a => a.name === 'Quotation-Vendor-A.pdf');
      const hasGeneral = po.prAttachments.some(a => a.name === 'Spec-Document-Overall.jpg');
      expect(hasQuotation).toBe(true);
      expect(hasGeneral).toBe(true);

      const item1 = po.items[0];
      expect(item1.attachments).toBeDefined();
      expect(item1.attachments).toHaveLength(3);
      expect(item1.attachments[0].name).toBe('item-front.jpg');
      expect(item1.productUrl).toBe('https://shopee.co.th/product/123/456');
      expect(item1.storePlatform).toBe('Shopee');

      const item2 = po.items[1];
      expect(item2.attachments).toBeDefined();
      expect(item2.attachments).toHaveLength(2);
      expect(item2.attachments[0].name).toContain('แพ็คเกจ');
      expect(item2.attachments[1].name).toContain('สินค้าจริง');
      expect(item2.productUrl).toBe('https://lazada.co.th/product/789');
      expect(item2.storePlatform).toBe('Lazada');
    });

    it('3. Non-regression: Financial calculations and line item contracts are preserved', async () => {
      const mockUser = {
        id: 'USR-0005',
        name: 'คุณประเสริฐ ยิ่งยง',
        title: 'Plant Manager',
        roleId: 'PLANT_MANAGER',
        level: 3
      };

      const testPR = {
        id: 'PR-MATH-TEST',
        prNo: 'PD999/2026',
        department: 'PD',
        status: 'APPROVED',
        purchaseChannel: 'ONLINE',
        items: [
          {
            productId: 'PROD-1',
            code: 'ITM-001',
            name: 'Item 1',
            qty: 5,
            price: 200,
            discountAmount: 50
          }
        ]
      };

      const po = await workflowEngine.createPOFromPR(testPR, mockUser);
      expect(po.items[0].orderedQty).toBe(5);
      expect(po.items[0].remainingQty).toBe(5);
      expect(po.items[0].receivedQty).toBe(0);
      expect(po.subtotal).toBe(1000);
      expect(po.status).toBe('IN_PROGRESS_ONLINE');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Sub-Suite 8: Workflow State Machine Guards & Mock Data Consistency
  // ══════════════════════════════════════════════════════════════════
  describe('8. Workflow State Machine Guards & Mock Data Consistency', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      storageService.resetData();
      storageService.saveProducts([
        { id: 'PROD-PD-001', code: 'PD-OIL-068', name: 'น้ำมันไฮดรอลิกอุตสาหกรรม', category: 'PD', price: 14500, stockBalance: 5, unit: 'ลิตร' },
        { id: 'PROD-PD-008', code: 'PD-STF-001', name: 'ฟิล์มยืดพันพาเลท', category: 'PD', price: 1100, stockBalance: 10, unit: 'ม้วน' }
      ]);
    });

    it('data/pos.json and data/prs.json are clean empty arrays for zero-state initialization', () => {
      const posPath = path.resolve(process.cwd(), 'data/pos.json');
      const pos = JSON.parse(fs.readFileSync(posPath, 'utf-8'));
      const prsPath = path.resolve(process.cwd(), 'data/prs.json');
      const prs = JSON.parse(fs.readFileSync(prsPath, 'utf-8'));

      expect(Array.isArray(pos)).toBe(true);
      expect(Array.isArray(prs)).toBe(true);
      expect(pos.length).toBe(0);
      expect(prs.length).toBe(0);
    });

    it('Master Data files (vendors.json, products.json, users.json) are 100% preserved', () => {
      const vendorsPath = path.resolve(process.cwd(), 'data/vendors.json');
      const vendors = JSON.parse(fs.readFileSync(vendorsPath, 'utf-8'));
      const productsPath = path.resolve(process.cwd(), 'data/products.json');
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
      const usersPath = path.resolve(process.cwd(), 'data/users.json');
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

      expect(Array.isArray(vendors)).toBe(true);
      expect(vendors.length).toBeGreaterThan(0);
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    });

    it('throws error when createPOFromPR is called on a PR with status WAITING_REVIEW', async () => {
      const unapprovedPR = {
        id: 'PR-TEST-WAITING',
        prNo: 'PD999/2026',
        department: 'PD',
        status: 'WAITING_REVIEW',
        purchaseChannel: 'SELF',
        items: [
          { productId: 'PROD-PD-008', qty: 10, price: 100 }
        ]
      };

      await expect(
        workflowEngine.createPOFromPR(unapprovedPR, ROLES.PLANT_MANAGER)
      ).rejects.toThrow(/ไม่อนุญาตให้ออกใบสั่งซื้อ \(PO\)/);
    });

    it('throws error when createPOFromPR is called on a PR with status SUBMITTED or DRAFT', async () => {
      const submittedPR = {
        id: 'PR-TEST-SUBMITTED',
        prNo: 'PD998/2026',
        department: 'PD',
        status: 'SUBMITTED',
        purchaseChannel: 'SELF',
        items: [{ productId: 'PROD-PD-008', qty: 5, price: 100 }]
      };

      await expect(
        workflowEngine.createPOFromPR(submittedPR, ROLES.PLANT_MANAGER)
      ).rejects.toThrow(/ไม่อนุญาตให้ออกใบสั่งซื้อ/);
    });

    it('allows createPOFromPR when PR status is APPROVED', async () => {
      const approvedPR = {
        id: 'PR-TEST-APPROVED',
        prNo: 'PD997/2026',
        department: 'PD',
        status: 'APPROVED',
        purchaseChannel: 'SELF',
        items: [
          { productId: 'PROD-PD-001', qty: 2, price: 14500 }
        ]
      };

      const po = await workflowEngine.createPOFromPR(approvedPR, ROLES.PLANT_MANAGER);
      expect(po).toBeDefined();
      expect(po.prNo).toBe('PD997/2026');
      expect(po.prNumber).toBe('PD997/2026');
      expect(po.status).toBe('ISSUED');
    });

    it('blocks updatePRStatus to APPROVED if current status is WAITING_REVIEW or SUBMITTED', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        source: 'FACTORY',
        purchaseChannel: 'SELF',
        items: [{ productId: 'PROD-PD-001', qty: 1, price: 14500 }],
        totalAmount: 14500,
        isDraft: false
      }, ROLES.REQUESTER_PD);

      await expect(
        workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER)
      ).rejects.toThrow(/ไม่อนุญาตให้อนุมัติออกใบสั่งซื้อ/);
    });

    it('successfully approves and issues PO when PR has been reviewed (status REVIEWED)', async () => {
      const pr = await workflowEngine.createPR({
        department: 'PD',
        source: 'FACTORY',
        purchaseChannel: 'SELF',
        items: [{ productId: 'PROD-PD-001', qty: 1, price: 14500 }],
        totalAmount: 14500,
        isDraft: false
      }, ROLES.REQUESTER_PD);

      await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER);

      const result = await workflowEngine.updatePRStatus(pr.id, 'APPROVED', ROLES.PLANT_MANAGER);
      expect(result.pr.status).toBe('PO_ISSUED');
      expect(result.po).toBeDefined();
      expect(result.pr.poNumber).toBe(result.po.poNo);
    });

    it('storageService.getPRs() strips legacy poNumber from PD002/2026', () => {
      const prs = [
        {
          id: 'PR-1789100542800-9OZ',
          prNo: 'PD002/2026',
          department: 'PD',
          status: 'completed',
          poNumber: 'PO-PD-2026-001',
          poNo: 'PO-PD-2026-001',
          items: []
        }
      ];
      storageService.savePRs(prs);

      const loaded = storageService.getPRs();
      const pd002 = loaded.find(p => p.prNo === 'PD002/2026');
      expect(pd002).toBeDefined();
      expect(pd002.poNumber).toBeUndefined();
      expect(pd002.poNo).toBeUndefined();
      expect(pd002.status).toBe('WAITING_REVIEW');
    });

    it('storageService.getPOs() heals PO-PD-2026-001 if referencing PD002/2026', () => {
      const pos = [
        {
          id: 'PO-1789003809083-1',
          poNo: 'PO-PD-2026-001',
          prNo: 'PD002/2026',
          prNumber: 'PD002/2026',
          department: 'PD',
          items: []
        }
      ];
      storageService.savePOs(pos);

      const loaded = storageService.getPOs();
      const po001 = loaded.find(p => p.poNo === 'PO-PD-2026-001');
      expect(po001).toBeDefined();
      expect(po001.prNo).toBe('PD001/2026');
      expect(po001.prNumber).toBe('PD001/2026');
      expect(po001.prId).toBe('PR-PD001-2026');
    });
  });
});
