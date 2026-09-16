import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import './setup.js';

import PrintablePO from '../src/components/po/PrintablePO';
import POSettlementModal from '../src/components/po/POSettlementModal';
import PODetailsModal from '../src/components/po/PODetailsModal';
import POListView from '../src/views/POListView';
import { storageService } from '../src/services/storageService';
import { workflowEngine } from '../src/services/workflowEngine';
import { apiService } from '../src/services/apiService';
import { MemoryRouter } from 'react-router-dom';

// Mock child modals and portal for SSR rendering
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (node) => node
  };
});

describe('Domain Suite: Online PO Settlement & Cost Reconciliation', () => {
  const mockUser = {
    id: 'U-PURCHASER-01',
    name: 'คุณนัท จัดซื้อออนไลน์',
    employeeName: 'คุณนัท จัดซื้อออนไลน์',
    roleId: 'ONLINE_PURCHASER',
    role: 'purchaser',
    title: 'เจ้าหน้าที่จัดซื้อออนไลน์',
    department: 'PD'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    storageService.resetData();

    // Seed initial budget for PD
    storageService.saveBudgets({
      PD: {
        monthlyBudget: 100000,
        spent: 25000,
        actualExpense: 25000,
        variance: 75000,
        remainingBudget: 75000,
        history: { '2026-09': 100000 },
        refundCredits: {}
      }
    });

    // Seed initial products
    storageService.saveProducts([
      {
        id: 'PROD-ONLINE-01',
        code: 'PD-ELEC-001',
        name: 'สายไฟอุตสาหกรรม VCT 3x2.5',
        category: 'PD',
        price: 1000,
        unitPrice: 1000,
        unit: 'ม้วน',
        stockBalance: 10,
        location: 'A-01'
      }
    ]);
  });

  // ══════════════════════════════════════════════════════════════════
  // 1. Settlement Engine & Budget Refund
  // ══════════════════════════════════════════════════════════════════
  describe('1. Settlement Engine, Savings Calculation & Budget Refund', () => {
    it('settles an Online PO with actual transfer amount lower than approved, refunds budget, and records audit trail', async () => {
      const initialPO = {
        id: 'PO-ONLINE-SETTLE-01',
        poNo: 'PO-PD-2026-0099',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        status: 'ORDERED_PENDING_DELIVERY',
        subtotal: 10000,
        grandTotal: 10000,
        totalAmount: 10000,
        issueDate: '2026-09-15',
        items: [
          {
            id: 'ITEM-1',
            productId: 'PROD-ONLINE-01',
            code: 'PD-ELEC-001',
            name: 'สายไฟอุตสาหกรรม VCT 3x2.5',
            qty: 10,
            price: 1000,
            unitPrice: 1000,
            total: 10000
          }
        ]
      };
      storageService.savePOs([initialPO]);

      // Settle with actual transfer amount ฿8,500 (Savings ฿1,500)
      const settlementData = {
        actualTotalAmount: 8500,
        settlementNote: 'ได้โค้ดส่วนลดจาก Shopee Mall 1,500 บาท',
        settlementProofUrl: 'https://drive.google.com/file/d/sample-slip-123/view'
      };

      const settledPO = await apiService.settlePO(initialPO.id, settlementData, mockUser);

      // Verify PO settlement fields
      expect(settledPO.actualTotalAmount).toBe(8500);
      expect(settledPO.savingsAmount).toBe(1500);
      expect(settledPO.settlementStatus).toBe('SETTLED');
      expect(settledPO.settlementNote).toBe('ได้โค้ดส่วนลดจาก Shopee Mall 1,500 บาท');
      expect(settledPO.settledBy).toBe('คุณนัท จัดซื้อออนไลน์');
      expect(settledPO.settledAt).toBeDefined();

      // Verify line items actual price adjustment (costRatio = 8500/10000 = 0.85 -> 850)
      expect(settledPO.items[0].actualUnitPrice).toBe(850);
      expect(settledPO.items[0].actualPrice).toBe(850);

      // Verify Department Budget Refund
      const budgets = storageService.getBudgets();
      expect(budgets.PD.spent).toBe(23500); // 25000 - 1500
      expect(budgets.PD.actualExpense).toBe(23500);
      expect(budgets.PD.remainingBudget).toBe(76500); // 100000 - 23500

      // Verify Budget Transaction appended
      const transactions = storageService.getBudgetTransactions();
      const refundTx = transactions.find(tx => tx.type === 'BUDGET_ROLLBACK' && tx.refDocNo === settledPO.poNo);
      expect(refundTx).toBeDefined();
      expect(refundTx.amount).toBe(1500);
      expect(refundTx.note).toContain('คืนงบประมาณจากการปิดยอดจ่ายจริง');

      // Verify Audit Log entry
      const log = settledPO.activityLog.find(l => l.action === 'PO_SETTLED');
      expect(log).toBeDefined();
      expect(log.note).toContain('ยอดจ่ายจริง ฿8,500');
      expect(log.note).toContain('ประหยัดงบ ฿1,500');
    });

    it('handles explicit actualItems override when specific items have different discount allocations', async () => {
      const multiItemPO = {
        id: 'PO-MULTI-01',
        poNo: 'PO-PD-2026-0100',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        status: 'ORDERED_PENDING_DELIVERY',
        subtotal: 5000,
        grandTotal: 5000,
        issueDate: '2026-09-15',
        items: [
          { id: 'I-1', code: 'C-1', name: 'สินค้า 1', qty: 2, price: 1000, unitPrice: 1000 },
          { id: 'I-2', code: 'C-2', name: 'สินค้า 2', qty: 3, price: 1000, unitPrice: 1000 }
        ]
      };
      storageService.savePOs([multiItemPO]);

      const explicitActualItems = [
        { id: 'I-1', actualUnitPrice: 800 }, // Item 1 got bigger discount
        { id: 'I-2', actualUnitPrice: 900 }
      ];

      const settled = await workflowEngine.settlePO(multiItemPO.id, {
        actualTotalAmount: 4300,
        actualItems: explicitActualItems
      }, mockUser);

      expect(settled.items[0].actualUnitPrice).toBe(800);
      expect(settled.items[1].actualUnitPrice).toBe(900);
      expect(settled.savingsAmount).toBe(700);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 2. Inventory Valuation & Receiving Integration
  // ══════════════════════════════════════════════════════════════════
  describe('2. Inventory Valuation & Stock Movement Costing', () => {
    it('uses actualUnitPrice in StockLogs when goods are received for a settled PO', async () => {
      const settledPO = {
        id: 'PO-STOCK-VALUATION',
        poNo: 'PO-PD-2026-0101',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        status: 'ORDERED_PENDING_DELIVERY',
        grandTotal: 10000,
        actualTotalAmount: 8000,
        savingsAmount: 2000,
        settlementStatus: 'SETTLED',
        items: [
          {
            id: 'LINE-1',
            productId: 'PROD-ONLINE-01',
            code: 'PD-ELEC-001',
            name: 'สายไฟอุตสาหกรรม VCT 3x2.5',
            qty: 10,
            price: 1000,
            actualUnitPrice: 800,
            actualPrice: 800,
            unitPrice: 800
          }
        ]
      };
      storageService.savePOs([settledPO]);

      // Receive goods via workflowEngine.receiveGoods
      const receivePayload = [
        {
          productId: 'PROD-ONLINE-01',
          receivedThisTime: 10
        }
      ];

      await workflowEngine.receiveGoods(settledPO.id, receivePayload, {
        name: 'คุณสมชาย ตรวจรับ',
        employeeName: 'คุณสมชาย ตรวจรับ',
        title: 'เจ้าหน้าที่ตรวจรับ'
      }, 'ตรวจรับเข้าคลังตามยอดปิดจริง');

      // Verify stock movements logged with actualUnitPrice (800) rather than original (1000)
      const stockLogs = storageService.getStockLogs() || [];
      const inLog = stockLogs.find(l => l.productId === 'PROD-ONLINE-01' && l.type === 'IN');
      expect(inLog).toBeDefined();
      expect(inLog.unitPrice).toBe(800);
      expect(inLog.actualPrice).toBe(800);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 3. Dual-Engine PO Printing (DOM & PDF)
  // ══════════════════════════════════════════════════════════════════
  describe('3. Dual-Engine PO Printing (PrintablePO & generatePoPdf)', () => {
    it('PrintablePO (DOM): keeps approved items table intact, renders settlement summary box, and Column 4 confirmation note', () => {
      const poWithSettlement = {
        id: 'PO-PRINT-01',
        poNo: 'PO-PD-2026-0500',
        department: 'PD',
        vendorName: 'Shopee Official Store',
        purchaseChannel: 'ONLINE',
        status: 'RECEIVED',
        subtotal: 10000,
        grandTotal: 10000,
        actualTotalAmount: 8500,
        savingsAmount: 1500,
        settlementStatus: 'SETTLED',
        settlementNote: 'ส่วนลดแคมเปญ 9.9',
        receiverName: 'คุณสมศักดิ์ สุขใจ',
        items: [
          {
            id: 'P-1',
            code: 'PD-RAW-001',
            name: 'วัตถุดิบเคมี A',
            qty: 10,
            unit: 'กิโลกรัม',
            price: 1000,
            actualPrice: 850,
            actualUnitPrice: 850
          }
        ]
      };

      const html = renderToStaticMarkup(<PrintablePO po={poWithSettlement} />);

      // 1. Items table keeps approved contractual price (1,000.00)
      expect(html).toContain('1,000.00');

      // 2. Renders Settlement Summary Box
      expect(html).toContain('สรุปการตรวจรับและปิดยอดจ่ายจริง (Actual Settlement Summary)');
      expect(html).toContain('8,500.00');
      expect(html).toContain('1,500.00');
      expect(html).toContain('คืนงบประมาณแล้ว');
      expect(html).toContain('ส่วนลดแคมเปญ 9.9');

      // 3. Renders Confirmation Note under Column 4
      expect(html).toContain('* ยืนยันยอดตรวจรับและจ่ายจริง ฿8,500.00');
    });

    it('PrintablePO (DOM): does NOT render settlement box for standard unsettled POs', () => {
      const standardPO = {
        id: 'PO-STANDARD-01',
        poNo: 'PO-PD-2026-0501',
        department: 'PD',
        vendorName: 'บริษัท ทั่วไป จำกัด',
        purchaseChannel: 'SELF',
        status: 'ISSUED',
        subtotal: 5000,
        grandTotal: 5000,
        items: [
          { id: 'P-1', code: 'PD-ITEM-1', name: 'สินค้าทั่วไป', qty: 5, unit: 'ชิ้น', price: 1000 }
        ]
      };

      const html = renderToStaticMarkup(<PrintablePO po={standardPO} />);
      expect(html).not.toContain('Actual Settlement Summary');
      expect(html).not.toContain('* ยืนยันยอดตรวจรับและจ่ายจริง');
    });

    it('generatePoPdf (PDF Engine): contains dynamic boundary calculation, page break at financialBottomY < 234, settlement box, and Column 4 confirmation note', () => {
      const pdfFilePath = path.resolve(process.cwd(), 'src/utils/generatePoPdf.js');
      const content = fs.readFileSync(pdfFilePath, 'utf-8');

      // Dynamic Y coordinate & Page Break Guard
      expect(content).toContain('const financialBottomY = rowY - 55;');
      expect(content).toContain('if (financialBottomY < 234)');
      expect(content).toContain('activePage = pdfDoc.addPage([595.28, 841.89]);');

      // Settlement Summary Box Header & Text
      expect(content).toContain("normalizeThaiText('สรุปการตรวจรับและปิดยอดจ่ายจริง (Actual Settlement Summary)')");
      expect(content).toContain("normalizeThaiText('ยอดอนุมัติเดิม (Approved Total):')");
      expect(content).toContain("normalizeThaiText('ยอดจ่ายจริง (Actual Payment):')");
      expect(content).toContain("normalizeThaiText('ส่วนต่างงบ (Savings / Variance):')");
      expect(content).toContain("normalizeThaiText('[ คืนงบประมาณแล้ว ]')");

      // Column 4 Confirmation Note
      expect(content).toContain('* ยืนยันยอดตรวจรับและจ่ายจริง ฿');
      expect(content).toContain('activePage.drawText(confirmNote');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 4. UI Components & Modal Interaction
  // ══════════════════════════════════════════════════════════════════
  describe('4. UI Modals & Views Integration', () => {
    it('POSettlementModal: renders approved total, actual input, savings computation, and valuation table', () => {
      const mockPO = {
        id: 'PO-MODAL-TEST',
        poNo: 'PO-PD-2026-0777',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        grandTotal: 10000,
        subtotal: 10000,
        items: [
          { id: '1', code: 'C-01', name: 'หลอดไฟ LED', qty: 10, unit: 'หลอด', price: 1000 }
        ]
      };

      const html = renderToStaticMarkup(
        <POSettlementModal
          po={mockPO}
          currentUser={mockUser}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(html).toContain('บันทึกยอดซื้อจริง &amp; ปิดยอด (Online Settlement)');
      expect(html).toContain('10,000.00');
      expect(html).toContain('การกระจายต้นทุนเข้าพัสดุ (Inventory Valuation)');
      expect(html).toContain('ยืนยันปิดยอดจ่ายจริง');
    });

    it('PODetailsModal: renders settlement action button and breakdown when settled', () => {
      const settledPO = {
        id: 'PO-DETAIL-TEST',
        poNo: 'PO-PD-2026-0888',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        status: 'ORDERED_PENDING_DELIVERY',
        grandTotal: 5000,
        actualTotalAmount: 4200,
        savingsAmount: 800,
        settlementStatus: 'SETTLED',
        settlementNote: 'ส่วนลดร้านค้า',
        items: [{ id: '1', name: 'สินค้า A', qty: 2, price: 2500 }]
      };

      const html = renderToStaticMarkup(
        <PODetailsModal
          selectedPO={settledPO}
          currentRole={mockUser}
          onClose={vi.fn()}
        />
      );

      // Action button should show "แก้ไขยอดจ่ายจริง" because it is settled
      expect(html).toContain('แก้ไขยอดจ่ายจริง');
      // Financial breakdown should show settled details
      expect(html).toContain('สรุปการปิดยอดจ่ายจริง (Settlement):');
      expect(html).toContain('+คืนงบ ฿800.00');
    });

    it('POListView: renders actual settlement amount and savings badge', () => {
      const settledPO = {
        id: 'PO-LIST-TEST',
        poNo: 'PO-PD-2026-0999',
        department: 'PD',
        purchaseChannel: 'ONLINE',
        status: 'RECEIVED',
        grandTotal: 5000,
        actualTotalAmount: 4200,
        savingsAmount: 800,
        settlementStatus: 'SETTLED',
        issueDate: new Date().toISOString(),
        items: [{ id: '1', name: 'สินค้าทดสอบ', qty: 1, price: 5000 }]
      };
      storageService.savePOs([settledPO]);

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <POListView
            pos={[settledPO]}
            currentRole={{ id: 'ADMIN', roleId: 'ADMIN', canViewAllDepts: true }}
          />
        </MemoryRouter>
      );

      expect(html).toContain('4,200.00');
      expect(html).toContain('ประหยัด ฿800');
    });
  });
});
