import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useAppContext } from './AppContext';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { PO_STATUS } from '../config/constants';

const ProcurementContext = createContext(null);

/**
 * Standalone & Context-Shared recordGoodsReceipt implementation
 */
export async function recordGoodsReceipt(poId, grnPayload = {}) {
  const pos = storageService.getPOs() || [];
  const targetIdx = pos.findIndex(p => p.id === poId || p.poNo === poId || p.poNumber === poId);
  if (targetIdx === -1) {
    throw new Error(`ไม่พบเอกสาร PO รหัส ${poId} ในระบบ`);
  }

  const currentPO = { ...pos[targetIdx] };
  const currentItems = Array.isArray(currentPO.items) ? [...currentPO.items] : [];
  const incomingItems = grnPayload.receivingItems || grnPayload.items || [];

  const receiptMap = new Map();
  incomingItems.forEach((inc, idx) => {
    const key = inc.productId || inc.id || inc.code || String(idx);
    receiptMap.set(key, inc);
  });

  let hasAnyShortage = false;
  let hasAnyClaim = false;
  let allReceived = true;

  const roundSummary = [];

  // Update PO line-item contracts: orderedQty, receivedQty, damagedQty, shortageQty
  const updatedItems = currentItems.map((item, idx) => {
    const matchKey = item.productId || item.id || item.code || String(idx);
    const inc = receiptMap.get(matchKey) || receiptMap.get(item.productId) || {};

    const orderedQty = Number(item.orderedQty ?? item.purchaseQty ?? item.qty) || 0;
    const prevReceived = Number(item.receivedQty) || 0;
    const prevDamaged = Number(item.damagedQty ?? item.claimedQty ?? item.ngQty) || 0;

    const thisReceived = Number(inc.receivedThisTime ?? inc.receivedQty ?? inc.qty) || 0;
    const thisDamaged = Number(inc.damagedQty ?? inc.claimedQty ?? inc.ngQty) || 0;

    const newReceived = prevReceived + thisReceived;
    const newDamaged = prevDamaged + thisDamaged;
    const shortageQty = Math.max(0, orderedQty - newReceived);

    if (thisDamaged > 0 || newDamaged > 0) hasAnyClaim = true;
    if (shortageQty > 0) {
      hasAnyShortage = true;
      allReceived = false;
    }

    roundSummary.push({
      productId: item.productId,
      name: item.name,
      code: item.code,
      orderedQty,
      receivedThisRound: thisReceived,
      damagedThisRound: thisDamaged,
      accumulatedReceived: newReceived,
      accumulatedDamaged: newDamaged,
      shortageQty,
      condition: inc.condition || (thisDamaged > 0 ? 'DAMAGED' : shortageQty > 0 ? 'SHORTAGE' : 'GOOD'),
      defectReason: inc.defectReason || inc.note || ''
    });

    return {
      ...item,
      orderedQty,
      receivedQty: newReceived,
      damagedQty: newDamaged,
      shortageQty,
      remainingQty: shortageQty,
      conversionRate: Number(item.conversionRate) > 0 ? Number(item.conversionRate) : 1
    };
  });

  // Determine status based on delivery round results
  let nextStatus = currentPO.status;
  if (grnPayload.statusOverride) {
    nextStatus = grnPayload.statusOverride;
  } else if (hasAnyClaim) {
    nextStatus = 'PARTIALLY_RECEIVED_IN_CLAIM';
  } else if (hasAnyShortage) {
    nextStatus = grnPayload.waitingRound2 ? 'WAITING_DELIVERY_ROUND_2' : 'PARTIAL';
  } else if (allReceived) {
    nextStatus = 'COMPLETED';
  }

  const isCompletedReceipt = allReceived || nextStatus === 'CLOSED' || nextStatus === 'COMPLETED';
  if (isCompletedReceipt && !grnPayload.statusOverride) {
    nextStatus = 'COMPLETED';
  }

  const grnNumber = grnPayload.grnNumber || grnPayload.grNumber || grnPayload.grId || `GRN-${currentPO.poNo || currentPO.id}-${String((currentPO.grnHistory?.length || 0) + 1).padStart(2, '0')}`;
  const timestamp = grnPayload.receivedDate || grnPayload.date || new Date().toLocaleString('th-TH');
  const receivedAtIso = grnPayload.receivingInfo?.receivedAt || new Date().toISOString();

  const receiverName = grnPayload.receivingInfo?.receiverName || 
    (typeof grnPayload.receivedBy === 'string' ? grnPayload.receivedBy.split(' (')[0] : (grnPayload.receivedBy?.name || 'คุณวิชัย สุขใจ'));
  const receiverSig = grnPayload.receivingInfo?.receiverSignature || 
    grnPayload.receiverSignature || 
    storageService.getSignatureByRole?.('REQUESTER_PD')?.signatureUrl || 
    storageService.getSignatures?.()?.['REQUESTER_PD']?.signatureUrl || 
    '/signatures/receiver-default.png';

  const grnEntry = {
    grnNumber,
    round: grnPayload.round || (currentPO.grnHistory?.length || 0) + 1,
    date: timestamp,
    receivedBy: grnPayload.receivedBy || 'Staff',
    items: roundSummary,
    note: grnPayload.note || '',
    attachments: grnPayload.attachments || [],
    statusAfterRound: nextStatus
  };

  const updatedPO = {
    ...currentPO,
    items: updatedItems,
    status: nextStatus,
    grnHistory: [...(currentPO.grnHistory || []), grnEntry],
    ...(isCompletedReceipt ? {
      receivingInfo: {
        receiverName,
        receiverSignature: receiverSig,
        receivedAt: receivedAtIso
      },
      receivedBy: receiverName,
      receiverName,
      receiverSignature: receiverSig,
      receivedAt: receivedAtIso
    } : {}),
    activityLog: [
      ...(currentPO.activityLog || []),
      {
        action: `ตรวจรับสินค้าแยกรอบ (GRN: ${grnNumber})`,
        user: typeof grnPayload.receivedBy === 'string' ? grnPayload.receivedBy : (grnPayload.receivedBy?.name || 'Staff'),
        timestamp,
        note: grnPayload.note || `บันทึกการตรวจรับรอบที่ ${grnEntry.round} สถานะเอกสาร: ${nextStatus}`
      }
    ]
  };

  pos[targetIdx] = updatedPO;
  storageService.savePOs(pos);

  try {
    await apiService.receiveGoods(poId, incomingItems, grnPayload.receivedBy || { name: 'Staff', title: 'Inspector' }, grnPayload.note || '', {
      grNumber: grnNumber,
      grId: grnNumber
    });
  } catch {
    // Graceful offline fallback
  }

  return { success: true, po: updatedPO, grn: grnEntry };
}

