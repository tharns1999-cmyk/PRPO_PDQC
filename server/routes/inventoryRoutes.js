import { Router } from 'express';
import { readFile, writeFile, initialBudgets } from '../storage.js';

const router = Router();

/**
 * Inventory, Goods Receipt (GRN) & Stock Movement Subsystem
 * Routes mounted at /api/inventory and /api
 */

// ── 1. Goods Receipt (GRN) Atomic Transaction Endpoint ──
router.post(['/pos/:id/receive', '/receive-goods', '/receive', '/grn'], async (req, res) => {
  try {
    const poId = req.params.id || req.body.poId;
    const { receivingItems = [], user = {}, note = '', options = {}, grNumber: bodyGrNo } = req.body;
    const timestamp = new Date().toLocaleString('th-TH');

    const [pos, products, stockLogs, budgets] = await Promise.all([
      readFile('pos.json', []),
      readFile('products.json', []),
      readFile('stockLogs.json', []),
      readFile('budgets.json', initialBudgets)
    ]);

    const poIndex = pos.findIndex(p => p.id === poId || p.poNo === poId);
    if (poIndex === -1) {
      return res.status(404).json({ error: `ไม่พบเอกสารใบสั่งซื้อ PO ID: ${poId}` });
    }

    const po = pos[poIndex];
    const roundNumber = options?.round || options?.roundNumber || (po.grnHistory?.length || 0) + 1;
    const cleanPoNo = (po.poNo || po.id || '').trim();
    const safeRound = String(Math.max(1, Number(roundNumber) || 1)).padStart(2, '0');
    const grNumber = bodyGrNo || options?.grNumber || options?.grId || (cleanPoNo ? `GRN-${cleanPoNo}-${safeRound}` : `GRN-${Date.now()}-01`);

    // 1. PO Status Validity Check
    if (['CLOSED', 'CANCELLED', 'RECEIVED'].includes(po.status)) {
      return res.status(400).json({ error: `ไม่สามารถตรวจรับได้เนื่องจาก PO ${po.poNo || po.id} อยู่ในสถานะ "${po.status}" เรียบร้อยแล้ว` });
    }

    // 2. Idempotency Check on grNumber
    const existingLogsForGr = stockLogs.filter(l => l.grNumber && l.grNumber === grNumber);
    if (existingLogsForGr.length > 0) {
      return res.json({
        success: true,
        message: 'Idempotent replay: รายการตรวจรับนี้ถูกบันทึกเข้าระบบแล้ว',
        po,
        products,
        stockLogs,
        budgets
      });
    }

    // 3. Form Boundary & Quantity Boundary Validation
    const receiveMap = {};
    for (const r of receivingItems) {
      receiveMap[r.productId] = Number(r.receivedThisTime) || 0;
    }

    for (const item of (po.items || [])) {
      const ordered = Number(item.orderedQty ?? item.purchaseQty ?? item.qty) || 0;
      const already = Number(item.receivedQty) || 0;
      const incoming = receiveMap[item.productId] ?? 0;

      if (incoming < 0) {
        return res.status(400).json({ error: `จำนวนรับสำหรับรายการ "${item.name}" ต้องไม่ติดลบ` });
      }
      if (already + incoming > ordered) {
        return res.status(400).json({
          error: `จำนวนตรวจรับรายการ "${item.name}" เกินยอดสั่งซื้อ: รับไปแล้ว ${already} + จะรับเพิ่ม ${incoming} = ${already + incoming} (สั่งซื้อ ${ordered})`
        });
      }
    }

    // 4. Atomic Transaction Processing
    let allFullyReceived = true;
    let hasAnyClaim = false;
    const problematicItems = options?.problematicItems || {};
    const receivingLocations = options?.receivingLocations || {};
    const grAttachments = options?.grAttachments || [];
    const receivedSummaryParts = [];
    const problematicSummaryParts = [];
    const claimItemList = [];

    const REASON_LABELS = {
      'SHORT_SHIPMENT': 'ได้รับสินค้าไม่ครบ (ขาดส่ง)',
      'DAMAGED': 'สินค้าชำรุด / เสียหาย',
      'WRONG_SPEC': 'สินค้าไม่ตรงสเปก / ส่งผิดรุ่น',
      'OTHER': 'อื่นๆ (ตามรายละเอียด)'
    };

    po.items.forEach(poItem => {
      const pQty = Number(poItem.orderedQty ?? poItem.purchaseQty ?? poItem.qty) || 0;
      const alreadyReceived = Number(poItem.receivedQty) || 0;
      const incomingQty = receiveMap[poItem.productId] ?? 0;
      const thisReceive = Math.min(incomingQty, Math.max(0, pQty - alreadyReceived));

      if (receivingLocations[poItem.productId]) {
        poItem.receivingLocation = receivingLocations[poItem.productId];
      }

      const probInfo = problematicItems[poItem.productId];
      const isProb = Boolean(probInfo?.isProblematic);
      const claimedQty = isProb ? (Number(probInfo?.claimedQty) > 0 ? Number(probInfo.claimedQty) : (thisReceive > 0 ? thisReceive : Math.max(1, pQty - (alreadyReceived + thisReceive)))) : 0;
      const rawReason = probInfo?.reason || 'DAMAGED';
      const reasonLabel = REASON_LABELS[rawReason] || rawReason;
      const defectNote = (probInfo?.description || probInfo?.defectReason || '').trim();

      const rate = Number(poItem.conversionRate) > 0 ? Number(poItem.conversionRate) : 1;
      const tId = String(poItem.productId || poItem.id || '').trim().toLowerCase();
      const tCode = String(poItem.code || poItem.productCode || '').trim().toLowerCase();
      const tName = String(poItem.name || '').trim().toLowerCase();

      const prodIndex = products.findIndex(p => {
        if (!p) return false;
        const pId = String(p.id || '').trim().toLowerCase();
        const pCode = String(p.code || '').trim().toLowerCase();
        const pName = String(p.name || '').trim().toLowerCase();
        return (
          (tId && (pId === tId || pCode === tId)) ||
          (tCode && (pCode === tCode || pId === tCode)) ||
          (tName && pName === tName)
        );
      });
      const prod = prodIndex !== -1 ? products[prodIndex] : null;
      const sUnit = prod?.stockUnit || prod?.unit || poItem.stockUnit || poItem.unit || 'ชิ้น';
      const pUnit = prod?.purchaseUnit || prod?.unit || poItem.purchaseUnit || sUnit;
      const itemUnitPrice = Number(poItem.actUnitPrice ?? poItem.actualPrice ?? poItem.price ?? prod?.price) || 0;
      const stockUnitPrice = itemUnitPrice > 0 && rate > 0 ? (itemUnitPrice / rate) : (Number(prod?.price) || 0);

      // 4.1 Update stock and write stockLogs only for actual accepted quantity
      if (thisReceive > 0) {
        const stockReceive = thisReceive * rate;
        poItem.receivedQty = alreadyReceived + thisReceive;
        poItem.receivedStockQty = (Number(poItem.receivedStockQty) || 0) + stockReceive;
        poItem.orderedQty = pQty;
        poItem.remainingQty = Math.max(0, pQty - poItem.receivedQty);

        if (prod) {
          const currentBal = Number(prod.stockBalance) || 0;
          if (!isProb) {
            const newBal = currentBal + stockReceive;
            prod.stockBalance = newBal;

            const logNote = rate > 1
              ? `รับสินค้า ${thisReceive} ${pUnit} (= ${stockReceive} ${sUnit}) จาก PO ${po.poNo}`
              : `รับสินค้า ${thisReceive} ${sUnit} จาก PO ${po.poNo}`;

            stockLogs.unshift({
              id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              grNumber,
              documentNo: grNumber,
              docNo: grNumber,
              grnNo: grNumber,
              grnNumber: grNumber,
              date: timestamp,
              isoDate: new Date().toISOString(),
              productId: prod.id,
              productCode: prod.code,
              name: prod.name,
              type: 'IN',
              poNo: po.poNo,
              poNumber: po.poNo,
              refPo: po.poNo,
              roundNumber,
              qty: stockReceive,
              receivedQty: thisReceive,
              unit: sUnit,
              balance: newBal,
              unitPrice: stockUnitPrice,
              totalPrice: stockUnitPrice * stockReceive,
              actualPrice: itemUnitPrice,
              user: `${user.name || 'System'} (${user.title || 'Requester'})`,
              locationId: prod.locationId || '',
              locationName: prod.locationName || '',
              note: note || logNote
            });
          } else {
            stockLogs.unshift({
              id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              grNumber,
              documentNo: grNumber,
              docNo: grNumber,
              grnNo: grNumber,
              grnNumber: grNumber,
              date: timestamp,
              productId: poItem.productId,
              productCode: poItem.code,
              type: 'IN_NG',
              poNo: po.poNo,
              poNumber: po.poNo,
              refPo: po.poNo,
              roundNumber,
              qty: stockReceive,
              unit: sUnit,
              balance: currentBal,
              user: `${user.name || 'System'} (${user.title || 'Requester'})`,
              locationId: prod.locationId || '',
              locationName: prod.locationName || '',
              note: `[สินค้าชำรุด/NG] ${defectNote || reasonLabel}`
            });
          }
        }
        receivedSummaryParts.push(`${poItem.name}: ${thisReceive} ${pUnit}`);
      }

      // 4.2 Process Problematic / Claimed Items
      if (isProb) {
        hasAnyClaim = true;
        allFullyReceived = false;

        const claimedStockQty = claimedQty * rate;
        poItem.hasDefect = true;
        poItem.claimedQty = (Number(poItem.claimedQty) || 0) + claimedQty;
        poItem.receivedNgQty = (Number(poItem.receivedNgQty) || 0) + claimedStockQty;
        poItem.defectReason = defectNote || reasonLabel;
        poItem.defectNote = defectNote || reasonLabel;

        po.ngItems = po.ngItems || [];
        po.ngItems.push({
          productId: poItem.productId,
          productCode: poItem.code,
          name: poItem.name,
          qty: claimedStockQty,
          unit: sUnit,
          defectNote: defectNote || reasonLabel,
          defectReason: defectNote || reasonLabel,
          reason: rawReason,
          date: timestamp
        });

        stockLogs.unshift({
          id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          grNumber,
          date: timestamp,
          productId: poItem.productId,
          productCode: poItem.code,
          type: 'NG',
          docNo: po.poNo,
          qty: claimedStockQty,
          unit: sUnit,
          balance: prod ? prod.stockBalance : 0,
          user: `${user.name || 'System'} (${user.title || 'Requester'})`,
          note: `[สินค้ามีปัญหา/เคลม (${reasonLabel})] ${defectNote || '-'} (PO ${po.poNo})`
        });

        claimItemList.push({
          productId: poItem.productId,
          code: poItem.code,
          name: poItem.name,
          orderedQty: pQty,
          receivedQty: thisReceive,
          claimedQty: claimedQty,
          purchaseUnit: pUnit,
          stockUnit: sUnit,
          reason: rawReason,
          reasonLabel: reasonLabel,
          description: defectNote || reasonLabel,
          photo: probInfo.photo || null
        });

        problematicSummaryParts.push(`${poItem.name}: มีปัญหา ${claimedQty} ${pUnit} (${reasonLabel}${defectNote ? ` - ${defectNote}` : ''})`);
      } else {
        if (poItem.receivedQty < pQty) {
          allFullyReceived = false;
        }
      }
    });

    if (Array.isArray(grAttachments) && grAttachments.length > 0) {
      po.grAttachments = [...(po.grAttachments || []), ...grAttachments];
    }

    // 4.3 Update PO status
    if (hasAnyClaim) {
      po.status = 'CLAIM_REPORTED';
    } else {
      po.status = allFullyReceived ? 'CLOSED' : 'PARTIAL';
    }

    const summaryParts = [];
    if (receivedSummaryParts.length > 0) summaryParts.push(`รับปกติ: ${receivedSummaryParts.join(', ')}`);
    if (problematicSummaryParts.length > 0) summaryParts.push(`ส่งเรื่องเคลม: ${problematicSummaryParts.join(', ')}`);
    const summaryNote = summaryParts.join(' | ') + (note ? ` (หมายเหตุ: ${note})` : '');

    po.activityLog = po.activityLog || [];
    po.activityLog.push({
      action: allFullyReceived ? 'รับสินค้าครบและปิด PO (Goods Received – Closed)' : (hasAnyClaim ? 'ตรวจรับสินค้าพร้อมแจ้งเคลม' : 'รับสินค้าบางส่วน (Partial Receiving)'),
      user: user.name || 'System',
      role: user.title || 'Requester',
      timestamp,
      note: summaryNote,
      grNumber
    });

    // 4.4 Budget Arithmetic on Full Receipt
    if (allFullyReceived && !hasAnyClaim) {
      const dept = po.department || 'PD';
      if (budgets[dept]) {
        const poAmount = Number(po.grandTotal || po.totalAmount || po.subtotal || 0);
        if (poAmount > 0) {
          budgets[dept].pending = Math.max(0, (Number(budgets[dept].pending) || 0) - poAmount);
          budgets[dept].spent = (Number(budgets[dept].spent) || 0) + poAmount;
          budgets[dept].variance = (Number(budgets[dept].monthlyBudget) || 0) - budgets[dept].spent;

          const today = new Date();
          const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          if (!budgets[dept].historicalSpent) budgets[dept].historicalSpent = {};
          budgets[dept].historicalSpent[monthKey] = (Number(budgets[dept].historicalSpent[monthKey]) || 0) + poAmount;
        }
      }
    }

    pos[poIndex] = po;

    // 4.5 Atomic File Persistence
    await Promise.all([
      writeFile('pos.json', pos),
      writeFile('products.json', products),
      writeFile('stockLogs.json', stockLogs),
      writeFile('budgets.json', budgets)
    ]);

    res.json({
      success: true,
      po,
      products,
      stockLogs,
      budgets
    });
  } catch (err) {
    console.error('[Backend] GR Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. Stock Movement Logs ──
router.get(['/stock-logs', '/movements'], async (req, res) => {
  try {
    const logs = await readFile('stockLogs.json', []);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post(['/stock-logs', '/movements'], async (req, res) => {
  try {
    const data = req.body;
    if (Array.isArray(data)) {
      await writeFile('stockLogs.json', data);
      return res.json(data);
    }
    const logs = await readFile('stockLogs.json', []);
    logs.unshift(data);
    await writeFile('stockLogs.json', logs);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 3. Quick Issue (Stock Dispense) ──
router.post('/quick-issue', async (req, res) => {
  try {
    const { productId, qty, unit, department, user, note, usageUnit } = req.body || {};
    if (!productId || !qty) {
      return res.status(400).json({ error: 'Missing productId or quantity' });
    }

    const [products, stockLogs] = await Promise.all([
      readFile('products.json', []),
      readFile('stockLogs.json', [])
    ]);

    const prod = products.find(p => p.id === productId || p.code === productId);
    if (!prod) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const issueQty = Number(qty) || 0;
    const currentBal = Number(prod.stockBalance) || 0;
    const newBal = Math.max(0, currentBal - issueQty);
    prod.stockBalance = newBal;

    const logEntry = {
      id: `LOG-ISSUE-${Date.now()}`,
      date: new Date().toLocaleString('th-TH'),
      isoDate: new Date().toISOString(),
      productId: prod.id,
      productCode: prod.code,
      name: prod.name,
      type: 'OUT',
      qty: issueQty,
      unit: unit || prod.stockUnit || prod.unit || 'ชิ้น',
      balance: newBal,
      user: user || 'Requester',
      department: department || prod.department || 'PD',
      usageUnit: usageUnit || '',
      note: note || 'เบิกใช้วัสดุ/อุปกรณ์ด่วน (Quick Issue)'
    };

    stockLogs.unshift(logEntry);

    await Promise.all([
      writeFile('products.json', products),
      writeFile('stockLogs.json', stockLogs)
    ]);

    res.json({
      success: true,
      product: prod,
      log: logEntry
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
