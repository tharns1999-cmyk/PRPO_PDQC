import { STORAGE_KEYS } from '../config/constants.js';
import { logAuditEvent } from './auditLogger.js';

/**
 * Audit Service for tracking all system actions, document status changes, 
 * master data edits, stock movements, and signature updates.
 */
export const auditService = {
  /**
   * Log an audit event
   * @param {Object} params
   * @param {string} params.action - E.g. 'PR_SUBMITTED', 'PR_APPROVED', 'PO_CREATED', 'STOCK_MANUAL_IN', etc.
   * @param {Object|string} params.actor - User object or name string
   * @param {string} [params.department] - 'PD', 'QC', 'PURCHASING', etc.
   * @param {string} [params.docNo] - Document number or entity ID
   * @param {string} [params.docType] - 'PR', 'PO', 'PRODUCT', 'VENDOR', 'STOCK', 'BUDGET', 'SYSTEM'
   * @param {string} params.details - Detailed human-readable description
   * @param {Object} [params.changes] - { before, after } or extra key-value context
   */
  logAction({ action, actor, department, docNo, docType = 'SYSTEM', details, changes = null }) {
    try {
      const now = new Date();
      const actorName = typeof actor === 'object' 
        ? (actor.name || actor.title || actor.id || 'Unknown User') 
        : (actor || 'System');
      const actorRole = typeof actor === 'object' 
        ? (actor.title || actor.roleId || actor.id || 'N/A') 
        : 'System';
      const actorDept = department || (typeof actor === 'object' ? actor.department : 'SYSTEM') || 'GENERAL';

      const logEntry = {
        id: `AUDIT-${now.getTime()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: now.toISOString(),
        timeFormatted: now.toLocaleString('th-TH'),
        action,
        docNo: docNo || '-',
        docType,
        department: actorDept,
        actorName,
        actorRole,
        details: details || '',
        changes: changes ? JSON.stringify(changes) : '',
        clientEnv: 'React Web App',
      };

      // Save to localStorage
      const existing = this.getLogs();
      const updated = [logEntry, ...existing].slice(0, 1000); // Keep latest 1000 logs
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS || 'prpo_audit_logs', JSON.stringify(updated));

      // Also forward to centralized auditLogger for app_audit_logs
      try {
        const moduleMap = {
          PR: 'PURCHASE',
          PO: 'PURCHASE',
          STOCK: 'INVENTORY',
          PRODUCT: 'MASTER',
          VENDOR: 'MASTER',
          USAGE_UNIT: 'MASTER',
          DEPARTMENT: 'MASTER',
          USER: 'RBAC',
          SIGNATURE: 'RBAC',
          AUTH: 'RBAC',
          BUDGET: 'BUDGET'
        };
        const upperAct = String(action || '').toUpperCase();
        let normAction = 'UPDATE';
        if (upperAct.includes('APPROV')) normAction = 'APPROVE';
        else if (upperAct.includes('REJECT') || upperAct.includes('CANCEL')) normAction = 'REJECT';
        else if (upperAct.includes('RECEIV') || upperAct.includes('ISSUE')) normAction = 'RECEIVE';
        else if (upperAct.includes('CREATE') || upperAct.includes('NEW') || upperAct.includes('SUBMIT')) normAction = 'CREATE';
        else if (upperAct.includes('UPDATE') || upperAct.includes('EDIT') || upperAct.includes('SAVE')) normAction = 'UPDATE';

        logAuditEvent({
          action: normAction,
          module: moduleMap[docType] || 'SYSTEM',
          targetRef: docNo || '-',
          summary: details || `${action} (${docNo || '-'})`,
          changes,
          currentUser: typeof actor === 'object' ? actor : { name: actorName, role: actorRole, department: actorDept }
        });
      } catch (logErr) {
        console.warn('[AuditService] auditLogger sync error:', logErr);
      }

      console.log(`[AuditService] Action logged: ${action} by ${actorName} (${docNo})`);

      return logEntry;
    } catch (err) {
      console.error('[AuditService] Error writing audit log:', err);
      return null;
    }
  },

  /**
   * Get filtered audit logs
   */
  getLogs(filters = {}) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS || 'prpo_audit_logs');
      const logs = raw ? JSON.parse(raw) : [];

      return logs.filter(log => {
        if (filters.department && filters.department !== 'ALL' && log.department !== filters.department) {
          return false;
        }
        if (filters.docType && filters.docType !== 'ALL' && log.docType !== filters.docType) {
          return false;
        }
        if (filters.action && filters.action !== 'ALL' && log.action !== filters.action) {
          return false;
        }
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          const matchDoc = log.docNo.toLowerCase().includes(q);
          const matchActor = log.actorName.toLowerCase().includes(q);
          const matchDetails = log.details.toLowerCase().includes(q);
          const matchAction = log.action.toLowerCase().includes(q);
          if (!matchDoc && !matchActor && !matchDetails && !matchAction) return false;
        }
        return true;
      });
    } catch (err) {
      console.error('[AuditService] Error getting audit logs:', err);
      return [];
    }
  },

  /**
   * Clear all audit logs (Admin function)
   */
  clearLogs() {
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS || 'prpo_audit_logs');
    console.log('[AuditService] Audit logs cleared.');
  }
};