export function ProcurementProvider({ children }) {
  let app = null;
  try {
    app = useAppContext();
  } catch {
    app = null;
  }

  const handleRecordGoodsReceipt = useCallback(async (poId, grnPayload) => {
    if (app?.recordGoodsReceipt) {
      return app.recordGoodsReceipt(poId, grnPayload);
    }
    return recordGoodsReceipt(poId, grnPayload);
  }, [app]);

  const value = useMemo(() => ({
    pos: app?.pos || storageService.getPOs() || [],
    setPOs: app?.setPOs || ((pos) => storageService.savePOs(pos)),
    updatePO: app?.updatePO || ((poId, updates) => {
      const pos = storageService.getPOs() || [];
      const idx = pos.findIndex(p => p.id === poId || p.poNo === poId || p.poNumber === poId);
      if (idx !== -1) {
        pos[idx] = { ...pos[idx], ...updates };
        storageService.savePOs(pos);
      }
    }),
    getPOById: (poId) => {
      const list = app?.pos || storageService.getPOs() || [];
      return list.find(p => p.id === poId || p.poNo === poId || p.poNumber === poId) || null;
    },
    recordGoodsReceipt: handleRecordGoodsReceipt,
    PO_STATUS
  }), [app, handleRecordGoodsReceipt]);

  return (
    <ProcurementContext.Provider value={value}>
      {children}
    </ProcurementContext.Provider>
  );
}

const hasHookDispatcher = () => {
  try {
    return Boolean(
      React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?.H ||
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher?.current
    );
  } catch {
    return false;
  }
};

export const useProcurementContext = () => {
  let context = null;
  if (hasHookDispatcher()) {
    try {
      context = useContext(ProcurementContext);
    } catch {
      context = null;
    }
  }

  if (!context) {
    const pos = storageService.getPOs() || [];
    return {
      pos,
      setPOs: (newPos) => storageService.savePOs(newPos),
      updatePO: (poId, updates) => {
        const pList = storageService.getPOs() || [];
        const idx = pList.findIndex(p => p.id === poId || p.poNo === poId || p.poNumber === poId);
        if (idx !== -1) {
          pList[idx] = { ...pList[idx], ...updates };
          storageService.savePOs(pList);
        }
      },
      getPOById: (poId) => (storageService.getPOs() || []).find(p => p.id === poId || p.poNo === poId || p.poNumber === poId) || null,
      recordGoodsReceipt,
      PO_STATUS
    };
  }
  return context;
};

export default ProcurementContext;
