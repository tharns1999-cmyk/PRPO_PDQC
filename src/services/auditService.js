import { STORAGE_KEYS } from '../config/constants.js';

/**
 * Audit Service for tracking all system actions, document status changes, 
 * master data edits, stock movements, and signature updates.
 * Built to be 100% compatible with Google Apps Script (GAS) Web App & Google Sheets logging.
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
        clientEnv: 'React Web App (GAS Compatible)',
      };

      // Save to localStorage
      const existing = this.getLogs();
      const updated = [logEntry, ...existing].slice(0, 1000); // Keep latest 1000 logs
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS || 'prpo_audit_logs', JSON.stringify(updated));

      console.log(`[AuditService] Action logged: ${action} by ${actorName} (${docNo})`);

      // Optional GAS Webhook push if GAS URL is configured
      const gasUrl = localStorage.getItem('prpo_gas_webhook_url');
      if (gasUrl) {
        this.sendToGASWebhook(gasUrl, logEntry).catch(err => {
          console.warn('[AuditService] GAS Webhook sync failed (offline or unconfigured):', err);
        });
      }

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
  },

  /**
   * Format logs for Google Apps Script (GAS) doPost payload
   * Transforms logs into 2D Array format suitable for Google Sheets Range.setValues()
   */
  exportToGASPayload(filters = {}) {
    const logs = this.getLogs(filters);
    const headers = [
      'Log ID', 'Timestamp (ISO)', 'Date Time (TH)', 'Action', 
      'Doc Type', 'Doc No', 'Department', 'Actor Name', 
      'Actor Role', 'Details', 'Changes Context', 'Client Environment'
    ];

    const rows = logs.map(l => [
      l.id,
      l.timestamp,
      l.timeFormatted,
      l.action,
      l.docType,
      l.docNo,
      l.department,
      l.actorName,
      l.actorRole,
      l.details,
      l.changes,
      l.clientEnv
    ]);

    return {
      headers,
      rows,
      totalCount: rows.length,
      exportedAt: new Date().toISOString(),
    };
  },

  /**
   * Async push to Google Apps Script Web App Endpoint
   */
  async sendToGASWebhook(gasWebhookUrl, entry) {
    if (!gasWebhookUrl) return;
    try {
      await fetch(gasWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'AUDIT_LOG',
          payload: entry
        }),
        mode: 'no-cors' // Allows GAS Web App cross-origin requests
      });
    } catch (e) {
      console.warn('[AuditService] Webhook call failed:', e);
    }
  }
};
