import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useAppContext } from './AppContext';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';

const InventoryContext = createContext(null);

/**
 * Standalone & Context-Shared receiveToStock implementation
 * Increments stockBalance strictly for complete, undamaged goods
 */
export async function receiveToStock(items, options = {}) {
  const incoming = Array.isArray(items) ? items : [items];
  const products = storageService.getProducts() || [];
  const stockLogs = storageService.getStockLogs() || [];
  const timestamp = options.date || new Date().toLocaleString('th-TH');

  const processedItems = [];

  incoming.forEach((item, idx) => {
    const orderedQty = Number(item.orderedQty ?? item.purchaseQty ?? item.qty) || 0;
    const receivedQty = Number(item.receivedThisTime ?? item.receivedQty ?? item.qty) || 0;
    const damagedQty = Number(item.damagedQty ?? item.claimedQty ?? item.ngQty) || 0;

    // Filter only complete / intact units
    const goodQty = Math.max(0, receivedQty - damagedQty);
    if (goodQty <= 0) {
      // Skip updating stockBalance for zero or 100% damaged units
      return;
    }

    const prodIdx = products.findIndex(p => 
      p.id === item.productId || 
      p.code === item.productId || 
      p.code === item.code || 
      (item.name && p.name === item.name)
    );

    if (prodIdx !== -1) {
      const prod = { ...products[prodIdx] };
      const rate = Number(item.conversionRate || prod.conversionRate) > 0 ? Number(item.conversionRate || prod.conversionRate) : 1;
      const stockQtyToAdd = goodQty * rate;
      const currentBal = Number(prod.stockBalance) || 0;
      const newBal = currentBal + stockQtyToAdd;

      prod.stockBalance = newBal;
      products[prodIdx] = prod;

      const sUnit = prod.stockUnit || prod.unit || 'ชิ้น';
      const pUnit = prod.purchaseUnit || prod.unit || sUnit;
      const grNumber = options.grNumber || item.grNumber || options.grnNumber || '';
      const docNo = options.docNo || item.docNo || item.poNo || 'GRN';

      const logNote = rate > 1
        ? `รับสินค้าเข้าคลังเฉพาะยอดสมบูรณ์ ${goodQty} ${pUnit} (= +${stockQtyToAdd} ${sUnit}) จากเอกสาร ${docNo}`
        : `รับสินค้าเข้าคลังเฉพาะยอดสมบูรณ์ +${stockQtyToAdd} ${sUnit} จากเอกสาร ${docNo}`;

      stockLogs.unshift({
        id: `LOG-IN-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        grNumber,
        date: timestamp,
        productId: prod.id,
        productCode: prod.code,
        type: 'IN',
        docNo,
        qty: stockQtyToAdd,
        unit: sUnit,
        balance: newBal,
        user: typeof options.user === 'object' ? `${options.user.name} (${options.user.title || ''})` : (options.user || 'Warehouse Staff'),
        locationId: prod.locationId || '',
        locationName: prod.locationName || '',
        note: options.note || logNote
      });

      processedItems.push({
        productId: prod.id,
        code: prod.code,
        name: prod.name,
        goodQty,
        stockQtyAdded: stockQtyToAdd,
        previousBalance: currentBal,
        newBalance: newBal
      });
    }
  });

  if (processedItems.length > 0) {
    storageService.saveProducts(products);
    storageService.saveStockLogs(stockLogs);

    try {
      await fetch('http://localhost:3001/api/products/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(products)
      });
    } catch {
      // Graceful offline fallback
    }
  }

  return {
    success: true,
    processedCount: processedItems.length,
    processedItems,
    products
  };
}

export function InventoryProvider({ children }) {
  let app = null;
  try {
    app = useAppContext();
  } catch {
    app = null;
  }

  const handleReceiveToStock = useCallback(async (items, options) => {
    if (app?.receiveToStock) {
      return app.receiveToStock(items, options);
    }
    return receiveToStock(items, options);
  }, [app]);

  const value = useMemo(() => ({
    products: app?.products || storageService.getProducts() || [],
    stockLogs: app?.stockLogs || storageService.getStockLogs() || [],
    storageLocations: app?.storageLocations || storageService.getStorageLocations() || [],
    receiveToStock: handleReceiveToStock,
    saveProduct: app?.saveProduct || apiService.saveProduct.bind(apiService),
    deleteProduct: app?.deleteProduct || apiService.deleteProduct.bind(apiService),
    quickIssueStock: app?.quickIssueStock || apiService.quickIssueStock.bind(apiService)
  }), [app, handleReceiveToStock]);

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
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

export const useInventoryContext = () => {
  let context = null;
  if (hasHookDispatcher()) {
    try {
      context = useContext(InventoryContext);
    } catch {
      context = null;
    }
  }

  if (!context) {
    const products = storageService.getProducts() || [];
    const stockLogs = storageService.getStockLogs() || [];
    return {
      products,
      stockLogs,
      receiveToStock,
      saveProduct: apiService.saveProduct.bind(apiService),
      deleteProduct: apiService.deleteProduct.bind(apiService),
      quickIssueStock: apiService.quickIssueStock.bind(apiService)
    };
  }
  return context;
};

export default InventoryContext;
