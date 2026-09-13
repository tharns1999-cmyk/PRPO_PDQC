import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext.jsx';
import PRCreateView from '../src/views/PRCreateView.jsx';
import SearchableSelect from '../src/components/common/SearchableSelect.jsx';
import { storageService } from '../src/services/storageService.js';

describe('PR Item Row Layout & Compact Financial Cluster', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  const mockProducts = [
    {
      id: 'PROD-PD-001',
      code: 'PD-OIL-068',
      name: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
      category: 'PD',
      unit: 'ลิตร',
      purchaseUnit: 'ถัง (200L)',
      stockUnit: 'ลิตร',
      price: 14500,
      stockBalance: 100,
      reorderPoint: 20
    }
  ];

  const requesterRole = {
    id: 'USR-PD-01',
    name: 'คุณสมชาย',
    department: 'PD',
    roleId: 'REQUESTER_PD',
    level: 1
  };

  it('1. SearchableSelect trigger hides item code badge when showCodeBadgeInTrigger is false', () => {
    const options = [
      {
        value: 'PROD-PD-001',
        label: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
        code: 'PD-OIL-068'
      }
    ];

    const html = renderToStaticMarkup(
      <SearchableSelect
        options={options}
        value="PROD-PD-001"
        onChange={() => {}}
        showCodeBadgeInTrigger={false}
      />
    );

    // In closed trigger button:
    // Should NOT have the code badge
    expect(html).not.toContain('>PD-OIL-068</span>');
    // Should render the full product label with title tooltip
    expect(html).toContain('น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)');
    expect(html).toContain('title="น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)"');
    expect(html).toContain('font-medium text-slate-800 text-xs sm:text-sm truncate');
  });

  it('2. PRCreateView item row renders expanded product container and compact financial cluster', () => {
    const editingPR = {
      id: 'PR-TEST-ROW-LAYOUT',
      prNo: 'PD001/2026',
      department: 'PD',
      purchaseChannel: 'OFFLINE',
      items: [
        {
          productId: 'PROD-PD-001',
          code: 'PD-OIL-068',
          name: 'น้ำมันไฮดรอลิกอุตสาหกรรม (Hydraulic Oil ISO VG 68)',
          price: 14500,
          qty: 2,
          unit: 'ถัง (200L)'
        }
      ]
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <PRCreateView
            currentRole={requesterRole}
            editingPR={editingPR}
            products={mockProducts}
            departments={[{ id: 'PD', name: 'ฝ่ายผลิต' }]}
            onNavigate={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // 1. Dropdown container has flex-1 and max-w-xl
    expect(html).toContain('flex-1 min-w-[200px] max-w-xl');

    // 2. Financial cluster container is right-aligned with ml-auto
    expect(html).toContain('flex items-center gap-2 sm:gap-3 shrink-0 ml-auto');

    // 3. Compact price box (expanded for fractional decimals & no clipping)
    expect(html).toContain('relative w-28 sm:w-30');

    // 4. Compact quantity stepper
    expect(html).toContain('w-22 sm:w-24');

    // 5. Unit Display with min/max width
    expect(html).toContain('min-w-[40px] max-w-[85px]');

    // 6. Line Total formatting
    expect(html).toContain('฿29,000.00');
  });
});
