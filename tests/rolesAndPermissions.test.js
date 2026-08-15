import { describe, it, expect } from 'vitest';
import './setup.js';
import { ROLES, PR_STATUS } from '../src/config/constants';
import { workflowEngine } from '../src/services/workflowEngine';

describe('Scenario 1: Roles & Permission Matrix', () => {
  it('Financial & Budget Visibility: Only Asst. Mgr, Plant Mgr, and Admin can view budget', () => {
    // Requesters cannot view budget
    expect(ROLES.REQUESTER_PD.canViewBudget).toBe(false);
    expect(ROLES.REQUESTER_PD.canViewBudgetMenu).toBe(false);
    expect(ROLES.REQUESTER_QC.canViewBudget).toBe(false);
    expect(ROLES.REQUESTER_QC.canViewBudgetMenu).toBe(false);

    // Online Purchaser cannot view budget
    expect(ROLES.ONLINE_PURCHASER.canViewBudget).toBe(false);
    expect(ROLES.ONLINE_PURCHASER.canViewBudgetMenu).toBe(false);

    // Asst Manager, Plant Manager, and Admin can view budget
    expect(ROLES.ASST_MANAGER.canViewBudget).toBe(true);
    expect(ROLES.ASST_MANAGER.canViewBudgetMenu).toBe(true);
    expect(ROLES.PLANT_MANAGER.canViewBudget).toBe(true);
    expect(ROLES.PLANT_MANAGER.canViewBudgetMenu).toBe(true);
    expect(ROLES.ADMIN.canViewBudget).toBe(true);
    expect(ROLES.ADMIN.canViewBudgetMenu).toBe(true);
  });

  it('Approval Hierarchy: Asst. Manager can Review, Plant Manager can Final Approve', () => {
    // Review Level 1
    expect(ROLES.REQUESTER_PD.canReview).toBe(false);
    expect(ROLES.ASST_MANAGER.canReview).toBe(true);
    expect(ROLES.PLANT_MANAGER.canReview).toBe(true);

    // Final Approve
    expect(ROLES.REQUESTER_PD.canFinalApprove).toBe(false);
    expect(ROLES.ASST_MANAGER.canFinalApprove).toBe(false);
    expect(ROLES.PLANT_MANAGER.canFinalApprove).toBe(true);
    expect(ROLES.ADMIN.canFinalApprove).toBe(true);
  });

  it('Online Purchaser Permissions: Restricted to Online Tasks', () => {
    expect(ROLES.ONLINE_PURCHASER.canOnlinePurchase).toBe(true);
    expect(ROLES.ONLINE_PURCHASER.canCreatePR).toBe(false);
    expect(ROLES.ONLINE_PURCHASER.canReceiveGoods).toBe(false);
  });

  it('Department Isolation: PD requester cannot action QC Draft PRs', () => {
    const qcDraftPR = { id: 'PR-1', department: 'QC', status: 'DRAFT', requestedBy: 'คุณวิชัย (PD)' };
    const pdDraftPR = { id: 'PR-2', department: 'PD', status: 'DRAFT', requestedBy: 'คุณวิชัย (PD)' };

    expect(workflowEngine.canAction(ROLES.REQUESTER_PD, qcDraftPR)).toBe(false);
    expect(workflowEngine.canAction(ROLES.REQUESTER_PD, pdDraftPR)).toBe(true);
  });

  it('Strict Workflow Role Separation: Plant Mgr does NOT action SUBMITTED, Asst Mgr does NOT action REVIEWED', () => {
    const submittedPR = { id: 'PR-SUB-1', prNo: 'PD001/2026', department: 'PD', status: 'SUBMITTED' };
    const reviewedPR = { id: 'PR-REV-1', prNo: 'PD001/2026', department: 'PD', status: 'REVIEWED' };

    // SUBMITTED PR: Only Asst Manager (Level 2) and Admin can action; Plant Manager (Level 3) cannot action!
    expect(workflowEngine.canAction(ROLES.ASST_MANAGER, submittedPR)).toBe(true);
    expect(workflowEngine.canAction(ROLES.PLANT_MANAGER, submittedPR)).toBe(false);
    expect(workflowEngine.canAction(ROLES.REQUESTER_PD, submittedPR)).toBe(false);
    expect(workflowEngine.canAction(ROLES.ONLINE_PURCHASER, submittedPR)).toBe(false);
    expect(workflowEngine.canAction(ROLES.ADMIN, submittedPR)).toBe(true);

    // REVIEWED PR: Only Plant Manager (Level 3) and Admin can action; Asst Manager (Level 2) cannot action!
    expect(workflowEngine.canAction(ROLES.PLANT_MANAGER, reviewedPR)).toBe(true);
    expect(workflowEngine.canAction(ROLES.ASST_MANAGER, reviewedPR)).toBe(false);
    expect(workflowEngine.canAction(ROLES.REQUESTER_PD, reviewedPR)).toBe(false);
    expect(workflowEngine.canAction(ROLES.ONLINE_PURCHASER, reviewedPR)).toBe(false);
    expect(workflowEngine.canAction(ROLES.ADMIN, reviewedPR)).toBe(true);
  });

  it('Draft Ownership Isolation: Another user in same dept cannot action colleague draft PR', () => {
    const colleagueDraft = { id: 'PR-DRAFT-2', prNo: 'PD002/2026', department: 'PD', status: 'DRAFT', requestedBy: 'คุณสมศักดิ์ (PD)' };

    // Current user is 'คุณวิชัย (PD)'
    expect(workflowEngine.canAction(ROLES.REQUESTER_PD, colleagueDraft)).toBe(false);
    expect(workflowEngine.canAction(ROLES.PLANT_MANAGER, colleagueDraft)).toBe(false);
    expect(workflowEngine.canAction(ROLES.ASST_MANAGER, colleagueDraft)).toBe(false);
    expect(workflowEngine.canAction(ROLES.ADMIN, colleagueDraft)).toBe(true);
  });

  it('Online PO Isolation: Only Online Purchaser actions IN_PROGRESS_ONLINE PO', () => {
    const onlinePO = { id: 'PO-ON-1', poNo: 'PO-PD-2026-001', department: 'PD', status: 'IN_PROGRESS_ONLINE', purchaseChannel: 'ONLINE' };

    expect(workflowEngine.canAction(ROLES.ONLINE_PURCHASER, onlinePO)).toBe(true);
    expect(workflowEngine.canAction(ROLES.REQUESTER_PD, onlinePO)).toBe(false);
    expect(workflowEngine.canAction(ROLES.ASST_MANAGER, onlinePO)).toBe(false);
    expect(workflowEngine.canAction(ROLES.PLANT_MANAGER, onlinePO)).toBe(false);
    expect(workflowEngine.canAction(ROLES.ADMIN, onlinePO)).toBe(true);
  });

  it('PR Cancellation Rules: Can cancel ONLY when the task is currently with the user', async () => {
    const draftPR = { id: 'PR-CAN-DRAFT', prNo: 'PD010/2026', department: 'PD', status: 'DRAFT', requestedBy: 'คุณวิชัย (PD)' };
    const submittedPR = { id: 'PR-CAN-SUB', prNo: 'PD011/2026', department: 'PD', status: 'SUBMITTED', requestedBy: 'คุณวิชัย (PD)' };
    const reviewedPR = { id: 'PR-CAN-REV', prNo: 'PD012/2026', department: 'PD', status: 'REVIEWED', requestedBy: 'คุณวิชัย (PD)' };
    const approvedPR = { id: 'PR-CAN-APP', prNo: 'PD013/2026', department: 'PD', status: 'APPROVED', requestedBy: 'คุณวิชัย (PD)' };

    // 1. DRAFT: Only owner can cancel
    expect(workflowEngine.canCancelPR(ROLES.REQUESTER_PD, draftPR)).toBe(true);
    expect(workflowEngine.canCancelPR(ROLES.REQUESTER_QC, draftPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.ASST_MANAGER, draftPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.PLANT_MANAGER, draftPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.ADMIN, draftPR)).toBe(true);

    // 2. SUBMITTED: Task is with Asst. Manager (Level 2). Requester & Plant Mgr CANNOT cancel!
    expect(workflowEngine.canCancelPR(ROLES.ASST_MANAGER, submittedPR)).toBe(true);
    expect(workflowEngine.canCancelPR(ROLES.REQUESTER_PD, submittedPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.PLANT_MANAGER, submittedPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.ONLINE_PURCHASER, submittedPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.ADMIN, submittedPR)).toBe(true);

    // 3. REVIEWED: Task is with Plant Manager (Level 3). Requester & Asst Mgr CANNOT cancel!
    expect(workflowEngine.canCancelPR(ROLES.PLANT_MANAGER, reviewedPR)).toBe(true);
    expect(workflowEngine.canCancelPR(ROLES.REQUESTER_PD, reviewedPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.ASST_MANAGER, reviewedPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.ONLINE_PURCHASER, reviewedPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.ADMIN, reviewedPR)).toBe(true);

    // 4. APPROVED / PO_ISSUED: Cannot cancel PR (must cancel PO)
    expect(workflowEngine.canCancelPR(ROLES.REQUESTER_PD, approvedPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.ASST_MANAGER, approvedPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.PLANT_MANAGER, approvedPR)).toBe(false);
    expect(workflowEngine.canCancelPR(ROLES.ADMIN, approvedPR)).toBe(false);
  });
});
