import { storageService } from '../services/storageService';

export const mockPRs = [
  {
    id: "PR-PD001-2026",
    prNo: "PD001/2026",
    department: "PD",
    source: "FACTORY",
    purchaseChannel: "ONLINE",
    specUrl: "",
    attachments: [],
    note: "สั่งซื้อน้ำมันไฮดรอลิกสำหรับเครื่องจักรฝ่ายผลิต",
    items: [
      {
        productId: "PROD-PD-001",
        code: "PD-OIL-068",
        name: "น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)",
        purchaseUnit: "ถัง (200L)",
        stockUnit: "ลิตร",
        conversionRate: 200,
        purchaseQty: 1,
        stockQty: 200,
        qty: 1,
        unit: "ถัง (200L)",
        price: 14500,
        discountPercent: 0,
        discountAmount: 0,
        onlineUrl: "https://example.com/oil",
        total: 14500,
        source: "FACTORY",
        isCustom: false,
        isUnitOverridden: false
      }
    ],
    financials: {
      subtotal: 14500,
      itemDiscountTotal: 0,
      combinedDiscountType: "fixed",
      combinedDiscountValue: 0,
      combinedDiscountAmount: 0,
      totalDiscount: 0,
      vatMode: "NONE",
      vatAmount: 0,
      roundingAdj: 0,
      shippingCost: 0,
      grandTotal: 14500
    },
    totalAmount: 14500,
    status: "CLOSED",
    poNumber: "PO-PD-2026-001",
    poNo: "PO-PD-2026-001",
    poId: "PO-1789003809083-1",
    requestedBy: "คุณวิชัย (PD)",
    requestedByRole: "Requester (PD)",
    requestedDept: "PD"
  },
  {
    id: "PR-1789100542800-9OZ",
    prNo: "PD002/2026",
    department: "PD",
    source: "FACTORY",
    purchaseChannel: "ONLINE",
    specUrl: "Quotation-PD-STF-001.pdf",
    attachments: [],
    note: "ขอสั่งซื้อฟิล์มยืดพันพาเลทสำหรับการแพ็คเกจจิ้งสินค้าสำเร็จรูป",
    items: [
      {
        productId: "PROD-PD-008",
        code: "PD-STF-001",
        name: "ฟิล์มยืดพันพาเลท (Stretch Film 15 Micron 500mm x 300m)",
        purchaseUnit: "ลัง (6 ม้วน)",
        stockUnit: "ม้วน",
        conversionRate: 6,
        purchaseQty: 15,
        stockQty: 90,
        qty: 15,
        unit: "ลัง (6 ม้วน)",
        price: 1100,
        total: 16500,
        source: "FACTORY"
      }
    ],
    financials: {
      subtotal: 16500,
      itemDiscountTotal: 0,
      combinedDiscountType: "fixed",
      combinedDiscountValue: 0,
      combinedDiscountAmount: 0,
      totalDiscount: 0,
      vatMode: "NONE",
      vatAmount: 0,
      roundingAdj: 0,
      shippingCost: 0,
      grandTotal: 16500
    },
    totalAmount: 16500,
    status: "WAITING_REVIEW",
    requestedBy: "คุณวิชัย (PD)",
    requestedByRole: "Requester (PD)",
    requestedDept: "PD"
  },
  {
    id: "PR-1789102530747-1JM",
    prNo: "PD003/2026",
    department: "PD",
    source: "FACTORY",
    purchaseChannel: "ONLINE",
    totalAmount: 1500,
    status: "IN_PROGRESS_ONLINE",
    poNumber: "PO-PD-2026-002"
  },
  {
    id: "PR-1789110674000-9BW",
    prNo: "PD004/2026",
    department: "PD",
    source: "FACTORY",
    purchaseChannel: "SELF",
    totalAmount: 690.15,
    status: "PO_ISSUED",
    poNumber: "PO-PD-2026-003"
  },
  {
    id: "PR-1789117749515-OJZ",
    prNo: "PD005/2026",
    department: "PD",
    source: "FACTORY",
    purchaseChannel: "ONLINE",
    totalAmount: 397.54,
    status: "SUBMITTED"
  },
  {
    id: "PR-1789040675492-2BP",
    prNo: "PD001-CANCELLED/2026",
    department: "PD",
    source: "FACTORY",
    purchaseChannel: "SELF",
    totalAmount: 170994,
    status: "CANCELLED"
  }
];

export const getMockPRs = () => storageService.getPRs() || mockPRs;
export default mockPRs;
