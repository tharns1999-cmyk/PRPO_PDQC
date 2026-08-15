/**
 * Unit Conversion & Formatting Utility
 * Handles 2-way conversion between Purchase Units (หน่วยซื้อ) and Stock Units (หน่วยเบิก/คลัง)
 */

/**
 * Convert purchase quantity to stock quantity
 * @param {number} purchaseQty - Quantity in purchase units
 * @param {number|object} rateOrProduct - Conversion rate or product object
 * @returns {number} Quantity in stock units
 */
export function toStockQty(purchaseQty, rateOrProduct = 1) {
  const rate = typeof rateOrProduct === 'object' && rateOrProduct !== null
    ? Number(rateOrProduct.conversionRate || 1)
    : Number(rateOrProduct || 1);
  const qty = Number(purchaseQty) || 0;
  const validRate = rate > 0 ? rate : 1;
  return Math.round(qty * validRate * 1000) / 1000;
}

/**
 * Convert stock quantity to purchase quantity
 * @param {number} stockQty - Quantity in stock units
 * @param {number|object} rateOrProduct - Conversion rate or product object
 * @returns {number} Quantity in purchase units
 */
export function toPurchaseQty(stockQty, rateOrProduct = 1) {
  const rate = typeof rateOrProduct === 'object' && rateOrProduct !== null
    ? Number(rateOrProduct.conversionRate || 1)
    : Number(rateOrProduct || 1);
  const qty = Number(stockQty) || 0;
  const validRate = rate > 0 ? rate : 1;
  return Math.round((qty / validRate) * 100) / 100;
}

/**
 * Format dual unit display for stock inventory
 * e.g. "2,400 ลิตร (≈ 12 ถัง)" or "25 ชิ้น" (if 1:1)
 * @param {number} stockQty - Current stock balance in stock units
 * @param {object} product - Product object
 * @returns {string} Formatted string
 */
export function formatDualStock(stockQty, product) {
  if (!product) return `${stockQty}`;
  const sUnit = product.stockUnit || product.unit || 'ชิ้น';
  const pUnit = product.purchaseUnit || product.unit || sUnit;
  const rate = Number(product.conversionRate) > 0 ? Number(product.conversionRate) : 1;
  
  const formattedStock = Number(stockQty || 0).toLocaleString();
  
  if (rate > 1 && pUnit !== sUnit) {
    const purchaseEquiv = toPurchaseQty(stockQty, rate);
    const purchaseStr = purchaseEquiv % 1 === 0 
      ? purchaseEquiv.toLocaleString() 
      : purchaseEquiv.toFixed(1).replace(/\.0$/, '');
    return `${formattedStock} ${sUnit} (≈ ${purchaseStr} ${pUnit})`;
  }
  
  return `${formattedStock} ${sUnit}`;
}

/**
 * Format conversion hint text for PR/PO creation
 * e.g. "= 60 ลิตร เข้าคลัง"
 * @param {number} purchaseQty - Quantity in purchase units
 * @param {object} product - Product object
 * @returns {string|null} Conversion hint or null if 1:1
 */
export function getPurchaseConversionHint(purchaseQty, product) {
  if (!product) return null;
  const rate = Number(product.conversionRate) > 0 ? Number(product.conversionRate) : 1;
  const sUnit = product.stockUnit || product.unit || 'ชิ้น';
  const pUnit = product.purchaseUnit || product.unit || sUnit;

  if (rate > 1 || (pUnit && sUnit && pUnit !== sUnit)) {
    const sQty = toStockQty(purchaseQty, rate);
    return `= ${sQty.toLocaleString()} ${sUnit} เข้าคลัง`;
  }
  return null;
}

/**
 * Normalize product unit fields with safe defaults
 * @param {object} product - Raw product object
 * @returns {object} Normalized product object
 */
export function normalizeProductUnits(product) {
  if (!product) return product;
  const rawUnit = product.unit || 'ชิ้น';
  const sUnit = product.stockUnit || rawUnit;
  const pUnit = product.purchaseUnit || rawUnit;
  const rate = Number(product.conversionRate) > 0 ? Number(product.conversionRate) : 1;

  return {
    ...product,
    purchaseUnit: pUnit,
    stockUnit: sUnit,
    unit: sUnit, // Default primary unit for backward compatibility
    conversionRate: rate
  };
}
