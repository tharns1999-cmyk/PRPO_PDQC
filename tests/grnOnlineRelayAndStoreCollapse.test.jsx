import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext';
import OnlineOrderCard, { calculateDisputeMetrics, getStoreGroupKey } from '../src/views/procurement/OnlineOrderCard';
import { storageService } from '../src/services/storageService';

describe('GRN Data Relay & Online Order Card Precision Verification', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('calculates metrics for Lubricant (damaged 1 of 5), Gloves (5 of 5), Conveyor (4 of 5 wait next round)', () => {
    // 1. Lubricant (น้ำมันหล่อลื่น)
    const lubricant = {
      id: 'it-lubricant',
      code: 'LUB-01',
      name: 'น้ำมันหล่อลื่นสังเคราะห์',
      purchaseQty: 5,
      actualQty: 5,
      receivedQty: 4,
      damagedQty: 1,
      shortageQty: 0,
      unitPrice: 500,
      actualPrice: 500,
      purchaseUnit: 'ถัง',
      unit: 'ถัง',
      isDamaged: true,
      hasDispute: true,
      disputeAction: 'CLAIM',
      storePlatform: 'Shopee',
      actualStoreName: 'ร้านน้ำมันหล่อลื่น'
    };
    const m1 = calculateDisputeMetrics(lubricant, 'PARTIALLY_RECEIVED_IN_CLAIM', true);
    expect(m1.orderedQty).toBe(5);
    expect(m1.receivedQty).toBe(4);
    expect(m1.damagedQty).toBe(1);
    expect(m1.shortageQty).toBe(0);
    expect(m1.disputedQty).toBe(1);
    expect(m1.claimableAmount).toBe(500);
    expect(m1.hasDispute).toBe(true);

    // 2. Rubber Gloves (ถุงมือยาง)
    const gloves = {
      id: 'it-gloves',
      code: 'GLV-01',
      name: 'ถุงมือยางแพทย์',
      purchaseQty: 5,
      actualQty: 5,
      receivedQty: 5,
      damagedQty: 0,
      shortageQty: 0,
      unitPrice: 120,
      actualPrice: 120,
      purchaseUnit: 'กล่อง',
      unit: 'กล่อง',
      isDamaged: false,
      hasDispute: false,
      storePlatform: 'Shopee',
      actualStoreName: 'ร้านถุงมือยาง'
    };
    const m2 = calculateDisputeMetrics(gloves, 'PARTIALLY_RECEIVED_IN_CLAIM', true);
    expect(m2.orderedQty).toBe(5);
    expect(m2.receivedQty).toBe(5);
    expect(m2.damagedQty).toBe(0);
    expect(m2.shortageQty).toBe(0);
    expect(m2.disputedQty).toBe(0);
    expect(m2.claimableAmount).toBe(0);
    expect(m2.hasDispute).toBe(false);

    // 3. Conveyor Belt (สายพานลำเลียง)
    const conveyor = {
      id: 'it-conveyor',
      code: 'BELT-01',
      name: 'สายพานลำเลียงอุตสาหกรรม',
      purchaseQty: 5,
      actualQty: 5,
      receivedQty: 4,
      damagedQty: 0,
      shortageQty: 1,
      unitPrice: 850,
      actualPrice: 850,
      purchaseUnit: 'เส้น',
      unit: 'เส้น',
      isDamaged: false,
      hasDispute: false,
      disputeAction: 'WAIT_NEXT_ROUND',
      shortageReason: 'SPLIT_SHIPMENT',
      storePlatform: 'Lazada',
      actualStoreName: 'ร้านสายพานลำเลียง'
    };
    const m3 = calculateDisputeMetrics(conveyor, 'PARTIALLY_RECEIVED_IN_CLAIM', true);
    expect(m3.orderedQty).toBe(5);
    expect(m3.receivedQty).toBe(4);
    expect(m3.damagedQty).toBe(0);
    expect(m3.shortageQty).toBe(1);
    expect(m3.disputedQty).toBe(0);
    expect(m3.claimableAmount).toBe(0);
    expect(m3.hasDispute).toBe(false);
    expect(m3.isWaitingNextRound).toBe(true);
    expect(m3.waitingNextRoundQty).toBe(1);
  });

  it('renders OnlineOrderCard with 3 stores exactly matching all user UI directives', () => {
    const multiStorePO = {
      id: 'PO-2026-RELAY-01',
      poNo: 'PO-2026-RELAY-01',
      status: 'PARTIALLY_RECEIVED_IN_CLAIM',
      department: 'PD',
      items: [
        {
          id: 'it-1',
          code: 'LUB-01',
          name: 'น้ำมันหล่อลื่นสังเคราะห์',
          purchaseQty: 5,
          actualQty: 5,
          receivedQty: 4,
          goodQty: 4,
          damagedQty: 1,
          shortageQty: 0,
          unitPrice: 500,
          actualPrice: 500,
          purchaseUnit: 'ถัง',
          unit: 'ถัง',
          isDamaged: true,
          hasDispute: true,
          disputeAction: 'CLAIM',
          storePlatform: 'Shopee',
          actualStoreName: 'ร้านน้ำมันหล่อลื่น'
        },
        {
          id: 'it-2',
          code: 'GLV-01',
          name: 'ถุงมือยางแพทย์',
          purchaseQty: 5,
          actualQty: 5,
          receivedQty: 5,
          goodQty: 5,
          damagedQty: 0,
          shortageQty: 0,
          unitPrice: 120,
          actualPrice: 120,
          purchaseUnit: 'กล่อง',
          unit: 'กล่อง',
          isDamaged: false,
          hasDispute: false,
          storePlatform: 'Shopee',
          actualStoreName: 'ร้านถุงมือยาง'
        },
        {
          id: 'it-3',
          code: 'BELT-01',
          name: 'สายพานลำเลียงอุตสาหกรรม',
          purchaseQty: 5,
          actualQty: 5,
          receivedQty: 4,
          goodQty: 4,
          damagedQty: 0,
          shortageQty: 1,
          unitPrice: 850,
          actualPrice: 850,
          purchaseUnit: 'เส้น',
          unit: 'เส้น',
          isDamaged: false,
          hasDispute: false,
          disputeAction: 'WAIT_NEXT_ROUND',
          shortageReason: 'SPLIT_SHIPMENT',
          storePlatform: 'Lazada',
          actualStoreName: 'ร้านสายพานลำเลียง'
        }
      ],
      storeClaims: {}
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <OnlineOrderCard
            po={multiStorePO}
            activeTab="CLAIM"
            currentRole={{ id: 'ONLINE_PURCHASER', name: 'Online Purchaser' }}
            onUpdate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // 1. ร้านน้ำมันหล่อลื่น (ชำรุด 1):
    // ต้องขึ้น Badge ⚠️ ร้านนี้มีรายการติดปัญหา
    expect(html).toContain('ร้าน: ร้านน้ำมันหล่อลื่น');
    expect(html).toContain('⚠️ ร้านนี้มีรายการติดปัญหา');
    // บรรทัดสินค้าต้องขึ้น ⚠️ ชำรุด 1 ถัง
    expect(html).toContain('⚠️ ชำรุด 1 ถัง');
    // ฝั่งขวาต้องแสดง มูลค่าที่ต้องเคลม: ฿500.00
    expect(html).toContain('มูลค่าที่ต้องเคลม');
    expect(html).toContain('฿500.00');
    // กางแผง Quick Settlement อัตโนมัติ
    expect(html).toContain('💰 คืนเงิน (Refund)');
    expect(html).toContain('value="500"');

    // 2. ร้านถุงมือยาง (รับครบ 5/5):
    // บังคับยุบเป็น Slim Muted Row ทันที ((รับของครบสมบูรณ์)) ห้ามกางบรรทัดสินค้าออกมา
    expect(html).toContain('ร้าน: ร้านถุงมือยาง');
    expect(html).toContain('(รับของครบสมบูรณ์)');

    // 3. ร้านสายพานลำเลียง (รับ 4 ขาด 1 แต่เลือก "รอส่งรอบถัดไป"):
    // ไม่ใช่การเคลม ให้ยุบเก็บเป็น Slim Row พร้อมข้อความ (รอส่งมอบเพิ่ม 1 เส้น)
    expect(html).toContain('ร้าน: ร้านสายพานลำเลียง');
    expect(html).toContain('(รอส่งมอบเพิ่ม 1 เส้น)');
  });
});
