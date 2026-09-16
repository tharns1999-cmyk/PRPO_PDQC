import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup.js';
import fs from 'fs';
import path from 'path';
import { apiService } from '../src/services/apiService';
import { storageService } from '../src/services/storageService';
import { workflowEngine } from '../src/services/workflowEngine';

describe('Performance & Atomic Response Architecture (<2s SLA)', () => {
  beforeEach(() => {
    if (typeof global.localStorage !== 'undefined') {
      global.localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  describe('1. Static Analysis & Guardrails for GAS Backend Files', () => {
    const gasDir = path.resolve(__dirname, '../gas');
    const gsFiles = fs.readdirSync(gasDir).filter(f => f.endsWith('.gs'));

    it('guarantees ZERO SpreadsheetApp.flush() calls across all GAS files', () => {
      const offendingFiles = [];
      gsFiles.forEach(file => {
        const content = fs.readFileSync(path.join(gasDir, file), 'utf8');
        if (content.includes('SpreadsheetApp.flush()')) {
          offendingFiles.push(file);
        }
      });
      expect(offendingFiles).toEqual([]);
    });

    it('guarantees ZERO sheet.deleteRow() calls across all GAS files', () => {
      const offendingFiles = [];
      gsFiles.forEach(file => {
        const content = fs.readFileSync(path.join(gasDir, file), 'utf8');
        if (/sheet\.deleteRow\s*\(/.test(content) || /attSheet\.deleteRow\s*\(/.test(content)) {
          offendingFiles.push(file);
        }
      });
      expect(offendingFiles).toEqual([]);
    });

    it('guarantees ZERO appendRow() calls across all GAS files (uses batch setValues)', () => {
      const offendingFiles = [];
      gsFiles.forEach(file => {
        const content = fs.readFileSync(path.join(gasDir, file), 'utf8');
        if (content.includes('.appendRow(')) {
          offendingFiles.push(file);
        }
      });
      expect(offendingFiles).toEqual([]);
    });

    it('strictly preserves Row 1 Header when clearing data rows (uses row 2 down)', () => {
      const sheetServiceContent = fs.readFileSync(path.join(gasDir, 'SheetService.gs'), 'utf8');
      const driveServiceContent = fs.readFileSync(path.join(gasDir, 'DriveService.gs'), 'utf8');

      // Check SheetService.gs
      expect(sheetServiceContent).toContain('sheet.getRange(2, 1, lastRow - 1,');
      expect(sheetServiceContent).not.toMatch(/sheet\.clearContent\s*\(\s*\)/);

      // Check DriveService.gs (Attachment reconciliation)
      expect(driveServiceContent).toContain('attSheet.getRange(2, 1, lastR - 1, lastC).clearContent()');
      expect(driveServiceContent).not.toMatch(/attSheet\.clearContent\s*\(\s*\)/);
    });

    it('verifies packageUpdatedPR helper exists and is used in Code.gs', () => {
      const codeGsContent = fs.readFileSync(path.join(gasDir, 'Code.gs'), 'utf8');
      expect(codeGsContent).toContain('function packageUpdatedPR(prObj)');
      expect(codeGsContent).toContain('return packageUpdatedPR(');
    });

    it('verifies packageUpdatedPO helper exists, structures receiver metadata, and is used in Code.gs', () => {
      const codeGsContent = fs.readFileSync(path.join(gasDir, 'Code.gs'), 'utf8');
      expect(codeGsContent).toContain('function packageUpdatedPO(poObj)');
      expect(codeGsContent).toContain('receiverName');
      expect(codeGsContent).toContain('receiverSignature');
      expect(codeGsContent).toContain('receivingInfo');
      expect(codeGsContent).toContain('return packageUpdatedPO(');
    });

    it('verifies apiReceiveStock and apiIssueStock RPCs exist in Code.gs', () => {
      const codeGsContent = fs.readFileSync(path.join(gasDir, 'Code.gs'), 'utf8');
      expect(codeGsContent).toContain('function apiReceiveStock(rawPayload, userContext)');
      expect(codeGsContent).toContain('function apiIssueStock(rawPayload, userContext)');
    });

    it('guarantees ZERO blocking await loadAllData() calls across AppContext.jsx and ReceivingModal.jsx', () => {
      const appContextContent = fs.readFileSync(path.resolve(__dirname, '../src/context/AppContext.jsx'), 'utf8');
      const receivingModalContent = fs.readFileSync(path.resolve(__dirname, '../src/views/inventory/ReceivingModal.jsx'), 'utf8');

      expect(appContextContent).not.toMatch(/await\s+loadAllData\s*\(/);
      expect(receivingModalContent).not.toMatch(/await\s+appContext\.loadAllData\s*\(/);
    });
  });

  describe('2. Frontend Atomic Response Processing & Storage Merging', () => {
    it('merges atomic GAS response data into PR when updatePRStatus succeeds', async () => {
      const mockPR = {
        id: 'PR-TEST-001',
        prNo: 'PR-2026-0001',
        department: 'PD',
        status: 'SUBMITTED',
        totalAmount: 1000,
        items: [{ id: 'PRI-1', name: 'Item 1', qty: 2, price: 500 }]
      };
      storageService.savePR(mockPR);

      // Mock window.google.script.run
      const mockGASPR = {
        ...mockPR,
        status: 'REVIEWED',
        reviewedBy: 'Reviewer Somchai',
        reviewedAt: '2026-09-16T06:00:00.000Z',
        timeline: [
          { action: 'CREATE', actor: 'User', timestamp: '2026-09-16T05:00:00.000Z' },
          { action: 'REVIEW_FORWARD', actor: 'Reviewer Somchai', timestamp: '2026-09-16T06:00:00.000Z' }
        ]
      };

    const createGASMock = (handlerFn) => {
      const runner = {
        withSuccessHandler(cb) {
          this._cb = cb;
          return this;
        },
        withFailureHandler(errCb) {
          this._errCb = errCb;
          return this;
        },
        apiReviewPR(...args) {
          handlerFn(this._cb, this._errCb, 'apiReviewPR', args);
        },
        apiRejectPR(...args) {
          handlerFn(this._cb, this._errCb, 'apiRejectPR', args);
        }
      };
      return runner;
    };

    global.window = {
      google: {
        script: {
          run: createGASMock((success, failure, fnName) => {
            if (fnName === 'apiReviewPR') {
              success({ success: true, data: mockGASPR });
            }
          })
        }
      }
    };

    const result = await apiService.updatePRStatus('PR-TEST-001', 'REVIEWED', { name: 'Reviewer Somchai', role: 'DEPT_APPROVER' }, 'Checked ok');
    expect(result.pr.status).toBe('REVIEWED');
    expect(result.pr.reviewedBy).toBe('Reviewer Somchai');
    expect(result.pr.timeline).toHaveLength(2);

    // Verify immediate local storage sync
    const cached = storageService.getPRs().find(p => p.id === 'PR-TEST-001');
    expect(cached.status).toBe('REVIEWED');
    expect(cached.reviewedBy).toBe('Reviewer Somchai');

    delete global.window;
  });

  it('merges atomic GAS response data into PR when rejectPR succeeds', async () => {
    const mockPR = {
      id: 'PR-TEST-002',
      prNo: 'PR-2026-0002',
      department: 'PD',
      status: 'SUBMITTED',
      totalAmount: 2000,
      items: []
    };
    storageService.savePR(mockPR);

    const mockGASPR = {
      ...mockPR,
      status: 'REJECTED_TO_DRAFT',
      rejectReason: 'Incomplete specifications',
      timeline: [
        { action: 'SEND_BACK', actor: 'Manager', comment: 'Incomplete specifications', timestamp: '2026-09-16T06:10:00.000Z' }
      ]
    };

    const createGASMock = (handlerFn) => {
      const runner = {
        withSuccessHandler(cb) {
          this._cb = cb;
          return this;
        },
        withFailureHandler(errCb) {
          this._errCb = errCb;
          return this;
        },
        apiRejectPR(...args) {
          handlerFn(this._cb, this._errCb, 'apiRejectPR', args);
        }
      };
      return runner;
    };

    global.window = {
      google: {
        script: {
          run: createGASMock((success, failure, fnName) => {
            if (fnName === 'apiRejectPR') {
              success({ success: true, data: mockGASPR });
            }
          })
        }
      }
    };

    const rejected = await apiService.rejectPR('PR-TEST-002', { name: 'Manager', role: 'PLANT_MGR' }, 'Incomplete specifications');
    expect(rejected.status).toBe('REJECTED_TO_DRAFT');
    expect(rejected.rejectReason).toBe('Incomplete specifications');
    expect(rejected.timeline[0].action).toBe('SEND_BACK');

    const cached = storageService.getPRs().find(p => p.id === 'PR-TEST-002');
    expect(cached.status).toBe('REJECTED_TO_DRAFT');

    delete global.window;
    });
  });
});
