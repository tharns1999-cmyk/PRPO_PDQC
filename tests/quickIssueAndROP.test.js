import { describe, it, expect, beforeEach } from 'vitest';
import './setup.js';
import { ROLES } from '../src/config/constants';
import { workflowEngine } from '../src/services/workflowEngine';
import { storageService } from '../src/services/storageService';
import { notificationService } from '../src/services/notificationService';

describe('Scenario 5: Quick Stock Issue & Reorder Point (ROP) Alert Trigger', () => {
  beforeEach(() => {
    storageService.resetData();
    notificationService.clearAll();
    storageService.saveProducts([
      {
        id: 'PROD-N95',
        code: 'PD-MSK-01',
        name: 'หน้ากาก N95',
        category: 'PD',
        price: 450,
        stockBalance: 12,
        reorderPoint: 10,
        unit: 'กล่อง'
      }
    ]);
  });

  it('Quick Issue decrements stock balance and creates -OUT Stock Log', async () => {
    const updatedProd = await workflowEngine.quickIssueStock('PROD-N95', 2, ROLES.REQUESTER_PD, 'เบิกใช้ในไลน์ผลิต A');

    expect(updatedProd.stockBalance).toBe(10);

    const logs = storageService.getStockLogs();
    const issueLog = logs.find(l => l.productId === 'PROD-N95');
    expect(issueLog).toBeDefined();
    expect(issueLog.type).toBe('OUT');
    expect(issueLog.qty).toBe(2);
    expect(issueLog.balance).toBe(10);
  });

  it('Quick Issue throws error when requesting more than current balance', async () => {
    await expect(
      workflowEngine.quickIssueStock('PROD-N95', 50, ROLES.REQUESTER_PD, 'เบิกเกิน')
    ).rejects.toThrow(/จำนวนคงเหลือไม่พอเบิก/);
  });

  it('Automatic ROP Alert: Dispatches notification when balance drops <= reorderPoint', async () => {
    // Initial: 12, ROP: 10. Issue 3 items -> Balance becomes 9 (<= 10)
    await workflowEngine.quickIssueStock('PROD-N95', 3, ROLES.REQUESTER_PD, 'เบิกใช้งาน');

    const notis = notificationService.getAll();
    const ropAlert = notis.find(n => n.type === 'LOW_STOCK_ROP');

    expect(ropAlert).toBeDefined();
    expect(ropAlert.title).toContain('ROP Alert');
    expect(ropAlert.message).toContain('หน้ากาก N95');
    expect(ropAlert.targetRoles).toContain('ASST_MANAGER');
  });

  it('Quick Issue supports decimal / fractional quantities accurately (e.g. 1.25 liters)', async () => {
    // Add liquid product with 2400 liters
    const products = storageService.getProducts();
    products.push({
      id: 'PROD-OIL-01',
      code: 'PD-OIL-01',
      name: 'น้ำมันไฮดรอลิก',
      category: 'PD',
      price: 250,
      stockBalance: 2400,
      reorderPoint: 200,
      unit: 'ลิตร'
    });
    storageService.saveProducts(products);

    const updated = await workflowEngine.quickIssueStock('PROD-OIL-01', 1.25, ROLES.REQUESTER_PD, 'เติมเครื่องจักร 1.25 ลิตร');
    expect(updated.stockBalance).toBe(2398.75);

    const logs = storageService.getStockLogs();
    const oilLog = logs.find(l => l.productId === 'PROD-OIL-01');
    expect(oilLog).toBeDefined();
    expect(oilLog.qty).toBe(1.25);
    expect(oilLog.balance).toBe(2398.75);
  });
});
