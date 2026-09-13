import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';
import { AppProvider } from '../src/context/AppContext';
import OnlineOrderCard, { 
  isStorePendingClaim, 
  isStoreClaimResolved, 
  getStoreGroupKey 
} from '../src/views/procurement/OnlineOrderCard';
import { hasUnresolvedClaim, filterOrdersByTab, getTabMetrics } from '../src/views/procurement/OnlineProcurementHub';
import { calculateActiveClaimCount } from '../src/context/ProcurementContext';
import { workflowEngine } from '../src/services/workflowEngine';
import { storageService } from '../src/services/storageService';

describe('Claim Task Stuck & False Disputed Store Counter Fixes', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  const onlineRole = {
    id: 'ONLINE_PURCHASER',
    roleId: 'ONLINE_PURCHASER',
    name: 'Online Purchaser',
    canOnlinePurchase: true,
    level: 1
  };

  // 3-Store PO Scenario reported by user:
  // 1) Store "แ้กั้กเก็ดใด" - CLAIM_SHORTAGE -> gets REFUND
  // 2) Store "'กพั๊กพ" - Damaged -> gets REPLACEMENT (has single quote in name)
  // 3) Store "24525sนีเร" - WAIT_NEXT_ROUND -> separate delivery, NOT a claim!
  const createMock3StorePO = () => ({
    id: 'PO-3STORE-CLAIM',
    poNo: 'PO-2026-3S',
    status: 'PARTIALLY_RECEIVED_IN_CLAIM',
    claimStatus: 'IN_CLAIM',
    hasDispute: true,
    isInClaim: true,
    hasGRN: true,
    department: 'QC',
    purchaseChannel: 'ONLINE',
    items: [
      {
        id: 'item-1',
        name: 'Chemical Reagent',
        storePlatform: 'Shopee',
        actualStoreName: 'แ้กั้กเก็ดใด',
        actualQty: 10,
        receivedQty: 8,
        shortageQty: 2,
        shortageAction: 'CLAIM_SHORTAGE',
        damagedQty: 0,
        actualPrice: 150
      },
      {
        id: 'item-2',
        name: 'Plastic Pipette',
        storePlatform: 'Shopee',
        actualStoreName: "'กพั๊กพ",
        actualQty: 5,
        receivedQty: 4,
        damagedQty: 1,
        shortageQty: 0,
        actualPrice: 200
      },
      {
        id: 'item-3',
        name: 'Filter Paper',
        storePlatform: 'Shopee',
        actualStoreName: '24525sนีเร',
        actualQty: 10,
        receivedQty: 7,
        shortageQty: 3,
        shortageAction: 'WAIT_NEXT_ROUND',
        damagedQty: 0,
        actualPrice: 80
      }
    ],
    storeClaims: {}
  });

  it('1. Directive 1: isStorePendingClaim ignores WAIT_NEXT_ROUND store and handles special quotes store name', () => {
    const storeWaitNextRound = {
      storeKey: 'Shopee_24525sนีเร',
      storeName: '24525sนีเร',
      items: [
        { shortageQty: 3, shortageAction: 'WAIT_NEXT_ROUND', damagedQty: 0 }
      ]
    };

    const storeWithQuote = {
      storeKey: "Shopee_'กพั๊กพ",
      storeName: "'กพั๊กพ",
      items: [
        { damagedQty: 1, shortageQty: 0 }
      ]
    };

    // Store 24525sนีเร should NOT be pending claim because it is WAIT_NEXT_ROUND
    expect(isStorePendingClaim(storeWaitNextRound, {})).toBe(false);

    // Store 'กพั๊กพ should be pending claim before resolution
    expect(isStorePendingClaim(storeWithQuote, {})).toBe(true);

    // After resolution with special characters / quote variation
    const storeClaims = {
      "Shopee_'กพั๊กพ": {
        status: 'RESOLVED',
        isResolved: true,
        type: 'REPLACEMENT'
      }
    };
    expect(isStoreClaimResolved(storeWithQuote, storeClaims)).toBe(true);
    expect(isStorePendingClaim(storeWithQuote, storeClaims)).toBe(false);

    // Also handles storeName as key
    const storeClaimsNameKey = {
      "'กพั๊กพ": {
        status: 'RESOLVED',
        isResolved: true,
        type: 'REPLACEMENT'
      }
    };
    expect(isStoreClaimResolved(storeWithQuote, storeClaimsNameKey)).toBe(true);
    expect(isStorePendingClaim(storeWithQuote, storeClaimsNameKey)).toBe(false);
  });

  it('2. Directive 1: Card header counts ONLY genuine claim stores and hides claim badge when all resolved', () => {
    const po = createMock3StorePO();

    // Initial state: Only 2 stores (แ้กั้กเก็ดใด and 'กพั๊กพ) are in claim. 24525sนีเร is excluded.
    const html2Unresolved = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/online-tasks']}>
        <AppProvider>
          <OnlineOrderCard
            po={po}
            activeTab="CLAIM"
            currentRole={onlineRole}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Header counter should show 2 stores (NOT 3!)
    expect(html2Unresolved).toContain('🔴 รอเคลม (2 ร้านค้า)');

    // Now resolve store 1 (แ้กั้กเก็ดใด)
    po.storeClaims = {
      'Shopee_แ้กั้กเก็ดใด': {
        isResolved: true,
        status: 'RESOLVED',
        type: 'REFUND',
        refundAmount: 300
      }
    };

    const html1Unresolved = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/online-tasks']}>
        <AppProvider>
          <OnlineOrderCard
            po={po}
            activeTab="CLAIM"
            currentRole={onlineRole}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Header counter should update to 1 store
    expect(html1Unresolved).toContain('🔴 รอเคลม (1 ร้านค้า)');

    // Now resolve store 2 ('กพั๊กพ)
    po.storeClaims["Shopee_'กพั๊กพ"] = {
      isResolved: true,
      status: 'RESOLVED',
      type: 'REPLACEMENT',
      replacementTrackingNo: 'TH1234567'
    };

    const html0Unresolved = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/online-tasks']}>
        <AppProvider>
          <OnlineOrderCard
            po={po}
            activeTab="CLAIM"
            currentRole={onlineRole}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Header must NOT display claim badge when unresolved count is 0
    expect(html0Unresolved).not.toContain('🔴 รอเคลม');
  });

  it('3. Directive 2: Auto-transitions PO out of CLAIM to ORDERED when replacement/waiting deliveries exist', async () => {
    const po = createMock3StorePO();

    // Both claim stores are resolved
    po.storeClaims = {
      'Shopee_แ้กั้กเก็ดใด': {
        isResolved: true,
        status: 'RESOLVED',
        type: 'REFUND',
        refundAmount: 300
      },
      "Shopee_'กพั๊กพ": {
        isResolved: true,
        status: 'RESOLVED',
        type: 'REPLACEMENT',
        newTrackingNo: 'REPLACE-999'
      }
    };

    // Save to storage before workflowEngine calls
    storageService.savePOs([po]);

    // Resolve via workflowEngine
    const updatedPO = await workflowEngine.resolveClaim(
      po.id,
      {
        storeKey: "Shopee_'กพั๊กพ",
        type: 'REPLACEMENT',
        newTrackingNo: 'REPLACE-999',
        allStoresResolved: true,
        hasPendingDeliveries: true
      },
      onlineRole,
      po
    );

    // PO status should transition to ORDERED_PENDING_DELIVERY (not stuck in IN_CLAIM)
    expect(updatedPO.status).toBe('ORDERED_PENDING_DELIVERY');
    expect(updatedPO.claimStatus).toBe('REPLACEMENT_PENDING');
    expect(updatedPO.hasDispute).toBe(false);
    expect(updatedPO.isInClaim).toBe(false);

    // hasUnresolvedClaim should return false
    expect(hasUnresolvedClaim(updatedPO)).toBe(false);

    // Card should leave CLAIM tab (0 items in CLAIM) and appear in ORDERED tab
    const claimOrders = filterOrdersByTab([updatedPO], 'CLAIM');
    const orderedOrders = filterOrdersByTab([updatedPO], 'ORDERED');

    expect(claimOrders.length).toBe(0);
    expect(orderedOrders.length).toBe(1);
  });

  it('4. Directive 2: Auto-transitions PO to COMPLETED when all stores are settled via REFUND and no pending deliveries', async () => {
    const po = {
      id: 'PO-REFUND-ALL',
      poNo: 'PO-2026-REF',
      department: 'QC',
      purchaseChannel: 'ONLINE',
      status: 'PARTIALLY_RECEIVED_IN_CLAIM',
      hasDispute: true,
      isInClaim: true,
      hasGRN: true,
      items: [
        {
          id: 'item-1',
          name: 'Item A',
          storePlatform: 'Shopee',
          actualStoreName: 'StoreA',
          shortageQty: 1,
          shortageAction: 'CLAIM_SHORTAGE',
          actualPrice: 100
        }
      ],
      storeClaims: {}
    };

    storageService.savePOs([po]);

    const updatedPO = await workflowEngine.resolveClaim(
      po.id,
      {
        storeKey: 'Shopee_StoreA',
        type: 'REFUND',
        refundAmount: 100,
        allStoresResolved: true,
        hasPendingDeliveries: false
      },
      onlineRole,
      po
    );

    expect(updatedPO.status).toBe('COMPLETED');
    expect(updatedPO.claimStatus).toBe('RESOLVED');
    expect(updatedPO.hasDispute).toBe(false);

    const claimOrders = filterOrdersByTab([updatedPO], 'CLAIM');
    const closedOrders = filterOrdersByTab([updatedPO], 'CLOSED');

    expect(claimOrders.length).toBe(0);
    expect(closedOrders.length).toBe(1);
  });

  it('5. Directive 3: Syncs badge to 0 at Tab and Sidebar when claims are resolved', () => {
    const po = createMock3StorePO();
    po.storeClaims = {
      'Shopee_แ้กั้กเก็ดใด': {
        isResolved: true,
        status: 'RESOLVED',
        type: 'REFUND',
        refundAmount: 300
      },
      "Shopee_'กพั๊กพ": {
        isResolved: true,
        status: 'RESOLVED',
        type: 'REPLACEMENT'
      }
    };
    po.hasDispute = false;
    po.isInClaim = false;
    po.claimStatus = 'RESOLVED';
    po.status = 'ORDERED_PENDING_DELIVERY';

    // Tab metrics
    const metrics = getTabMetrics([po]);
    expect(metrics.claim).toBe(0);
    expect(metrics.ordered).toBe(1);

    // Sidebar active claim count
    const activeClaims = calculateActiveClaimCount([po]);
    expect(activeClaims).toBe(0);
  });
});
