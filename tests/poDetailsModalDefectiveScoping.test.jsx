import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import './setup.js';
import PODetailsModal from '../src/components/po/PODetailsModal';
import { storageService } from '../src/services/storageService';

// Mock child modals and portal to keep unit tests fast and clean in SSR/Static rendering
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (node) => node
  };
});

describe('PODetailsModal - Defective Items PO-Scoping & Zero Ghost Cards Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Scenario 1: Normal PO (PO-PD-2026-001) with unrelated defect PROD-PD-008 completely hides the defective box', () => {
    // Normal PO containing only itm-001 and ITM-002
    // Stale/leaked ngItems contains PROD-PD-008 (which belongs to a different order)
    const normalPO = {
      id: 'PO-1789306379792-1',
      poNo: 'PO-PD-2026-001',
      poNumber: 'PO-PD-2026-001',
      prNo: 'PD001/2026',
      department: 'PD',
      vendorName: 'Shopee Supplier',
      status: 'CLOSED',
      items: [
        {
          productId: 'PROD-PD-1789273108904',
          code: 'itm-001',
          name: 'ถุงมือยางใหม่',
          qty: 1,
          purchaseQty: 1,
          stockQty: 1,
          unit: 'ชิ้น',
          price: 15
        },
        {
          productId: 'PROD-ITM-002',
          code: 'ITM-002',
          name: 'น้ำมันหล่อลื่นสังเคราะห์',
          qty: 1,
          purchaseQty: 1,
          stockQty: 1,
          unit: 'ชิ้น',
          price: 246
        }
      ],
      // Leaked/unlinked defect record from an alien product PROD-PD-008
      ngItems: [
        {
          productId: 'PROD-PD-008',
          productCode: 'PD-STF-001',
          name: 'ฟิล์มยืดพันพาเลท (Stretch Film 15 Micron 500mm x 300m)',
          qty: 6,
          unit: 'ม้วน',
          defectReason: 'ฉีกขาดเสียหาย',
          reason: 'SHORT_SHIPMENT'
        }
      ]
    };

    const html = renderToStaticMarkup(
      <PODetailsModal
        selectedPO={normalPO}
        currentRole={{ id: 'PLANT_MGR', name: 'Plant Manager' }}
        onClose={() => {}}
      />
    );

    // Verify normal items are rendered
    expect(html).toContain('ถุงมือยางใหม่');
    expect(html).toContain('น้ำมันหล่อลื่นสังเคราะห์');

    // Verify alien product PROD-PD-008 is NOT rendered anywhere in the modal
    expect(html).not.toContain('PROD-PD-008');
    expect(html).not.toContain('ฟิล์มยืดพันพาเลท');

    // Verify the red "บันทึกสินค้าชำรุด (Defective Items)" box is completely omitted from the DOM
    expect(html).not.toContain('บันทึกสินค้าชำรุด (Defective Items)');
    expect(html).not.toContain('po-defective-items-section');
  });

  it('Scenario 2: Legitimate defect on current PO item renders defective box with only that item', () => {
    // PO with genuine defect recorded during GRN
    const poWithDefect = {
      id: 'PO-PD-2026-009',
      poNo: 'PO-PD-2026-009',
      poNumber: 'PO-PD-2026-009',
      prNo: 'PD009/2026',
      department: 'PD',
      vendorName: 'Chemical Vendor',
      status: 'PARTIALLY_RECEIVED',
      items: [
        {
          productId: 'PROD-PD-1789273108904',
          code: 'itm-001',
          name: 'ถุงมือยางใหม่',
          qty: 10,
          purchaseQty: 10,
          stockQty: 10,
          unit: 'ชิ้น',
          price: 15
        },
        {
          productId: 'PROD-ITM-002',
          code: 'ITM-002',
          name: 'น้ำมันหล่อลื่นสังเคราะห์',
          qty: 5,
          purchaseQty: 5,
          stockQty: 5,
          unit: 'ชิ้น',
          price: 246
        }
      ],
      ngItems: [
        {
          poNumber: 'PO-PD-2026-009',
          productId: 'PROD-PD-1789273108904',
          productCode: 'itm-001',
          name: 'ถุงมือยางใหม่',
          qty: 2,
          unit: 'ชิ้น',
          defectReason: 'ซองขาดและมีรอยฉีก',
          reason: 'DAMAGED'
        }
      ]
    };

    const html = renderToStaticMarkup(
      <PODetailsModal
        selectedPO={poWithDefect}
        currentRole={{ id: 'REQUESTER_PD', name: 'Requester' }}
        onClose={() => {}}
      />
    );

    // Defective box must render
    expect(html).toContain('บันทึกสินค้าชำรุด (Defective Items)');
    expect(html).toContain('po-defective-items-section');

    // Defective details for itm-001 must be displayed
    expect(html).toContain('ซองขาดและมีรอยฉีก');
    expect(html).toContain('2 ชิ้น');
  });

  it('Scenario 3: PO with zero defects renders zero ghost cards', () => {
    const cleanPO = {
      id: 'PO-PD-2026-010',
      poNo: 'PO-PD-2026-010',
      poNumber: 'PO-PD-2026-010',
      prNo: 'PD010/2026',
      department: 'PD',
      vendorName: 'Supplier Co.',
      status: 'COMPLETED',
      items: [
        {
          productId: 'PROD-PD-001',
          code: 'PD-OIL-001',
          name: 'Hydraulic Oil ISO VG 68',
          qty: 5,
          unit: 'ถัง'
        }
      ],
      ngItems: []
    };

    const html = renderToStaticMarkup(
      <PODetailsModal
        selectedPO={cleanPO}
        currentRole={{ id: 'PLANT_MGR', name: 'Plant Manager' }}
        onClose={() => {}}
      />
    );

    expect(html).not.toContain('บันทึกสินค้าชำรุด (Defective Items)');
    expect(html).not.toContain('po-defective-items-section');
  });

  it('Scenario 4: storageService.getDefectiveItemsForPO enforces strict PO scoping and rejects alien records', () => {
    const mockPO = {
      id: 'PO-TEST-001',
      poNo: 'PO-TEST-001',
      items: [
        { productId: 'P-1', code: 'ITEM-1', name: 'Widget A' }
      ],
      ngItems: [
        { productId: 'P-1', code: 'ITEM-1', name: 'Widget A', qty: 1, defectReason: 'Broken' },
        { productId: 'P-ALIEN', code: 'ITEM-ALIEN', name: 'Alien Item', qty: 5, defectReason: 'Leaked' },
        { poNumber: 'PO-OTHER-999', productId: 'P-1', code: 'ITEM-1', name: 'Widget A', qty: 1, defectReason: 'From other PO' }
      ]
    };

    const scoped = storageService.getDefectiveItemsForPO(mockPO);

    // Only the genuine line item for this PO should remain
    expect(scoped.length).toBe(1);
    expect(scoped[0].productId).toBe('P-1');
    expect(scoped[0].name).toBe('Widget A');
    expect(scoped[0].qty).toBe(1);
  });
});
