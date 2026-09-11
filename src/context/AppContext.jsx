import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { notificationService } from '../services/notificationService';
import { workflowEngine } from '../services/workflowEngine';
import { authService, DEFAULT_EMPLOYEE_ACCOUNTS } from '../services/authService';
import { resolveUserPermissions } from '../config/constants';
import { modalService } from '../services/modalService';
import { getUserDepartments } from '../utils/permissions';

const AppContext = createContext(null);

// Route mapping table for legacy view ID translations
export const VIEW_PATH_MAP = {
  'dashboard': '/dashboard',
  'my-workspace': '/my-workspace',
  'my-work': '/my-workspace',
  'pr-list': '/prs',
  'prs': '/prs',
  'pr-create': '/prs/create',
  'po-list': '/pos',
  'pos': '/pos',
  'stock-card': '/inventory/stock-card',
  'warehouse': '/inventory/stock-card',
  'quick-issue': '/inventory/quick-issue',
  'budget': '/budget',
  'master-data': '/master-data',
  'online-tasks': '/online-tasks',
};

// Default fallback user (คุณวิชัย - Requester PD)
export const DEFAULT_USER = DEFAULT_EMPLOYEE_ACCOUNTS[0];

// Helper to get initial user with permissions enriched
const getInitialUserSession = () => {
  const existing = authService.getCurrentSession();
  if (existing) {
    const permissions = typeof existing.role === 'object' ? existing.role : resolveUserPermissions(existing);
    const isAdmin = existing.roleId === 'ADMIN' || existing.level >= 99 || existing.username === 'admin' || existing.role === 'admin';
    const cleanUserDepts = getUserDepartments(existing);
    const userDepts = cleanUserDepts.length > 0 ? cleanUserDepts : (existing.department ? [existing.department] : ['PD']);
    return {
      ...existing,
      departments: userDepts,
      assignedDepartments: existing.assignedDepartments || userDepts,
      allowedDepartments: existing.allowedDepartments || userDepts,
      primaryDepartment: existing.primaryDepartment || userDepts[0] || 'PD',
      department: existing.department || userDepts[0] || 'PD',
      role: isAdmin ? 'admin' : (typeof existing.role === 'string' ? existing.role : (existing.roleId || 'user').toLowerCase()),
      rolePermissions: permissions
    };
  }
  // Auto-Login fallback: Default User enriched with permissions
  const permissions = resolveUserPermissions(DEFAULT_USER);
  const isAdmin = DEFAULT_USER.roleId === 'ADMIN' || DEFAULT_USER.level >= 99 || DEFAULT_USER.username === 'admin';
  const sessionData = {
    ...DEFAULT_USER,
    ...permissions,
    role: isAdmin ? 'admin' : (DEFAULT_USER.roleId || 'user').toLowerCase(),
    rolePermissions: permissions
  };
  try {
    localStorage.setItem('prpo_auth_session', JSON.stringify(sessionData));
  } catch (e) {
    console.warn('[AppContext] Could not persist default user session:', e);
  }
  return sessionData;
};

