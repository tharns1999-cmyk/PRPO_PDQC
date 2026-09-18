import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';

import { warehouseService } from '../src/services/warehouseService';
import { storageService } from '../src/services/storageService';
import { workflowEngine } from '../src/services/workflowEngine';
import { 
  workspaceService, 
  isTaskForMe, 
  isInProgressTask, 
  getTaskBadgeLabel 
} from '../src/services/workspaceService';
import OnlineOrderCard, { resolveGRNEvidence } from '../src/views/procurement/OnlineOrderCard';
import { AppProvider } from '../src/context/AppContext';

vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (node) => node
  };
});

describe('Mission-Critical Suite: Claim State Machine, Task Blocker & Evidence Drawer', () => {
  const requesterUser = {
    id: 'USR-REQ-QC',
    name: 'นายสมชาย ผู้ตรวจรับ',
    roleId: 'REQUESTER_QC',
    department: 'QC',
    level: 1
  };

  const onlinePurchaserUser = {
    id: 'USR-BUYER',
    name: 'เจ้าหน้าที่จัดซื้อออนไลน์',
    roleId: 'ONLINE_PURCHASER',
    canOnlinePurchase: true,
    department: 'PURCHASING',
    level: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof localStorage !== 'undefined') localStorage.clear();
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
    storageService.resetData();
  });

  describe('1. Backend Logic: warehouseService.submitGRN', () => {
    it('locks PO status to CLAIM_PENDING when items have damagedQty > 0 or shortageQty > 0 and NEVER WAITING_DELIVERY_ROUND_2', async () => {
      const initialPO = {
        id: 'PO-CLAIM-001',
        poNo: 'PO-2026-991',
        status: 'ORDERED',
        purchaseChannel: 'ONLINE',
        department: 'QC',
        items: [
          {
            id: 'ITM-01',
            productId: 'PROD-GAUGE-99',
            name: 'เกจวัดแรงดัน',
            code: 'GAUGE-01',
            orderedQty: 10,
            receivedQty: 0,
            price: 500,
            unit: 'อัน'
          }
        ]
      };
      const initialProduct = {
        id: 'PROD-GAUGE-99',
        code: 'GAUGE-01',
        name: 'เกจวัดแรงดัน',
        stockBalance: 5,
        averageCost: 400,
        totalValue: 2000,
        price: 500,
        unit: 'อัน'
      };

      storageService.savePOs([initialPO]);
      storageService.saveProducts([initialProduct]);
      storageService.saveStockLogs([]);

      const grnPayload = {
        grnNumber: 'GRN-2026-991-01',
        receivingItems: [
          {
            productId: 'PROD-GAUGE-99',
            goodQty: 6,
            damagedQty: 2,
            shortageQty: 2,
            defectNote: 'หน้าปัดแตกร้าว 2 อัน และขาดส่ง 2 อัน'
          }
        ],
        defectNote: 'กล่องบุบเสียหาย หน้าปัดแตกร้าว',
        defectImages: ['https://drive.google.com/file/d/evidence-box-1/view'],
        inspectorName: 'นายสมชาย ผู้ตรวจรับ',
        inspectedAt: '2026-09-18T08:30:00.000Z'
      };

      const res = await warehouseService.submitGRN(initialPO.id, grnPayload, { user: requesterUser });
      expect(res.success).toBe(true);

      const savedPOs = storageService.getPOs();
      const updatedPO = savedPOs.find(p => p.id === initialPO.id);

      // กฎเหล็ก: สถานะต้องเป็น CLAIM_PENDING เท่านั้น! ห้ามเป็น WAITING_DELIVERY_ROUND_2
      expect(updatedPO.status).toBe('CLAIM_PENDING');
      expect(updatedPO.claimStatus).toBe('PENDING_CLAIM');
      expect(updatedPO.hasDispute).toBe(true);
      expect(updatedPO.isInClaim).toBe(true);

      // ตรวจสอบสต็อกของดี 6 ชิ้นเข้าคลัง และคำนวณ MAC ตามปกติ
      const savedProducts = storageService.getProducts();
      const updatedProd = savedProducts.find(p => p.id === 'PROD-GAUGE-99');
      expect(updatedProd.stockBalance).toBe(11); // 5 + 6
      // MAC: (5 * 400 + 6 * 500) / 11 = 5000 / 11 = 454.55
      expect(updatedProd.averageCost).toBe(454.55);

      // ตรวจสอบการบันทึกหลักฐาน (Evidence Persistence) ลงใน claimEvidence และ disputeInfo
      expect(updatedPO.claimEvidence).toBeDefined();
      expect(updatedPO.claimEvidence.inspectorName).toBe('นายสมชาย ผู้ตรวจรับ');
      expect(updatedPO.claimEvidence.inspectedAt).toBe('2026-09-18T08:30:00.000Z');
      expect(updatedPO.claimEvidence.defectNote).toContain('กล่องบุบเสียหาย');
      expect(updatedPO.claimEvidence.defectImages).toHaveLength(1);

      expect(updatedPO.disputeInfo).toBeDefined();
      expect(updatedPO.disputeInfo.inspectorName).toBe('นายสมชาย ผู้ตรวจรับ');
      expect(updatedPO.disputeInfo.defectNote).toContain('กล่องบุบเสียหาย');
    });
  });

  describe('2. Workspace Task Routing: workspaceService', () => {
    const claimPendingPO = {
      id: 'PO-CLAIM-002',
      poNo: 'PO-2026-992',
      docType: 'PO',
      status: 'CLAIM_PENDING',
      purchaseChannel: 'ONLINE',
      department: 'QC',
      requestedBy: 'นายสมชาย ผู้ตรวจรับ',
      hasUnresolvedClaim: true,
      items: [{ name: 'สินค้าติดเคลม', orderedQty: 5, receivedQty: 3, damagedQty: 2 }]
    };

    it('blocks Requester from seeing CLAIM_PENDING in To Do tab', () => {
      const isTodo = isTaskForMe(claimPendingPO, requesterUser);
      expect(isTodo).toBe(false);
    });

    it('routes CLAIM_PENDING to In Progress tab for Requester with badge "⏳ รอฝ่ายจัดซื้อเจรจาเคลมร้านค้า"', () => {
      const isInProg = isInProgressTask(claimPendingPO, requesterUser);
      expect(isInProg).toBe(true);

      const badgeLabel = getTaskBadgeLabel(claimPendingPO, requesterUser);
      expect(badgeLabel).toBe('⏳ รอฝ่ายจัดซื้อเจรจาเคลมร้านค้า');
    });

    it('allows Requester to get To Do task for round 2 ONLY when status is WAITING_DELIVERY_ROUND_2', () => {
      const round2PO = {
        ...claimPendingPO,
        status: 'WAITING_DELIVERY_ROUND_2',
        hasUnresolvedClaim: false
      };

      const isTodo = isTaskForMe(round2PO, requesterUser);
      expect(isTodo).toBe(true);
    });
  });

  describe('3. State Transitions in Online Procurement Hub', () => {
    it('sets PO status to WAITING_DELIVERY_ROUND_2 when Online Purchaser chooses Replacement', async () => {
      const po = {
        id: 'PO-ONLINE-REP',
        poNo: 'PO-2026-REP',
        status: 'CLAIM_PENDING',
        claimStatus: 'PENDING_CLAIM',
        department: 'QC',
        purchaseChannel: 'ONLINE',
        items: [
          {
            id: 'ITM-REP-1',
            name: 'หัวแร้งไฟฟ้า',
            orderedQty: 5,
            receivedQty: 3,
            damagedQty: 2,
            price: 250,
            storeName: 'ToolsOfficial'
          }
        ]
      };

      storageService.savePOs([po]);

      const updated = await workflowEngine.resolveClaim(
        po.id,
        {
          storeKey: 'Shopee_toolsofficial',
          type: 'REPLACEMENT',
          newTrackingNo: 'TH-REPLACE-888',
          allStoresResolved: true,
          hasPendingDeliveries: true,
          note: 'ร้านค้ายินยอมส่งตัวใหม่มาทดแทน'
        },
        onlinePurchaserUser
      );

      expect(updated.status).toBe('WAITING_DELIVERY_ROUND_2');
      expect(updated.claimStatus).toBe('REPLACEMENT_PENDING');
      expect(updated.hasDispute).toBe(false);
      expect(updated.isInClaim).toBe(false);
    });

    it('sets PO status to COMPLETED and restores budget when Online Purchaser chooses Refund', async () => {
      const po = {
        id: 'PO-ONLINE-REF',
        poNo: 'PO-2026-REF',
        status: 'CLAIM_PENDING',
        claimStatus: 'PENDING_CLAIM',
        department: 'QC',
        purchaseChannel: 'ONLINE',
        items: [
          {
            id: 'ITM-REF-1',
            name: 'มอเตอร์ปั๊มน้ำ',
            orderedQty: 2,
            receivedQty: 1,
            damagedQty: 1,
            price: 1200,
            storeName: 'MotorShop'
          }
        ]
      };

      storageService.savePOs([po]);

      const updated = await workflowEngine.resolveClaim(
        po.id,
        {
          storeKey: 'Shopee_motorshop',
          type: 'REFUND',
          refundAmount: 1200,
          allStoresResolved: true,
          hasPendingDeliveries: false,
          note: 'ร้านค้าคืนเงินเต็มจำนวนเข้า ShopeePay'
        },
        onlinePurchaserUser
      );

      expect(updated.status).toBe('COMPLETED');
      expect(updated.claimStatus).toBe('RESOLVED');
      expect(updated.hasDispute).toBe(false);
      expect(updated.isInClaim).toBe(false);
    });
  });

  describe('4. Evidence Drawer & Lightbox in OnlineOrderCard', () => {
    it('resolveGRNEvidence extracts inspectorName, inspectedAt, defectNote, and images', () => {
      const mockPO = {
        id: 'PO-EV-001',
        poNo: 'PO-2026-EV1',
        claimEvidence: {
          inspectorName: 'น.ส. วิภาดา ผู้ตรวจสอบ',
          inspectedAt: '2026-09-18T10:15:00.000Z',
          defectNote: 'สินค้าแตกหักจากการขนส่ง สภาพกล่องเปียกน้ำ',
          defectImages: [
            'https://drive.google.com/file/d/box_photo_1/view',
            'https://drive.google.com/file/d/broken_part_1/view'
          ]
        }
      };

      const evidence = resolveGRNEvidence(mockPO);
      expect(evidence).toBeDefined();
      expect(evidence.inspectorName).toBe('น.ส. วิภาดา ผู้ตรวจสอบ');
      expect(evidence.inspectedAt).not.toBe('-');
      expect(evidence.defectNote).toContain('สินค้าแตกหักจากการขนส่ง');
      expect(evidence.images).toHaveLength(2);
      expect(evidence.images[0].url).toContain('box_photo_1');
    });

    it('renders GRN Evidence Panel in OnlineOrderCard with inspector info, defect note, and image thumbnails', () => {
      const mockPO = {
        id: 'PO-CARD-EV',
        poNo: 'PO-2026-CEV',
        status: 'CLAIM_PENDING',
        purchaseChannel: 'ONLINE',
        department: 'QC',
        platform: 'Shopee',
        actualStoreName: 'TechStore',
        items: [
          {
            id: 'ITM-CEV-1',
            name: 'เซ็นเซอร์วัดอุณหภูมิ',
            orderedQty: 10,
            receivedQty: 7,
            damagedQty: 3,
            actualPrice: 350,
            storeName: 'TechStore'
          }
        ],
        claimEvidence: {
          inspectorName: 'นายประสิทธิ์ ตรวจรับ',
          inspectedAt: '2026-09-18T11:00:00.000Z',
          defectNote: 'หัวเซ็นเซอร์หัก 3 ตัว ไม่สามารถใช้งานได้',
          defectImages: ['https://drive.google.com/file/d/sensor_broken_img/view']
        }
      };

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AppProvider>
            <OnlineOrderCard 
              po={mockPO} 
              activeTab="CLAIM" 
              currentRole={onlinePurchaserUser} 
            />
          </AppProvider>
        </MemoryRouter>
      );

      // ตรวจสอบว่ามีกล่องหลักฐานจากหน้างาน (GRN Evidence Panel)
      expect(html).toContain('หลักฐานการตรวจรับ (GRN Evidence)');
      expect(html).toContain('รายงานจาก:');
      expect(html).toContain('นายประสิทธิ์ ตรวจรับ');
      expect(html).toContain('หัวเซ็นเซอร์หัก 3 ตัว ไม่สามารถใช้งานได้');
      expect(html).toContain('sensor_broken_img');
    });
  });
});
