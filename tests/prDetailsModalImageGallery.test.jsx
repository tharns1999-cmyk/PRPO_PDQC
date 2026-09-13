import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext.jsx';
import PRDetailsModal from '../src/components/pr/PRDetailsModal.jsx';
import { storageService } from '../src/services/storageService.js';

describe('PRDetailsModal Visual Media Strip & Lightbox Integration', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  const reviewerRole = {
    id: 'USR-MGR-01',
    name: 'ผู้จัดการโรงงาน (Approver)',
    department: 'PD',
    roleId: 'APPROVER_PLANT',
    level: 3
  };

  it('1. Renders Visual Media Strip when item has attached images or attachments', () => {
    const testPRWithImages = {
      id: 'PR-TEST-MEDIA-001',
      prNo: 'PD002/2026',
      department: 'PD',
      requestedBy: 'สมชาย ผู้ขอซื้อ',
      status: 'SUBMITTED',
      purchaseChannel: 'ONLINE',
      items: [
        {
          id: 'ITEM-1',
          code: 'PD-BLT-380',
          name: 'สายพานลำเลียงทนความร้อน Mitsuboshi',
          price: 1850,
          qty: 2,
          unit: 'เส้น',
          images: [
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            { url: 'https://example.com/spec-sheet.jpg', name: 'สเปกโรงงาน' }
          ]
        }
      ]
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <PRDetailsModal
            selectedPR={testPRWithImages}
            currentRole={reviewerRole}
            onClose={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // 1. Should display photo count badge
    expect(html).toContain('📷 รูปสเปกจริง (2):');

    // 2. Should render 2 thumbnail containers with tooltip
    expect(html).toContain('title="คลิกเพื่อดูรูปขนาดใหญ่"');
    expect(html).toContain('alt="Item attachment 1"');
    expect(html).toContain('alt="Item attachment 2"');

    // 3. Should render SKU badge and product name
    expect(html).toContain('PD-BLT-380');
    expect(html).toContain('สายพานลำเลียงทนความร้อน Mitsuboshi');
  });

  it('2. Supports item.attachments fallback array seamlessly', () => {
    const testPRWithAttachments = {
      id: 'PR-TEST-MEDIA-002',
      prNo: 'PD003/2026',
      department: 'PD',
      requestedBy: 'สมชาย ผู้ขอซื้อ',
      status: 'SUBMITTED',
      purchaseChannel: 'ONLINE',
      items: [
        {
          id: 'ITEM-2',
          code: 'PD-SNS-100',
          name: 'เซนเซอร์ตรวจจับความร้อน Omron',
          price: 3200,
          qty: 1,
          unit: 'ตัว',
          attachments: [
            'https://example.com/omron-sensor.png'
          ]
        }
      ]
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <PRDetailsModal
            selectedPR={testPRWithAttachments}
            currentRole={reviewerRole}
            onClose={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    expect(html).toContain('📷 รูปสเปกจริง (1):');
    expect(html).toContain('src="https://example.com/omron-sensor.png"');
  });

  it('3. Does NOT render media strip when item has no images (clean non-regression)', () => {
    const testPRWithoutImages = {
      id: 'PR-TEST-MEDIA-003',
      prNo: 'PD004/2026',
      department: 'PD',
      requestedBy: 'สมศักดิ์ ผู้ขอซื้อ',
      status: 'SUBMITTED',
      purchaseChannel: 'OFFLINE',
      items: [
        {
          id: 'ITEM-3',
          code: 'PD-OIL-068',
          name: 'น้ำมันไฮดรอลิก Shell Tellus S2 M 68',
          price: 14500,
          qty: 1,
          unit: 'ถัง'
        }
      ]
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppProvider>
          <PRDetailsModal
            selectedPR={testPRWithoutImages}
            currentRole={reviewerRole}
            onClose={() => {}}
          />
        </AppProvider>
      </MemoryRouter>
    );

    // Should NOT contain the photo strip
    expect(html).not.toContain('📷 รูปสเปกจริง');
    // Still shows the item normally
    expect(html).toContain('น้ำมันไฮดรอลิก Shell Tellus S2 M 68');
  });
});
