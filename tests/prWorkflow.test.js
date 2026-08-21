import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { ROLES } from '../src/config/constants';
import { workflowEngine } from '../src/services/workflowEngine';
import { storageService } from '../src/services/storageService';

describe('Scenario 2: PR Lifecycle & Workflow Transitions', () => {
  beforeEach(() => {
    storageService.resetData();
  });

  it('PR Number Generation follows prefix + seq + year format', () => {
    const prNoPD = workflowEngine.generatePRNo('PD');
    const currentYear = new Date().getFullYear();
    expect(prNoPD).toMatch(new RegExp(`^PD\\d{3}/${currentYear}$`));

    const prNoQC = workflowEngine.generatePRNo('QC');
    expect(prNoQC).toMatch(new RegExp(`^QC\\d{3}/${currentYear}$`));
  });

  it('Submit PR changes status from DRAFT to SUBMITTED and appends activity log', async () => {
    // Setup products & a draft PR
    storageService.saveProducts([
      { id: 'PROD-1', code: 'P01', name: 'Item 1', category: 'PD', price: 1000, stockBalance: 10, unit: 'pcs' }
    ]);

    const createdPR = await workflowEngine.createPR({
      department: 'PD',
      source: 'FACTORY',
      purchaseChannel: 'SELF',
      requiredDate: '2026-09-01',
      items: [{ productId: 'PROD-1', code: 'P01', name: 'Item 1', qty: 5, price: 1000 }],
      totalAmount: 5000,
      reason: 'General production supply',
      isDraft: true
    }, ROLES.REQUESTER_PD);

    expect(createdPR.status).toBe('DRAFT');

    // Submit PR
    const submittedPR = await workflowEngine.submitPR(createdPR.id, ROLES.REQUESTER_PD);
    expect(submittedPR.status).toBe('SUBMITTED');
    expect(submittedPR.activityLog.some(l => l.action.includes('ส่งพิจารณา'))).toBe(true);

    // Check Assistant Manager can action SUBMITTED PR
    expect(workflowEngine.canAction(ROLES.ASST_MANAGER, submittedPR)).toBe(true);
    // Requester cannot action submitted PR (waiting for review)
    expect(workflowEngine.canAction(ROLES.REQUESTER_PD, submittedPR)).toBe(false);
  });

  it('Review Level 1: Asst Manager can REVIEW or REJECT_TO_DRAFT', async () => {
    const pr = await workflowEngine.createPR({
      department: 'QC',
      source: 'OFFICE',
      purchaseChannel: 'SELF',
      requiredDate: '2026-09-01',
      items: [{ productId: 'P-QC-1', code: 'QC01', name: 'QC Tube', qty: 2, price: 500 }],
      totalAmount: 1000,
      reason: 'Lab testing',
      isDraft: false
    }, ROLES.REQUESTER_QC);

    // Review Pass
    const { pr: reviewedPR } = await workflowEngine.updatePRStatus(pr.id, 'REVIEWED', ROLES.ASST_MANAGER, 'ข้อมูลครบถ้วน ผ่านการตรวจสอบ');
    expect(reviewedPR.status).toBe('REVIEWED');

    // Now Plant Manager can action
    expect(workflowEngine.canAction(ROLES.PLANT_MANAGER, reviewedPR)).toBe(true);
  });

  it('Reject to Draft sends PR back to Requester for modifications', async () => {
    const pr = await workflowEngine.createPR({
      department: 'PD',
      source: 'FACTORY',
      purchaseChannel: 'SELF',
      requiredDate: '2026-09-01',
      items: [{ productId: 'P1', code: 'P01', name: 'Item', qty: 10, price: 1000 }],
      totalAmount: 10000,
      reason: 'Test',
      isDraft: false
    }, ROLES.REQUESTER_PD);

    const { pr: rejectedPR } = await workflowEngine.updatePRStatus(pr.id, 'REJECTED_TO_DRAFT', ROLES.ASST_MANAGER, 'ขอปรับลดจำนวนลง');
    expect(rejectedPR.status).toBe('REJECTED_TO_DRAFT');

    // Requester can now action and edit again
    expect(workflowEngine.canAction(ROLES.REQUESTER_PD, rejectedPR)).toBe(true);

    // Requester edits and resubmits the PR with adjusted quantity
    const updatedPR = await workflowEngine.updatePR(rejectedPR.id, {
      department: 'PD',
      source: 'FACTORY',
      purchaseChannel: 'SELF',
      requiredDate: '2026-09-05',
      items: [{ productId: 'P1', code: 'P01', name: 'Item', qty: 5, price: 1000 }],
      note: 'ปรับลดจำนวนเหลือ 5 ชิ้นตามคำแนะนำ'
    }, ROLES.REQUESTER_PD, false);

    expect(updatedPR.status).toBe('SUBMITTED');
    expect(updatedPR.items[0].purchaseQty).toBe(5);
    expect(updatedPR.totalAmount).toBe(5000);
    expect(updatedPR.activityLog.some(l => l.action.includes('PR Resubmitted') || l.action.includes('แก้ไขและส่งใบ PR ใหม่'))).toBe(true);

    // Asst Manager can now review the resubmitted PR
    expect(workflowEngine.canAction(ROLES.ASST_MANAGER, updatedPR)).toBe(true);
  });
});
