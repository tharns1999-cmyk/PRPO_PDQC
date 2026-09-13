import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StockMovementTable from '../src/components/stock/StockMovementTable';
import StockCardView from '../src/views/StockCardView';
import { storageService, normalizeDocNumber } from '../src/services/storageService';
import { warehouseService, generateGRNNumber } from '../src/services/warehouseService';
import { recordGoodsReceipt } from '../src/context/ProcurementContext';

describe('GRN Document Numbering Standard & Self-Healing Regression Suite', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  // ── Scenario 1: Round 1 GRN Creation ──
  it('Scenario 1 (Round 1 GRN Creation): Creating a new GRN for PO-PD-2026-002 (Round 1) strictly generates GRN-PO-PD-2026-002-01', async () => {
    // 1. Direct generator test
    const genNo = generateGRNNumber('PO-PD-2026-002', 1);
    expect(genNo).toBe('GRN-PO-PD-2026-002-01');

    // Edge cases: roundNumber as string or 0 or undefined defaults safely to 01
    expect(generateGRNNumber('PO-PD-2026-002')).toBe('GRN-PO-PD-2026-002-01');
    expect(generateGRNNumber('PO-PD-2026-002', '1')).toBe('GRN-PO-PD-2026-002-01');
    expect(generateGRNNumber(' PO-PD-2026-002 ', 0)).toBe('GRN-PO-PD-2026-002-01');

    // 2. Integration with warehouseService.submitGRN
    const testPO = {
      id: 'PO-TEST-002',
      poNo: 'PO-PD-2026-002',
      poNumber: 'PO-PD-2026-002',
      status: 'ISSUED',
      department: 'PD',
      items: [
        {
          productId: 'PROD-PD-002',
          code: 'PD-BOX-002',
          name: 'กล่องลูกฟูกมาตรฐาน',
          orderedQty: 100,
          purchaseQty: 100,
          receivedQty: 0,
          unitPrice: 15,
          unit: 'ใบ',
          stockUnit: 'ใบ'
        }
      ],
      grnHistory: []
    };

    const testProd = {
      id: 'PROD-PD-002',
      code: 'PD-BOX-002',
      name: 'กล่องลูกฟูกมาตรฐาน',
      stockBalance: 0,
      unit: 'ใบ',
      stockUnit: 'ใบ',
      price: 15
    };

    storageService.savePOs([testPO]);
    storageService.saveProducts([testProd]);

    const grnResult = await warehouseService.submitGRN(testPO.id, {
      items: [{ productId: 'PROD-PD-002', acceptedQty: 40, damagedQty: 0 }],
      note: 'รับเข้าคลังรอบที่ 1'
    });

    expect(grnResult.grnNo).toBe('GRN-PO-PD-2026-002-01');
    expect(grnResult.roundNumber).toBe(1);

    // Verify stock log on storage
    const logs = storageService.getStockLogs();
    const round1Log = logs.find(l => l.productId === 'PROD-PD-002');
    expect(round1Log).toBeDefined();
    expect(round1Log.documentNo).toBe('GRN-PO-PD-2026-002-01');
    expect(round1Log.grnNo).toBe('GRN-PO-PD-2026-002-01');
    expect(round1Log.refPo).toBe('PO-PD-2026-002');
  });

  // ── Scenario 2: Round 2 GRN Creation ──
  it('Scenario 2 (Round 2 GRN Creation): Creating Round 2 for PO-PD-2026-002 strictly generates GRN-PO-PD-2026-002-02', async () => {
    // 1. Direct generator test
    const genNoR2 = generateGRNNumber('PO-PD-2026-002', 2);
    expect(genNoR2).toBe('GRN-PO-PD-2026-002-02');
    expect(generateGRNNumber('PO-PD-2026-002', '02')).toBe('GRN-PO-PD-2026-002-02');

    // 2. Integration with existing Round 1 PO
    const testPO = {
      id: 'PO-TEST-002',
      poNo: 'PO-PD-2026-002',
      poNumber: 'PO-PD-2026-002',
      status: 'WAITING_DELIVERY_ROUND_2',
      department: 'PD',
      items: [
        {
          productId: 'PROD-PD-002',
          code: 'PD-BOX-002',
          name: 'กล่องลูกฟูกมาตรฐาน',
          orderedQty: 100,
          purchaseQty: 100,
          receivedQty: 40,
          accumulatedReceived: 40,
          unitPrice: 15,
          unit: 'ใบ',
          stockUnit: 'ใบ'
        }
      ],
      grnHistory: [
        {
          grnNumber: 'GRN-PO-PD-2026-002-01',
          round: 1,
          receivedDate: '2026-09-10 10:00:00'
        }
      ]
    };

    const testProd = {
      id: 'PROD-PD-002',
      code: 'PD-BOX-002',
      name: 'กล่องลูกฟูกมาตรฐาน',
      stockBalance: 40,
      unit: 'ใบ',
      stockUnit: 'ใบ',
      price: 15
    };

    storageService.savePOs([testPO]);
    storageService.saveProducts([testProd]);

    // Submit Round 2 via warehouseService
    const grnResultR2 = await warehouseService.submitGRN(testPO.id, {
      items: [{ productId: 'PROD-PD-002', acceptedQty: 60, damagedQty: 0 }],
      note: 'รับเข้าคลังรอบที่ 2 ครบถ้วน'
    });

    expect(grnResultR2.grnNo).toBe('GRN-PO-PD-2026-002-02');
    expect(grnResultR2.roundNumber).toBe(2);

    // Verify stock log on storage
    const logs = storageService.getStockLogs();
    const round2Log = logs.find(l => l.productId === 'PROD-PD-002' && (l.documentNo === 'GRN-PO-PD-2026-002-02' || l.roundNumber === 2));
    expect(round2Log).toBeDefined();
    expect(round2Log.documentNo).toBe('GRN-PO-PD-2026-002-02');
    expect(round2Log.refPo).toBe('PO-PD-2026-002');
  });

  // ── Scenario 3: Legacy Record Healing ──
  it('Scenario 3 (Legacy Record Healing): Legacy row previously displayed as PO-PD-2026-001 is automatically normalized to GRN-PO-PD-2026-001-01', () => {
    // 1. Pure normalizeDocNumber helper verification
    const legacyRecord1 = { docNo: 'PO-PD-2026-001', roundNumber: 1 };
    expect(normalizeDocNumber(legacyRecord1)).toBe('GRN-PO-PD-2026-001-01');

    const legacyRecordDefaultRound = { docNo: 'PO-PD-2026-001' };
    expect(normalizeDocNumber(legacyRecordDefaultRound)).toBe('GRN-PO-PD-2026-001-01');

    const legacyRecordRound2 = { docNo: 'PO-PD-2026-001', roundNumber: 2 };
    expect(normalizeDocNumber(legacyRecordRound2)).toBe('GRN-PO-PD-2026-001-02');

    // Direct string normalization
    expect(normalizeDocNumber('PO-PD-2026-001')).toBe('GRN-PO-PD-2026-001-01');
    // Already formatted GRN numbers should pass through unchanged
    expect(normalizeDocNumber('GRN-PO-PD-2026-001-02')).toBe('GRN-PO-PD-2026-001-02');

    // 2. Storage Self-Healing Verification
    const unhealedRawLog = {
      id: 'LOG-LEGACY-001',
      date: '2026-09-01 10:00:00',
      productId: 'PROD-PD-LEGACY',
      productCode: 'PD-LEGACY',
      name: 'สินค้าตัวอย่างเดิม',
      type: 'IN',
      docNo: 'PO-PD-2026-001', // Legacy raw PO number without GRN prefix
      qty: 10,
      balance: 10
    };

    storageService.saveStockLogs([unhealedRawLog]);
    const healedLogs = storageService.getStockLogs();
    const healedLog = healedLogs.find(l => l.id === 'LOG-LEGACY-001');

    expect(healedLog).toBeDefined();
    expect(healedLog.documentNo).toBe('GRN-PO-PD-2026-001-01');
    expect(healedLog.grnNo).toBe('GRN-PO-PD-2026-001-01');
    expect(healedLog.refPo).toBe('PO-PD-2026-001');

    // 3. UI Table Cell Rendering Verification
    const product = {
      id: 'PROD-PD-LEGACY',
      code: 'PD-LEGACY',
      name: 'สินค้าตัวอย่างเดิม',
      stockBalance: 10,
      unit: 'ชิ้น'
    };

    const html = renderToStaticMarkup(
      <StockMovementTable
        product={product}
        stockLogs={[unhealedRawLog]}
        pos={[{ poNo: 'PO-PD-2026-001', id: 'PO-1' }]}
        onClose={() => {}}
      />
    );

    // Primary Document Badge: Monospace bold GRN number
    expect(html).toContain('GRN-PO-PD-2026-001-01');
    // Secondary Reference Subtext: Parent PO reference
    expect(html).toContain('อ้างอิง: PO-PD-2026-001');
  });

  // ── Scenario 4: Table Search & Filter ──
  it('Scenario 4 (Table Search & Filter): Searching for either PO-PD-2026-001 or GRN-PO-PD-2026-001-01 returns both Round 1 and Round 2 records', () => {
    const product = {
      id: 'PROD-PD-MULTI',
      code: 'PD-MULTI',
      name: 'สินค้าทดสอบรับหลายรอบ',
      stockBalance: 100,
      unit: 'กล่อง'
    };

    const multiRoundLogs = [
      {
        id: 'LOG-R2',
        date: '2026-09-12 14:00:00',
        productId: 'PROD-PD-MULTI',
        productCode: 'PD-MULTI',
        type: 'IN',
        documentNo: 'GRN-PO-PD-2026-001-02',
        docNo: 'GRN-PO-PD-2026-001-02',
        poNo: 'PO-PD-2026-001',
        poNumber: 'PO-PD-2026-001',
        refPo: 'PO-PD-2026-001',
        qty: 60,
        balance: 100
      },
      {
        id: 'LOG-R1',
        date: '2026-09-10 10:00:00',
        productId: 'PROD-PD-MULTI',
        productCode: 'PD-MULTI',
        type: 'IN',
        documentNo: 'GRN-PO-PD-2026-001-01',
        docNo: 'GRN-PO-PD-2026-001-01',
        poNo: 'PO-PD-2026-001',
        poNumber: 'PO-PD-2026-001',
        refPo: 'PO-PD-2026-001',
        qty: 40,
        balance: 40
      }
    ];

    storageService.saveStockLogs(multiRoundLogs);

    // 1. Render Table with initial state (contains both rounds)
    const tableHtml = renderToStaticMarkup(
      <StockMovementTable
        product={product}
        stockLogs={multiRoundLogs}
        pos={[{ poNo: 'PO-PD-2026-001', id: 'PO-1' }]}
        onClose={() => {}}
      />
    );

    expect(tableHtml).toContain('GRN-PO-PD-2026-001-01');
    expect(tableHtml).toContain('GRN-PO-PD-2026-001-02');
    expect(tableHtml).toContain('อ้างอิง: PO-PD-2026-001');

    // 2. Filter matching logic verification for PO search: "PO-PD-2026-001"
    const searchPo = 'PO-PD-2026-001';
    const matchesPo = multiRoundLogs.filter(log => {
      const q = searchPo.trim().toLowerCase();
      const normDoc = normalizeDocNumber(log).toLowerCase();
      const rawDoc = String(log.documentNo || log.docNo || '').toLowerCase();
      const parentPo = String(log.refPo || log.poNumber || log.poNo || '').toLowerCase();
      let qPoStem = q;
      if (q.startsWith('grn-')) {
        const match = q.match(/grn-(po-[a-z0-9-]+?)(?:-\d{2})?$/i);
        if (match) qPoStem = match[1].toLowerCase();
      }
      return normDoc.includes(q) || rawDoc.includes(q) || parentPo.includes(q) || parentPo.includes(qPoStem) || normDoc.includes(qPoStem);
    });

    expect(matchesPo.length).toBe(2);
    expect(matchesPo.map(m => m.documentNo)).toEqual(expect.arrayContaining([
      'GRN-PO-PD-2026-001-01',
      'GRN-PO-PD-2026-001-02'
    ]));

    // 3. Filter matching logic verification for GRN search: "GRN-PO-PD-2026-001-01"
    const searchGrn = 'GRN-PO-PD-2026-001-01';
    const matchesGrn = multiRoundLogs.filter(log => {
      const q = searchGrn.trim().toLowerCase();
      const normDoc = normalizeDocNumber(log).toLowerCase();
      const rawDoc = String(log.documentNo || log.docNo || '').toLowerCase();
      const parentPo = String(log.refPo || log.poNumber || log.poNo || '').toLowerCase();
      let qPoStem = q;
      if (q.startsWith('grn-')) {
        const match = q.match(/grn-(po-[a-z0-9-]+?)(?:-\d{2})?$/i);
        if (match) qPoStem = match[1].toLowerCase();
      }
      return normDoc.includes(q) || rawDoc.includes(q) || parentPo.includes(q) || parentPo.includes(qPoStem) || normDoc.includes(qPoStem);
    });

    expect(matchesGrn.length).toBe(2);
    expect(matchesGrn.map(m => m.documentNo)).toEqual(expect.arrayContaining([
      'GRN-PO-PD-2026-001-01',
      'GRN-PO-PD-2026-001-02'
    ]));
  });
});