export function AppProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // 1. Session & Auth State: Auto-login with fallback (Never null)
  const [currentUser, setCurrentUser] = useState(getInitialUserSession);
  const [currentRole, setCurrentRole] = useState(() => currentUser);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Available mock users for Fast Account Switcher
  const [users, setUsers] = useState([]);
  const availableUsers = useMemo(() => {
    return users.length > 0 ? users : (authService.getRegisteredUsers() || DEFAULT_EMPLOYEE_ACCOUNTS);
  }, [users]);

  // 2. Operational Data States
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [storageLocations, setStorageLocations] = useState([]);
  const [usageUnits, setUsageUnits] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [prs, setPRs] = useState([]);
  const [pos, setPOs] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [budgetTransactions, setBudgetTransactions] = useState([]);

  // 3. Selection, Modal & Draft States
  const [preselectedProduct, setPreselectedProduct] = useState(null);
  const [editingPR, setEditingPR] = useState(null);
  const [selectedPRForModal, setSelectedPRForModal] = useState(null);
  const [selectedPOForModal, setSelectedPOForModal] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // ── Full Data Hydration on Mount & Refresh (Parallel Backend REST Fetch) ──
  const loadAllData = useCallback(async () => {
    try {
      setIsDataLoading(true);
      
      const [
        prodsData,
        prsData,
        posData,
        budgetsData,
        locsData,
        logsData,
        notisData,
        vendorsData,
        unitsData,
        usersData,
        deptsData,
        txsData
      ] = await Promise.all([
        apiService.getProducts(),
        apiService.getPRs(),
        apiService.getPOs(),
        apiService.getBudgets(),
        apiService.getStorageLocations(),
        apiService.getStockLogs(),
        apiService.getNotifications(),
        apiService.getVendors(),
        apiService.getUsageUnits(),
        apiService.getUsers(),
        apiService.getDepartments(),
        apiService.getBudgetTransactions()
      ]);

      if (Array.isArray(prodsData)) {
        setProducts(prodsData);
      }
      if (Array.isArray(vendorsData)) {
        setVendors(vendorsData);
      }
      if (Array.isArray(locsData)) {
        setStorageLocations(locsData);
      }
      if (Array.isArray(unitsData)) {
        setUsageUnits(unitsData);
      }
      if (Array.isArray(deptsData)) {
        setDepartments(deptsData);
      }
      if (Array.isArray(txsData)) {
        setBudgetTransactions(txsData);
      }
      if (Array.isArray(usersData) && usersData.length > 0) {
        setUsers(usersData);
        setCurrentUser(prevUser => {
          if (!prevUser) return prevUser;
          const fresh = usersData.find(u => u.id === prevUser.id || u.username === prevUser.username);
          if (fresh) {
            const permissions = resolveUserPermissions(fresh);
            const isAdmin = fresh.roleId === 'ADMIN' || fresh.level >= 99 || fresh.username === 'admin';
            const cleanDepts = getUserDepartments(fresh);
            const userDepts = cleanDepts.length > 0 ? cleanDepts : (fresh.department ? [fresh.department] : ['PD']);
            const updatedSession = { 
              ...prevUser, 
              ...fresh, 
              ...permissions, 
              departments: userDepts,
              assignedDepartments: fresh.assignedDepartments || userDepts,
              allowedDepartments: fresh.allowedDepartments || userDepts,
              primaryDepartment: fresh.primaryDepartment || userDepts[0] || 'PD',
              department: fresh.department || userDepts[0] || 'PD',
              role: isAdmin ? 'admin' : (fresh.roleId || 'user').toLowerCase(),
              rolePermissions: permissions 
            };
            setCurrentRole(updatedSession);
            try { localStorage.setItem('prpo_auth_session', JSON.stringify(updatedSession)); } catch {}
            return updatedSession;
          }
          return prevUser;
        });
      }

      // Deduplicate PRs by id and prNo
      const seenPRKeys = new Set();
      const uniquePRs = (Array.isArray(prsData) ? prsData : []).filter(item => {
        const idKey = item.id;
        const noKey = item.prNo || item.prNumber;
        if ((idKey && seenPRKeys.has(idKey)) || (noKey && seenPRKeys.has(noKey))) {
          return false;
        }
        if (idKey) seenPRKeys.add(idKey);
        if (noKey) seenPRKeys.add(noKey);
        return true;
      });
      setPRs(uniquePRs);

      // Deduplicate POs by id and poNo
      const seenPOKeys = new Set();
      const uniquePOs = (Array.isArray(posData) ? posData : []).filter(item => {
        const idKey = item.id;
        const noKey = item.poNo || item.poNumber;
        if ((idKey && seenPOKeys.has(idKey)) || (noKey && seenPOKeys.has(noKey))) {
          return false;
        }
        if (idKey) seenPOKeys.add(idKey);
        if (noKey) seenPOKeys.add(noKey);
        return true;
      });
      setPOs(uniquePOs);

      if (Array.isArray(logsData)) {
        setStockLogs(logsData);
      }

      if (Array.isArray(notisData) && notisData.length > 0) {
        // Merge backend notifications with local read statuses so local mark-as-read is preserved
        const localNotifs = notificationService.getAll();
        const localReadMap = new Map();
        localNotifs.forEach(n => {
          if (n.isRead === true || n.read === true || n.status === 'read') {
            localReadMap.set(n.id || n._id, true);
          }
        });

        const merged = notisData.map(n => {
          if (localReadMap.has(n.id || n._id)) {
            return { ...n, isRead: true, read: true, status: 'read' };
          }
          return n;
        });

        setNotifications(merged);
        notificationService.saveAll(merged);
      } else {
        setNotifications(notificationService.getAll());
      }

      // Compute budget summary
      const bSummary = workflowEngine.calculateBudgetSummary();
      setBudgetSummary(bSummary || null);

    } catch (err) {
      console.error('[AppContext] Error loading all data from backend:', err);
    } finally {
      setIsDataLoading(false);
      setIsLoading(false);
    }
  }, []);

  // Backward compatible alias
  const refreshData = loadAllData;
  const initAppData = loadAllData;

  // Standalone fetchers ensuring clean overwrite without duplicate accumulation
  const fetchPRs = useCallback(async () => {
    try {
      const prData = await apiService.getPRs();
      const seenPRKeys = new Set();
      const uniquePRs = (prData || []).filter(item => {
        const idKey = item.id;
        const noKey = item.prNo || item.prNumber;
        if ((idKey && seenPRKeys.has(idKey)) || (noKey && seenPRKeys.has(noKey))) {
          return false;
        }
        if (idKey) seenPRKeys.add(idKey);
        if (noKey) seenPRKeys.add(noKey);
        return true;
      });
      setPRs(uniquePRs);
      return uniquePRs;
    } catch (err) {
      console.error('[AppContext] Error fetching PRs:', err);
      return [];
    }
  }, []);

  const fetchPOs = useCallback(async () => {
    try {
      const poData = await apiService.getPOs();
      const seenPOKeys = new Set();
      const uniquePOs = (poData || []).filter(item => {
        const idKey = item.id;
        const noKey = item.poNo || item.poNumber;
        if ((idKey && seenPOKeys.has(idKey)) || (noKey && seenPOKeys.has(noKey))) {
          return false;
        }
        if (idKey) seenPOKeys.add(idKey);
        if (noKey) seenPOKeys.add(noKey);
        return true;
      });
      setPOs(uniquePOs);
      return uniquePOs;
    } catch (err) {
      console.error('[AppContext] Error fetching POs:', err);
      return [];
    }
  }, []);

  // Initial Data Hydration on Component Mount (Strictly runs once on mount)
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Synchronize current role to storageService without triggering circular data fetch
  useEffect(() => {
    if (currentUser) {
      storageService.setCurrentRole(currentUser);
    }
  }, [currentUser]);

  /**
   * Fast Account Switcher:
   * Swaps user instantly, synchronizes localStorage, checks page permissions,
   * and auto-redirects to safe page if target user lacks access to current route.
   */
  const handleSwitchUser = useCallback((targetUserIdOrObject) => {
    let targetUser = null;

    if (typeof targetUserIdOrObject === 'string') {
      targetUser = availableUsers.find(u => 
        u.id === targetUserIdOrObject || 
        u.username === targetUserIdOrObject ||
        u.roleId === targetUserIdOrObject ||
        u.positionKey === targetUserIdOrObject
      );
    } else if (targetUserIdOrObject && typeof targetUserIdOrObject === 'object') {
      targetUser = targetUserIdOrObject;
    }

    if (!targetUser) {
      modalService.error('ไม่พบบัญชีผู้ใช้งานที่ต้องการสลับ');
      return;
    }

    const permissions = resolveUserPermissions(targetUser);
    const isAdmin = targetUser.roleId === 'ADMIN' || targetUser.level >= 99 || targetUser.username === 'admin';
    const cleanUserDepts = getUserDepartments(targetUser);
    const userDepts = cleanUserDepts.length > 0 ? cleanUserDepts : (targetUser.department ? [targetUser.department] : ['PD']);
    const newSession = {
      ...targetUser,
      ...permissions,
      departments: userDepts,
      assignedDepartments: targetUser.assignedDepartments || userDepts,
      allowedDepartments: targetUser.allowedDepartments || userDepts,
      primaryDepartment: targetUser.primaryDepartment || userDepts[0] || 'PD',
      department: targetUser.department || userDepts[0] || 'PD',
      role: isAdmin ? 'admin' : (targetUser.roleId || 'user').toLowerCase(),
      rolePermissions: permissions
    };

    // 1. Update global state
    setCurrentUser(newSession);
    setCurrentRole(newSession);

    // 2. Persist to storage
    localStorage.setItem('prpo_auth_session', JSON.stringify(newSession));
    storageService.setCurrentRole(newSession);

    modalService.success('สลับผู้ใช้งานสำเร็จ', `ยินดีต้อนรับ ${newSession.name} (${newSession.title})`);

    // 3. Dynamic Route Safety & Permission check on current path
    const currentPath = location.pathname;
    const isTargetOnlinePurchaser = newSession.roleId === 'ONLINE_PURCHASER' || newSession.id === 'ONLINE_PURCHASER';

    // Disallowed routes for online purchaser
    if (isTargetOnlinePurchaser && (
      currentPath.includes('/budget') || 
      currentPath.includes('/master-data') || 
      currentPath.includes('/prs/create') ||
      currentPath.includes('/inventory/quick-issue')
    )) {
      navigate('/online-tasks', { replace: true });
      return;
    }

    // Disallowed routes for non-online users trying to access online-tasks
    if (!newSession.canOnlinePurchase && currentPath.includes('/online-tasks')) {
      navigate('/dashboard', { replace: true });
      return;
    }

    // Disallowed routes for users without budget permissions
    if (!newSession.canViewBudget && currentPath.includes('/budget')) {
      navigate('/dashboard', { replace: true });
      return;
    }

    // Disallowed routes for users without master data permissions
    if (!newSession.canManageMaster && currentPath.includes('/master-data')) {
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [availableUsers, location.pathname, navigate]);

  // Reset to default user instead of logging out to a blank screen
  const handleLogout = useCallback(() => {
    handleSwitchUser(DEFAULT_USER.id);
  }, [handleSwitchUser]);

  // Unified onNavigate adapter: translates legacy view IDs or accepts direct paths
  const onNavigate = useCallback((target) => {
    if (!target) return;
    const resolvedPath = VIEW_PATH_MAP[target] || (target.startsWith('/') ? target : `/${target}`);
    
    // Reset temporary draft state when leaving create page
    if (!resolvedPath.includes('/prs/create') && target !== 'pr-create') {
      setEditingPR(null);
      setPreselectedProduct(null);
    }

    navigate(resolvedPath);
  }, [navigate]);

  // Action: Open Quick PR with preselected product
  const handleQuickPR = useCallback((product) => {
    setEditingPR(null);
    setPreselectedProduct(product);
    navigate('/prs/create');
  }, [navigate]);

  // Action: Edit existing PR
  const handleEditPR = useCallback((pr) => {
    setSelectedPRForModal(null);
    setPreselectedProduct(null);
    setEditingPR(pr);
    navigate('/prs/create');
  }, [navigate]);

  // Action: Deep-link PR Details Modal from notifications
  const handleOpenPRById = useCallback((prId) => {
    const found = prs.find(p => p.id === prId);
    if (found) {
      setSelectedPRForModal(found);
    } else {
      navigate('/prs');
    }
  }, [prs, navigate]);

  // Action: Deep-link PO Details Modal from notifications
  const handleOpenPOById = useCallback((poId) => {
    const found = pos.find(p => p.id === poId);
    if (found) {
      setSelectedPOForModal(found);
    } else {
      navigate('/pos');
    }
  }, [pos, navigate]);

  // ── Operational & Workflow Mutations (Await Backend API + LoadAllData) ──
  const handleCreatePR = useCallback(async (prPayload, isDraft = false) => {
    const newPR = await apiService.createPR(prPayload, currentRole, isDraft);
    await loadAllData();
    return newPR;
  }, [currentRole, loadAllData]);

  const handleUpdatePR = useCallback(async (prId, prPayload, isDraft = false) => {
    const updated = await apiService.updatePR(prId, prPayload, currentRole, isDraft);
    await loadAllData();
    return updated;
  }, [currentRole, loadAllData]);

  const handleRejectPR = useCallback(async (prId, reason) => {
    const result = await apiService.rejectPR(prId, currentRole, reason);
    await loadAllData();
    return result;
  }, [currentRole, loadAllData]);

  const handleReviewPR = useCallback(async (prId, note = '') => {
    const result = await apiService.updatePRStatus(prId, 'REVIEWED', currentRole, note);
    await loadAllData();
    return result;
  }, [currentRole, loadAllData]);

  const handleApprovePR = useCallback(async (prId, note = '') => {
    const result = await apiService.updatePRStatus(prId, 'APPROVED', currentRole, note);
    await loadAllData();
    return result;
  }, [currentRole, loadAllData]);

  // Immutable PO updater in state
  const updatePO = useCallback((poId, updates) => {
    setPOs(prev => prev.map(item => 
      (item.id === poId || item.poNo === poId || item.poNumber === poId) 
        ? { ...item, ...updates } 
        : item
    ));
  }, []);

  // Immutable PR updater in state with cascading support
  const updatePR = useCallback((prId, updates, isDraft = false) => {
    setPRs(prev => prev.map(item => 
      (item.id === prId || item.prNo === prId || item.prNumber === prId) 
        ? { ...item, ...(typeof updates === 'object' ? updates : {}) } 
        : item
    ));
    if (typeof updates === 'object') {
      if (updates.items) {
        return apiService.updatePR(prId, updates, currentRole, isDraft).then(() => loadAllData()).catch(e => console.warn(e));
      } else if (updates.status) {
        return apiService.updatePRStatus(prId, updates.status, currentRole).then(() => loadAllData()).catch(e => console.warn(e));
      }
    }
  }, [currentRole, loadAllData]);

  const handleReceiveGoods = useCallback(async (poId, receivingItems, note = '', options = {}) => {
    const grNumber = options?.grNumber || options?.grId || `GR-${poId}-${Date.now()}`;
    const enrichedOptions = { ...options, grNumber, grId: grNumber };

    const result = await apiService.receiveGoods(poId, receivingItems, currentRole, note, enrichedOptions);
    await loadAllData();
    return result;
  }, [currentRole, loadAllData]);

  const handleSaveProduct = useCallback(async (product) => {
    const targetId = String(product.id || '').trim().toLowerCase();
    const targetCode = String(product.code || '').trim().toLowerCase();
    setProducts(prev => {
      const idx = prev.findIndex(p => {
        const pId = String(p.id || '').trim().toLowerCase();
        const pCode = String(p.code || '').trim().toLowerCase();
        return (targetId && pId === targetId) || (targetCode && pCode === targetCode);
      });
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...product };
        return next;
      }
      return [product, ...prev];
    });
    const saved = await apiService.saveProduct(product, currentRole);
    await loadAllData();
    return saved;
  }, [currentRole, loadAllData]);

  const handleDeleteProduct = useCallback(async (productId) => {
    const targetStr = String(productId || '').trim().toLowerCase();
    setProducts(prev => prev.filter(p => {
      const pId = String(p.id || '').trim().toLowerCase();
      const pCode = String(p.code || '').trim().toLowerCase();
      return pId !== targetStr && pCode !== targetStr;
    }));
    const result = await apiService.deleteProduct(productId, currentRole);
    await loadAllData();
    return result;
  }, [currentRole, loadAllData]);

  const handleSaveVendor = useCallback(async (vendor) => {
    const targetId = String(vendor.id || '').trim().toLowerCase();
    const targetCode = String(vendor.code || '').trim().toLowerCase();
    setVendors(prev => {
      const idx = prev.findIndex(v => {
        const vId = String(v.id || '').trim().toLowerCase();
        const vCode = String(v.code || '').trim().toLowerCase();
        return (targetId && vId === targetId) || (targetCode && vCode === targetCode);
      });
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...vendor };
        return next;
      }
      return [vendor, ...prev];
    });
    const saved = await apiService.saveVendor(vendor, currentRole);
    await loadAllData();
    return saved;
  }, [currentRole, loadAllData]);

  const handleDeleteVendor = useCallback(async (vendorId) => {
    const targetStr = String(vendorId || '').trim().toLowerCase();
    setVendors(prev => prev.filter(v => {
      const vId = String(v.id || '').trim().toLowerCase();
      const vCode = String(v.code || '').trim().toLowerCase();
      return vId !== targetStr && vCode !== targetStr;
    }));
    const result = await apiService.deleteVendor(vendorId, currentRole);
    await loadAllData();
    return result;
  }, [currentRole, loadAllData]);

  const handleSaveStorageLocation = useCallback(async (location) => {
    const saved = await apiService.saveStorageLocation(location, currentRole);
    await loadAllData();
    return saved;
  }, [currentRole, loadAllData]);

  const handleDeleteStorageLocation = useCallback(async (locationId, options) => {
    const result = await apiService.deleteStorageLocation(locationId, options, currentRole);
    await loadAllData();
    return result;
  }, [currentRole, loadAllData]);

  const getUsageUnits = useCallback((department) => {
    if (!department || department === 'ALL') return usageUnits;
    return usageUnits.filter(u => u.department === department);
  }, [usageUnits]);

  const handleSaveUsageUnit = useCallback(async (unit) => {
    const saved = await apiService.saveUsageUnit(unit, currentRole?.name || currentUser?.name);
    await loadAllData();
    return saved;
  }, [currentRole, currentUser, loadAllData]);

  const handleDeleteUsageUnit = useCallback(async (unitId) => {
    const result = await apiService.deleteUsageUnit(unitId, currentRole?.name || currentUser?.name);
    await loadAllData();
    return result;
  }, [currentRole, currentUser, loadAllData]);

  const handleSaveDepartment = useCallback(async (deptPayload) => {
    const saved = await apiService.saveDepartment(deptPayload, currentUser?.name || currentRole?.name);
    await loadAllData();
    return saved;
  }, [currentUser, currentRole, loadAllData]);

  const handleDeleteDepartment = useCallback(async (deptId) => {
    const result = await apiService.deleteDepartment(deptId, currentUser?.name || currentRole?.name);
    await loadAllData();
    return result;
  }, [currentUser, currentRole, loadAllData]);

  const handleSaveUser = useCallback(async (userPayload) => {
    const saved = await apiService.saveUser(userPayload, currentUser?.name || currentRole?.name);
    await loadAllData();
    return saved;
  }, [currentUser, currentRole, loadAllData]);

  const handleDeleteUser = useCallback(async (userId) => {
    const result = await apiService.deleteUser(userId, currentUser?.name || currentRole?.name);
    await loadAllData();
    return result;
  }, [currentUser, currentRole, loadAllData]);

  const handleUpdateBudget = useCallback(async (department, newAmount, targetMonth) => {
    const updated = await apiService.updateBudget(department, newAmount, targetMonth);
    await loadAllData();
    return updated;
  }, [loadAllData]);

  const handleAdjustBudget = useCallback(async (params) => {
    const actor = currentUser?.name || currentRole?.name || 'ผู้ดูแลระบบ';
    const result = await apiService.adjustBudget({ ...params, actor });
    await loadAllData();
    return result;
  }, [currentUser, currentRole, loadAllData]);

  const handleMarkNotificationAsRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => (n.id === id || n._id === id) ? { ...n, isRead: true, read: true, status: 'read' } : n));
    if (notificationService?.markAsRead) {
      await notificationService.markAsRead(id);
    }
  }, []);

  const handleMarkAllNotificationsAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true, read: true, status: 'read' })));
    if (notificationService?.markAllAsRead) {
      await notificationService.markAllAsRead(currentRole);
    }
  }, [currentRole]);

  const handleClearNotifications = useCallback(() => {
    setNotifications([]);
    if (notificationService?.clearAll) {
      notificationService.clearAll();
    }
  }, []);

  const value = useMemo(() => ({
    currentUser,
    currentRole,
    setCurrentUser,
    setCurrentRole,
    availableUsers,
    handleSwitchUser,
    isAuthLoading,
    isDataLoading,
    isLoading,
    handleLogout,
    products,
    vendors,
    storageLocations,
    usageUnits,
    getUsageUnits,
    prs,
    pos,
    stockLogs,
    notifications,
    budgetSummary,
    loadAllData,
    initAppData,
    refreshData,
    fetchPRs,
    fetchPOs,
    updatePO,
    setPOs,
    createPR: handleCreatePR,
    updatePR,
    updatePRState: updatePR,
    handleUpdatePR: updatePR,
    rejectPR: handleRejectPR,
    reviewPR: handleReviewPR,
    approvePR: handleApprovePR,
    receivePOItems: handleReceiveGoods,
    receiveGoods: handleReceiveGoods,
    saveProduct: handleSaveProduct,
    updateProduct: handleSaveProduct,
    deleteProduct: handleDeleteProduct,
    saveVendor: handleSaveVendor,
    deleteVendor: handleDeleteVendor,
    saveStorageLocation: handleSaveStorageLocation,
    deleteStorageLocation: handleDeleteStorageLocation,
    saveUsageUnit: handleSaveUsageUnit,
    deleteUsageUnit: handleDeleteUsageUnit,
    departments,
    saveDepartment: handleSaveDepartment,
    deleteDepartment: handleDeleteDepartment,
    users,
    saveUser: handleSaveUser,
    deleteUser: handleDeleteUser,
    updateBudget: handleUpdateBudget,
    budgetTransactions,
    adjustBudget: handleAdjustBudget,
    markNotificationAsRead: handleMarkNotificationAsRead,
    markAllNotificationsAsRead: handleMarkAllNotificationsAsRead,
    setNotifications,
    clearNotifications: handleClearNotifications,
    preselectedProduct,
    setPreselectedProduct,
    clearPreselectedProduct: () => setPreselectedProduct(null),
    editingPR,
    setEditingPR,
    clearEditingPR: () => setEditingPR(null),
    handleQuickPR,
    handleEditPR,
    selectedPRForModal,
    setSelectedPRForModal,
    handleOpenPRById,
    selectedPOForModal,
    setSelectedPOForModal,
    handleOpenPOById,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    onNavigate,
  }), [
    currentUser,
    currentRole,
    availableUsers,
    handleSwitchUser,
    isAuthLoading,
    isDataLoading,
    isLoading,
    handleLogout,
    products,
    vendors,
    storageLocations,
    usageUnits,
    getUsageUnits,
    prs,
    pos,
    stockLogs,
    notifications,
    budgetSummary,
    loadAllData,
    fetchPRs,
    fetchPOs,
    updatePO,
    handleCreatePR,
    handleUpdatePR,
    handleRejectPR,
    handleReviewPR,
    handleApprovePR,
    handleReceiveGoods,
    handleSaveProduct,
    handleDeleteProduct,
    handleSaveVendor,
    handleDeleteVendor,
    handleSaveStorageLocation,
    handleDeleteStorageLocation,
    handleSaveUsageUnit,
    handleDeleteUsageUnit,
    departments,
    handleSaveDepartment,
    handleDeleteDepartment,
    users,
    handleSaveUser,
    handleDeleteUser,
    handleUpdateBudget,
    budgetTransactions,
    handleAdjustBudget,
    handleMarkNotificationAsRead,
    handleClearNotifications,
    preselectedProduct,
    editingPR,
    handleQuickPR,
    handleEditPR,
    selectedPRForModal,
    handleOpenPRById,
    selectedPOForModal,
    handleOpenPOById,
    isMobileSidebarOpen,
    onNavigate,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
