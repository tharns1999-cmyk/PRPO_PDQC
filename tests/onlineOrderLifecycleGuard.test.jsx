import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { calculateDisputeMetrics } from '../src/views/procurement/OnlineOrderCard';
import { 
  hasUnresolvedClaim, 
  checkPOHasGRN, 
  checkPOHasDispute, 
  isOrderClosed, 
  isOrderInClaim 
} from '../src/views/OnlineTaskView';
import { 
  filteredOrders, 
  getTabMetrics 
} from '../src/views/procurement/OnlineProcurementHub';
import { workflowEngine } from '../src/services/workflowEngine';
import { storageService } from '../src/services/storageService';

describe('Online Order Lifecycle Guard & Tab Filtering', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  describe('1. calculateDisputeMetrics Lifecycle Guard', () => {
    it('does NOT treat receivedQty = 0 as shortage for pre-inspection PO in PENDING status without GRN', () => {
      const item = {
        name: 'Chemical Reagent',
        actualQty: 3,
        actualPrice: 500,
        receivedQty: 0
      };

      const metrics = calculateDisputeMetrics(item, 'PENDING', false);

      expect(metrics.orderedQty).toBe(3);
      expect(metrics.receivedQty).toBe(0);
      expect(metrics.shortageQty).toBe(0);
      expect(metrics.damagedQty).toBe(0);
      expect(metrics.disputedQty).toBe(0);
      expect(metrics.claimableAmount).toBe(0);
      expect(metrics.hasDispute).toBe(false);
    });

    it('does NOT treat receivedQty = 0 as shortage for pre-inspection PO in ORDERED status without GRN', () => {
      const item = {
        name: 'Safety Glasses',
        actualQty: 5,
        actualPrice: 120,
        receivedQty: 0
      };

      const metrics = calculateDisputeMetrics(item, 'ORDERED', false);

      expect(metrics.orderedQty).toBe(5);
      expect(metrics.receivedQty).toBe(0);
      expect(metrics.shortageQty).toBe(0);
      expect(metrics.disputedQty).toBe(0);
      expect(metrics.hasDispute).toBe(false);
    });

    it('does NOT treat receivedQty = 0 as shortage for ORDERED_PENDING_DELIVERY or IN_TRANSIT without GRN', () => {
      const item = {
        name: 'Nitrile Gloves',
        actualQty: 10,
        actualPrice: 199,
        receivedQty: 0
      };

      const metricsDelivery = calculateDisputeMetrics(item, 'ORDERED_PENDING_DELIVERY', false);
      expect(metricsDelivery.hasDispute).toBe(false);
      expect(metricsDelivery.shortageQty).toBe(0);

      const metricsTransit = calculateDisputeMetrics(item, 'IN_TRANSIT', false);
      expect(metricsTransit.hasDispute).toBe(false);
      expect(metricsTransit.shortageQty).toBe(0);
    });

    it('calculates shortage accurately once warehouse inspection submits a GRN', () => {
      const item = {
        name: 'Chemical Reagent',
        actualQty: 3,
        actualPrice: 500,
        receivedQty: 1, // received 1 of 3
        damagedQty: 0
      };

      // When GRN is submitted:
      const metrics = calculateDisputeMetrics(item, 'ORDERED_PENDING_DELIVERY', true);

      expect(metrics.orderedQty).toBe(3);
      expect(metrics.receivedQty).toBe(1);
      expect(metrics.shortageQty).toBe(2);
      expect(metrics.disputedQty).toBe(2);
      expect(metrics.claimableAmount).toBe(1000);
      expect(metrics.hasDispute).toBe(true);
    });

    it('calculates both shortage and damaged quantities when GRN is submitted', () => {
      const item = {
        name: 'Glass Beakers',
        actualQty: 10,
        actualPrice: 100,
        receivedQty: 7,
        damagedQty: 1
      };

      const metrics = calculateDisputeMetrics(item, 'PARTIALLY_RECEIVED', true);

      expect(metrics.orderedQty).toBe(10);
      expect(metrics.receivedQty).toBe(7);
      expect(metrics.damagedQty).toBe(1);
      expect(metrics.shortageQty).toBe(2); // 10 - 7 - 1 = 2
      expect(metrics.disputedQty).toBe(3); // 2 shortage + 1 damaged
      expect(metrics.claimableAmount).toBe(300);
      expect(metrics.hasDispute).toBe(true);
    });
  });

  describe('2. hasUnresolvedClaim & State Machine Guards', () => {
    it('returns false for newly confirmed ORDERED PO without GRN inspection', () => {
      const po = {
        id: 'PO-TEST-001',
        poNo: 'PO-2026-001',
        status: 'ORDERED',
        department: 'PD',
        items: [
          {
            id: 'item-1',
            name: 'Pallet Film',
            actualQty: 3,
            actualPrice: 400,
            receivedQty: 0,
            storePlatform: 'Shopee',
            actualStoreName: 'FilmShop'
          }
        ]
      };

      expect(checkPOHasGRN(po)).toBe(false);
      expect(hasUnresolvedClaim(po)).toBe(false);
    });

    it('returns true when PO has GRN and shortage is recorded', () => {
      const po = {
        id: 'PO-TEST-002',
        poNo: 'PO-2026-002',
        status: 'PARTIALLY_RECEIVED',
        hasGRN: true,
        grNumber: 'GRN-2026-002-01',
        department: 'PD',
        items: [
          {
            id: 'item-1',
            name: 'Pallet Film',
            actualQty: 3,
            actualPrice: 400,
            receivedQty: 1,
            shortageQty: 2,
            storePlatform: 'Shopee',
            actualStoreName: 'FilmShop'
          }
        ]
      };

      expect(checkPOHasGRN(po)).toBe(true);
      expect(hasUnresolvedClaim(po)).toBe(true);
    });

    it('returns false when store claim is resolved even if item had dispute', () => {
      const po = {
        id: 'PO-TEST-003',
        poNo: 'PO-2026-003',
        status: 'RESOLVED',
        hasGRN: true,
        department: 'PD',
        items: [
          {
            id: 'item-1',
            name: 'Pallet Film',
            actualQty: 3,
            actualPrice: 400,
            receivedQty: 1,
            shortageQty: 2,
            storePlatform: 'Shopee',
            actualStoreName: 'FilmShop'
          }
        ],
        storeClaims: {
          Shopee_filmshop: { status: 'RESOLVED', refundAmount: 800 }
        }
      };

      expect(hasUnresolvedClaim(po)).toBe(false);
    });
  });

  describe('3. Tab Filtering Logic (filteredOrders & getTabMetrics)', () => {
    it('categorizes pre-inspection confirmed order strictly in ORDERED tab (NOT in CLAIM tab)', () => {
      const orders = [
        {
          id: 'PO-PENDING',
          poNo: 'PO-01',
          status: 'PENDING_ORDER',
          department: 'QC',
          totalAmount: 1000,
          items: [{ actualQty: 2, actualPrice: 500, receivedQty: 0 }]
        },
        {
          id: 'PO-ORDERED-FRESH',
          poNo: 'PO-02',
          status: 'ORDERED',
          department: 'PD',
          totalAmount: 1500,
          // 3 ordered, 0 received, NO GRN
          items: [{ actualQty: 3, actualPrice: 500, receivedQty: 0 }]
        },
        {
          id: 'PO-WITH-SHORTAGE',
          poNo: 'PO-03',
          status: 'IN_CLAIM',
          hasGRN: true,
          grNumber: 'GRN-03',
          department: 'QC',
          totalAmount: 2000,
          items: [{ actualQty: 4, actualPrice: 500, receivedQty: 1, shortageQty: 3 }]
        },
        {
          id: 'PO-CLOSED',
          poNo: 'PO-04',
          status: 'COMPLETED',
          department: 'PD',
          totalAmount: 500,
          items: [{ actualQty: 1, actualPrice: 500, receivedQty: 1, isFullyReceived: true }]
        }
      ];

      // 1. Check Metrics
      const metrics = getTabMetrics(orders);
      expect(metrics.pending).toBe(1);
      expect(metrics.ordered).toBe(1); // PO-ORDERED-FRESH must be here!
      expect(metrics.claim).toBe(1);   // PO-WITH-SHORTAGE must be here!
      expect(metrics.closed).toBe(1);  // PO-CLOSED must be here!

      // 2. Check filteredOrders for ORDERED tab
      const orderedTabOrders = filteredOrders(orders, 'ORDERED');
      expect(orderedTabOrders.length).toBe(1);
      expect(orderedTabOrders[0].id).toBe('PO-ORDERED-FRESH');

      // 3. Check filteredOrders for CLAIM tab
      const claimTabOrders = filteredOrders(orders, 'CLAIM');
      expect(claimTabOrders.length).toBe(1);
      expect(claimTabOrders[0].id).toBe('PO-WITH-SHORTAGE');

      // 4. Check filteredOrders for PENDING tab
      const pendingTabOrders = filteredOrders(orders, 'PENDING');
      expect(pendingTabOrders.length).toBe(1);
      expect(pendingTabOrders[0].id).toBe('PO-PENDING');

      // 5. Check filteredOrders for CLOSED tab
      const closedTabOrders = filteredOrders(orders, 'CLOSED');
      expect(closedTabOrders.length).toBe(1);
      expect(closedTabOrders[0].id).toBe('PO-CLOSED');
    });
  });

  describe('4. workflowEngine.confirmOnlineOrder', () => {
    it('sets PO status to ORDERED upon confirmation', async () => {
      const mockPO = {
        id: 'PO-WORKFLOW-TEST',
        poNo: 'PO-2026-999',
        status: 'IN_PROGRESS_ONLINE',
        purchaseChannel: 'ONLINE',
        department: 'QC',
        items: [
          {
            id: 'item-1',
            name: 'Test Item',
            qty: 2,
            price: 250,
            actualStoreName: 'OnlineStore1',
            storePlatform: 'Shopee'
          }
        ]
      };

      storageService.savePOs([mockPO]);

      const user = { name: 'Tharn Online Purchaser', role: 'Purchaser' };
      const updated = await workflowEngine.confirmOnlineOrder(
        'PO-WORKFLOW-TEST',
        'Shopee OnlineStore1',
        user,
        [
          {
            ...mockPO.items[0],
            actualQty: 2,
            actualPrice: 240,
            actualStoreName: 'Shopee OnlineStore1'
          }
        ],
        'สั่งซื้อจริงได้ราคาถูกลง'
      );

      expect(updated.status).toBe('ORDERED');
      expect(updated.vendorName).toBe('Shopee OnlineStore1');
      expect(updated.totalAmount).toBe(480);
    });
  });
});
