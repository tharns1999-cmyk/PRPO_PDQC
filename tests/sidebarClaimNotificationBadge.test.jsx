import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import './setup.js';
import { AppProvider } from '../src/context/AppContext';
import Sidebar from '../src/components/common/Sidebar';
import SidebarAlias from '../src/components/Sidebar';
import { calculateActiveClaimCount, calculatePendingActionCount, calculateUrgentTaskCount, isOrderClosed } from '../src/context/ProcurementContext';

describe('Sidebar Claim & Actionable Task Notification Badge (urgentTaskCount)', () => {
  const onlineRole = {
    id: 'ONLINE_PURCHASER',
    roleId: 'ONLINE_PURCHASER',
    name: 'Online Purchaser',
    canOnlinePurchase: true,
    level: 1
  };

  it('1. isOrderClosed correctly identifies closed order states', () => {
    expect(isOrderClosed('COMPLETED')).toBe(true);
    expect(isOrderClosed('CLOSED')).toBe(true);
    expect(isOrderClosed('COMPLETED_DELIVERY')).toBe(true);
    expect(isOrderClosed('CANCELLED')).toBe(true);
    expect(isOrderClosed('IN_CLAIM')).toBe(false);
    expect(isOrderClosed('PARTIALLY_RECEIVED_IN_CLAIM')).toBe(false);
    expect(isOrderClosed('ORDERED')).toBe(false);
  });

  it('2. calculateActiveClaimCount counts active claim orders and ignores closed ones', () => {
    const orders = [
      { id: 'PO-1', status: 'IN_CLAIM' },
      { id: 'PO-2', status: 'PARTIALLY_RECEIVED_IN_CLAIM' },
      { id: 'PO-3', status: 'ISSUED', hasGRN: true, hasDispute: true },
      { id: 'PO-4', status: 'COMPLETED', hasGRN: true, hasDispute: true }, // closed: ignored
      { id: 'PO-5', status: 'ORDERED' } // normal: ignored
    ];

    const count = calculateActiveClaimCount(orders);
    expect(count).toBe(3);
  });

  it('3. calculatePendingActionCount counts pending actionable orders and PRs', () => {
    const orders = [
      { id: 'PO-P1', status: 'PENDING_ORDER' },
      { id: 'PO-P2', status: 'WAITING_PURCHASE' },
      { id: 'PO-P3', status: 'รอดำเนินการ' },
      { id: 'PO-ORD', status: 'ORDERED' }, // ordered: ignored
      { id: 'PO-CLS', status: 'COMPLETED' } // closed: ignored
    ];
    const prs = [
      { id: 'PR-1', status: 'WAITING_PURCHASE', purchaseChannel: 'ONLINE' }
    ];

    const count = calculatePendingActionCount(orders, prs);
    expect(count).toBe(4);
  });

  it('4. calculateUrgentTaskCount sums pendingActionCount and activeClaimCount strictly excluding ORDERED and CLOSED', () => {
    const orders = [
      { id: 'PO-PENDING', status: 'PENDING_ORDER' },
      { id: 'PO-CLAIM', status: 'IN_CLAIM' },
      { id: 'PO-ORDERED', status: 'ORDERED' },
      { id: 'PO-CLOSED', status: 'CLOSED' }
    ];

    const pending = calculatePendingActionCount(orders);
    const claim = calculateActiveClaimCount(orders);
    const urgent = calculateUrgentTaskCount(orders);

    expect(pending).toBe(1);
    expect(claim).toBe(1);
    expect(urgent).toBe(2);
  });

  it('5. [Image d42112 Fix]: Renders badge with count 1 when pendingActionCount = 1 and activeClaimCount = 0', () => {
    const pos = [
      { id: 'PO-PENDING-01', status: 'PENDING_ORDER', purchaseChannel: 'ONLINE' }
    ];

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppProvider>
          <Sidebar
            currentRole={onlineRole}
            currentUser={{ id: 'u1', name: 'Purchaser' }}
            pos={pos}
            prs={[]}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Verify "งานจัดซื้อ" button exists
    expect(html).toContain('งานจัดซื้อ');
    // Verify justify-between layout
    expect(html).toContain('justify-between');
    // Verify pulsing rose badge with count 1
    expect(html).toContain('animate-pulse');
    expect(html).toContain('bg-rose-600');
    expect(html).toContain('border-rose-400');
    expect(html).toContain('>1</span>');
  });

  it('6. Renders badge with sum when both pending and claim tasks exist (1 + 2 = 3)', () => {
    const pos = [
      { id: 'PO-PENDING-01', status: 'PENDING_ORDER', purchaseChannel: 'ONLINE' },
      { id: 'PO-CLAIM-1', status: 'IN_CLAIM', purchaseChannel: 'ONLINE' },
      { id: 'PO-CLAIM-2', status: 'PARTIALLY_RECEIVED_IN_CLAIM', purchaseChannel: 'ONLINE' },
      { id: 'PO-ORDERED', status: 'ORDERED', purchaseChannel: 'ONLINE' } // strictly excluded
    ];

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppProvider>
          <Sidebar
            currentRole={onlineRole}
            currentUser={{ id: 'u1', name: 'Purchaser' }}
            pos={pos}
            prs={[]}
          />
        </AppProvider>
      </MemoryRouter>
    );

    expect(html).toContain('>3</span>');
    expect(html).toContain('animate-pulse');
    expect(html).toContain('bg-rose-600');
  });

  it('7. Hides badge completely when both pending and claim are 0 (only ORDERED and COMPLETED exist)', () => {
    const pos = [
      { id: 'PO-NORMAL-1', status: 'ORDERED', purchaseChannel: 'ONLINE' },
      { id: 'PO-NORMAL-2', status: 'COMPLETED', purchaseChannel: 'ONLINE' }
    ];

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppProvider>
          <Sidebar
            currentRole={onlineRole}
            currentUser={{ id: 'u1', name: 'Purchaser' }}
            pos={pos}
            prs={[]}
          />
        </AppProvider>
      </MemoryRouter>
    );

    expect(html).toContain('งานจัดซื้อ');
    // Pulsing badge should NOT appear
    expect(html).not.toContain('bg-rose-600 rounded-full animate-pulse');
  });

  it('8. src/components/Sidebar alias points to Sidebar component seamlessly', () => {
    expect(SidebarAlias).toBe(Sidebar);
  });
});
