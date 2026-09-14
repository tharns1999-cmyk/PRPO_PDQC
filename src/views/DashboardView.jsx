import React, { useMemo } from 'react';
import KPICards from '../components/dashboard/KPICards';
import RecentPRsTable from '../components/dashboard/RecentPRsTable';
import RecentPOsTable from '../components/dashboard/RecentPOsTable';
import LowStockAlertCard from '../components/dashboard/LowStockAlertCard';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';

export default function DashboardView({
  prs = [],
  pos = [],
  products = [],
  budgetSummary,
  currentRole,
  onNavigate,
  onQuickPR,
  onOpenPR,
  onOpenPO,
  isLoading = false
}) {
  // If loading and no products or documents loaded yet, show non-blocking skeleton immediately
  if (isLoading && products.length === 0 && prs.length === 0 && pos.length === 0) {
    return <DashboardSkeleton />;
  }
  // 1. Data Normalization & Master Lookup สำหรับ Low Stock Items (Directive 1 & 2)
  const lowStockItems = useMemo(() => {
    // Flatten any nested arrays or wrapper structures
    const flatList = (products || [])
      .flatMap((p) => (Array.isArray(p) ? p : [p]))
      .filter((p) => p && typeof p === 'object');

    // สกัดค่าตาม Data Schema จริงและรองรับ Property ซ้อน (p.product, p.item, p.inventory)
    const normalized = flatList.map((p) => {
      const actualItem = p.product || p.item || p.inventory || p;
      if (!actualItem || typeof actualItem !== 'object') return null;

      // ค้นหา Master Data หากมี ID หรือ SKU ตรงกัน
      const master = flatList.find(
        (m) =>
          m &&
          m !== actualItem &&
          ((m.id && (m.id === actualItem.id || m.id === actualItem.itemId)) ||
            (m.sku && (m.sku === actualItem.sku || m.sku === actualItem.code)) ||
            (m.code && (m.code === actualItem.code || m.code === actualItem.sku)))
      );

      const resolvedName =
        actualItem.name || actualItem.itemName || actualItem.nameTh || actualItem.title || master?.name || master?.itemName;
      const resolvedSku =
        actualItem.sku || actualItem.code || actualItem.itemCode || master?.sku || master?.code || actualItem.id || '-';
      const currentStock = Number(
        actualItem.currentStock ??
          actualItem.stockBalance ??
          actualItem.stock ??
          actualItem.balance ??
          actualItem.qty ??
          master?.currentStock ??
          master?.stockBalance ??
          0
      );
      const rop = Number(
        actualItem.rop ??
          actualItem.reorderPoint ??
          actualItem.minStock ??
          master?.rop ??
          master?.reorderPoint ??
          0
      );
      const unit = actualItem.unit || actualItem.stockUnit || actualItem.purchaseUnit || master?.unit || 'ชิ้น';
      const department = actualItem.department || actualItem.category || master?.department || master?.category || 'PD';
      const price = Number(actualItem.price ?? master?.price ?? 0);
      const isInactive =
        actualItem.isActive === false || String(actualItem.status || '').toUpperCase() === 'INACTIVE';

      return {
        id: actualItem.id || master?.id || `prod-${Math.random()}`,
        name: resolvedName,
        sku: String(resolvedSku).trim(),
        code: String(resolvedSku).trim(),
        stock: currentStock,
        currentStock,
        rop,
        reorderPoint: rop,
        unit,
        department,
        category: department,
        price,
        isInactive
      };
    });

    // Directive 2: กรองสินค้าแตะ ROP ที่รัดกุม (ห้าม 0 <= 0 หลุดมาเด็ดขาด ต้อง rop > 0 และมีชื่อสินค้าจริง)
    const filtered = normalized.filter(
      (item) =>
        item &&
        !item.isInactive &&
        Boolean(item.name && item.name !== 'สินค้าไม่มีชื่อ') &&
        item.rop > 0 &&
        item.stock <= item.rop
    );

    return filtered;
  }, [products]);

  // Interaction Directive 3: เปิดหน้า Create PR พร้อมพรีฟิลเฉพาะสินค้ารายการนั้น
  const handleSingleQuickPR = (item) => {
    if (onQuickPR) {
      onQuickPR({
        id: item.id,
        code: item.sku,
        sku: item.sku,
        name: item.name,
        department: item.department || 'PD',
        category: item.department || 'PD',
        reorderPoint: item.rop,
        rop: item.rop,
        currentStock: item.stock,
        stockBalance: item.stock,
        unit: item.unit,
        price: item.price || 0
      });
    } else if (onNavigate) {
      onNavigate('pr-create');
    }
  };

  // Interaction Directive 3: เปิดหน้า Create PR พร้อมรวบสินค้าที่แตะ ROP ทั้งหมดใส่ลงในตารางคำขอซื้อให้ในทันที
  const handleBatchQuickPR = () => {
    if (!lowStockItems || lowStockItems.length === 0) return;
    if (onQuickPR) {
      const batchPayload = lowStockItems.map((item) => ({
        id: item.id,
        code: item.sku,
        sku: item.sku,
        name: item.name,
        department: item.department || 'PD',
        category: item.department || 'PD',
        reorderPoint: item.rop,
        rop: item.rop,
        currentStock: item.stock,
        stockBalance: item.stock,
        unit: item.unit,
        price: item.price || 0
      }));
      onQuickPR(batchPayload);
    } else if (onNavigate) {
      onNavigate('pr-create');
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5 animate-fade-in pb-12">
      {/* 1. TOP KPI RIBBON (4 คอลัมน์) */}
      <KPICards
        prs={prs}
        pos={pos}
        products={products}
        budgetSummary={budgetSummary}
        currentRole={currentRole}
        onNavigate={onNavigate}
        onQuickPR={onQuickPR}
        lowStockCount={lowStockItems.length}
        lowStockItems={lowStockItems}
      />

      {/* 2. MAIN BENTO WORKSPACE (65% vs 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ฝั่งซ้าย (col-span-12 lg:col-span-7 xl:col-span-8): DOCUMENT TRACKING */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-8 space-y-5">
          {/* กล่อง: ใบขอซื้อล่าสุด (Recent PRs) */}
          <RecentPRsTable
            prs={prs}
            onNavigate={onNavigate}
            onOpenPR={onOpenPR}
          />

          {/* กล่อง: ใบสั่งซื้อล่าสุด (Recent POs) */}
          <RecentPOsTable
            pos={pos}
            onNavigate={onNavigate}
            onOpenPO={onOpenPO}
          />
        </div>

        {/* ฝั่งขวา (col-span-12 lg:col-span-5 xl:col-span-4): ACTION & ALERT PANEL */}
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 space-y-5">
          {/* กล่อง: สินค้าแตะจุดสั่งซื้อซ้ำ (Redesigned ROP Alert Widget) */}
          <LowStockAlertCard
            lowStockItems={lowStockItems}
            onSingleQuickPR={handleSingleQuickPR}
            onBatchQuickPR={handleBatchQuickPR}
          />
        </div>
      </div>
    </div>
  );
}
