import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import './setup.js';

import CollapsibleActivityTimeline, {
  ACTION_MAP,
  ROLE_MAP,
  resolveAction,
  resolveRole,
  formatEventTime
} from '../src/components/common/CollapsibleActivityTimeline';

describe('Activity Timeline & Audit Trail Localization Suite', () => {
  describe('1. Dictionary Translations (ACTION_MAP & ROLE_MAP)', () => {
    it('maps all 6 standard lifecycle actions to expected Thai labels and colors', () => {
      expect(ACTION_MAP.CREATE.label).toBe('สร้างใบขอซื้อ');
      expect(ACTION_MAP.CREATE.color).toContain('bg-blue-100');

      expect(ACTION_MAP.RESUBMIT.label).toBe('ส่งใบขอซื้ออีกครั้ง');
      expect(ACTION_MAP.RESUBMIT.color).toContain('bg-indigo-100');

      expect(ACTION_MAP.SEND_BACK.label).toBe('ส่งกลับเพื่อแก้ไข');
      expect(ACTION_MAP.SEND_BACK.color).toContain('bg-amber-100');

      expect(ACTION_MAP.REVIEW_FORWARD.label).toBe('ตรวจสอบผ่าน (ส่งต่อ)');
      expect(ACTION_MAP.REVIEW_FORWARD.color).toContain('bg-cyan-100');

      expect(ACTION_MAP.APPROVE.label).toBe('อนุมัติเรียบร้อย');
      expect(ACTION_MAP.APPROVE.color).toContain('bg-emerald-100');

      expect(ACTION_MAP.CANCEL.label).toBe('ยกเลิกคำขอ');
      expect(ACTION_MAP.CANCEL.color).toContain('bg-rose-100');
    });

    it('resolves raw action aliases cleanly', () => {
      expect(resolveAction('CREATE').label).toBe('สร้างใบขอซื้อ');
      expect(resolveAction('SUBMITTED').label).toBe('สร้างใบขอซื้อ');
      expect(resolveAction('RESUBMIT').label).toBe('ส่งใบขอซื้ออีกครั้ง');
      expect(resolveAction('PR_RESUBMITTED').label).toBe('ส่งใบขอซื้ออีกครั้ง');
      expect(resolveAction('SEND_BACK').label).toBe('ส่งกลับเพื่อแก้ไข');
      expect(resolveAction('REJECTED').label).toBe('ส่งกลับเพื่อแก้ไข');
      expect(resolveAction('REVIEW_FORWARD').label).toBe('ตรวจสอบผ่าน (ส่งต่อ)');
      expect(resolveAction('REVIEWED').label).toBe('ตรวจสอบผ่าน (ส่งต่อ)');
      expect(resolveAction('APPROVE').label).toBe('อนุมัติเรียบร้อย');
      expect(resolveAction('APPROVED').label).toBe('อนุมัติเรียบร้อย');
      expect(resolveAction('CANCEL').label).toBe('ยกเลิกคำขอ');
      expect(resolveAction('CANCELLED').label).toBe('ยกเลิกคำขอ');
    });

    it('translates standard roles to Thai professional titles', () => {
      expect(ROLE_MAP.requester).toBe('ผู้ขอซื้อ (Requester)');
      expect(ROLE_MAP.asst_manager).toBe('ผู้ช่วยผู้จัดการ (Asst. Mgr)');
      expect(ROLE_MAP.plant_mgr).toBe('ผู้จัดการโรงงาน (Plant Mgr)');
      expect(ROLE_MAP.purchaser).toBe('เจ้าหน้าที่จัดซื้อ (Purchaser)');

      expect(resolveRole('requester')).toBe('ผู้ขอซื้อ (Requester)');
      expect(resolveRole('asst_manager')).toBe('ผู้ช่วยผู้จัดการ (Asst. Mgr)');
      expect(resolveRole('Reviewer')).toBe('ผู้ช่วยผู้จัดการ (Asst. Mgr)');
      expect(resolveRole('plant_mgr')).toBe('ผู้จัดการโรงงาน (Plant Mgr)');
      expect(resolveRole('Approver')).toBe('ผู้จัดการโรงงาน (Plant Mgr)');
      expect(resolveRole('purchaser')).toBe('เจ้าหน้าที่จัดซื้อ (Purchaser)');
      expect(resolveRole('admin')).toBe('ผู้ดูแลระบบ (Admin)');
    });

    it('formats timestamps with Thai datetime suffix น.', () => {
      const isoTime = '2026-09-16T14:30:00.000Z';
      const formatted = formatEventTime(isoTime);
      expect(formatted).toContain('น.');

      const dmyTime = '16/09/2026 14:30';
      const formattedDmy = formatEventTime(dmyTime);
      expect(formattedDmy).toBe('16/09/2026 14:30 น.');
    });
  });

  describe('2. CollapsibleActivityTimeline Component Rendering', () => {
    it('renders all steps of full PR lifecycle chronologically with Thai badges and note cards', () => {
      const mockEvents = [
        {
          id: 'AL-1',
          action: 'CREATE',
          actor: 'สมชาย ผู้ขอซื้อ',
          role: 'requester',
          timestamp: '2026-09-16T08:00:00.000Z',
          note: 'สร้างใบขอซื้อและส่งตรวจสอบ'
        },
        {
          id: 'AL-2',
          action: 'SEND_BACK',
          actor: 'สมหมาย ผช.ผจก.',
          role: 'asst_manager',
          timestamp: '2026-09-16T09:00:00.000Z',
          note: 'กรุณาแนบใบเสนอราคาเพิ่มเติมอย่างน้อย 2 ราย'
        },
        {
          id: 'AL-3',
          action: 'RESUBMIT',
          actor: 'สมชาย ผู้ขอซื้อ',
          role: 'requester',
          timestamp: '2026-09-16T10:00:00.000Z',
          note: 'แก้ไขรายละเอียดเอกสารและส่งตรวจสอบใหม่อีกครั้ง แนบไฟล์เพิ่มแล้ว'
        },
        {
          id: 'AL-4',
          action: 'REVIEW_FORWARD',
          actor: 'สมหมาย ผช.ผจก.',
          role: 'asst_manager',
          timestamp: '2026-09-16T11:00:00.000Z',
          note: 'ตรวจสอบผ่าน ส่งต่อ Plant Mgr'
        },
        {
          id: 'AL-5',
          action: 'APPROVE',
          actor: 'สมศักดิ์ ผจก.โรงงาน',
          role: 'plant_mgr',
          timestamp: '2026-09-16T13:00:00.000Z',
          note: 'อนุมัติใบขอซื้อ ดำเนินการออก PO ต่อได้'
        }
      ];

      const html = renderToStaticMarkup(
        <CollapsibleActivityTimeline
          events={mockEvents}
          title="ลำดับเหตุการณ์ (Activity Timeline)"
          defaultExpanded={true}
          reverseOrder={false}
        />
      );

      // Verify all Thai action badges appear
      expect(html).toContain('สร้างใบขอซื้อ');
      expect(html).toContain('ส่งกลับเพื่อแก้ไข');
      expect(html).toContain('ส่งใบขอซื้ออีกครั้ง');
      expect(html).toContain('ตรวจสอบผ่าน (ส่งต่อ)');
      expect(html).toContain('อนุมัติเรียบร้อย');

      // Verify roles appear
      expect(html).toContain('ผู้ขอซื้อ (Requester)');
      expect(html).toContain('ผู้ช่วยผู้จัดการ (Asst. Mgr)');
      expect(html).toContain('ผู้จัดการโรงงาน (Plant Mgr)');

      // Verify note / reason boxes appear with exact text
      expect(html).toContain('กรุณาแนบใบเสนอราคาเพิ่มเติมอย่างน้อย 2 ราย');
      expect(html).toContain('อนุมัติใบขอซื้อ ดำเนินการออก PO ต่อได้');

      // Verify step count badge
      expect(html).toContain('5 ขั้นตอน');

      // Verify current step indicator
      expect(html).toContain('ขั้นตอนปัจจุบัน');
    });
  });
});
