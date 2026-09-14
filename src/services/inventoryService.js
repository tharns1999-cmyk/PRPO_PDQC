export { default } from './warehouseService';
export * from './warehouseService';

/**
 * Inventory valuation calculation helper for Stock Movement Log
 * Ensures Dual-UOM base unit cost conversion is properly computed.
 */
export function calculateStockMovementValue(movement, product = {}) {
  const conversionRate = Number(product.conversionRate || product.conversionRatio || movement.conversionRate) || 1;
  const unitCostInStock = Number(movement.baseUnitCost ?? movement.stockUnitPrice ?? (movement.unitPrice || product.price || 0)) / (movement.baseUnitCost ? 1 : conversionRate);
  const totalAmount = movement.totalAmount !== undefined && movement.totalAmount !== null
    ? Number(movement.totalAmount)
    : (movement.totalPrice !== undefined && movement.totalPrice !== null && !movement.unitPrice
      ? Number(movement.totalPrice)
      : (Number(movement.quantity ?? movement.qty ?? 0) * unitCostInStock));

  return {
    conversionRate,
    unitCostInStock,
    totalAmount
  };
}
