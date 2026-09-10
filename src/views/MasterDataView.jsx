import React, { useState, useMemo, useEffect } from 'react';
import { Database, Plus, Edit3, Trash2, ShieldAlert, Building2, Search, X, Package, Store, PenTool, MapPin, Layers, Boxes, DoorClosed, Users, ShieldCheck, UserCheck, KeyRound, Lock, Shield } from 'lucide-react';
import ProductCRUDModal from '../components/admin/ProductCRUDModal';
import VendorCRUDModal from '../components/admin/VendorCRUDModal';
import StorageLocationCRUDModal from '../components/admin/StorageLocationCRUDModal';
import DeleteLocationModal from '../components/admin/DeleteLocationModal';
import UsageUnitCRUDModal from '../components/admin/UsageUnitCRUDModal';
import DepartmentCRUDModal from '../components/admin/DepartmentCRUDModal';
import UserCRUDModal from '../components/admin/UserCRUDModal';
import UserMasterView from './admin/UserMasterView';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { modalService } from '../services/modalService';
import Pagination from '../components/common/Pagination';

export default function MasterDataView(props) {
  const { currentUser, currentRole } = props;
  const userRole = currentUser?.role || (currentRole?.roleId === 'ADMIN' || currentRole?.id === 'ADMIN' || Number(currentRole?.level) >= 99 ? 'admin' : (currentRole?.roleId || 'user').toLowerCase());
  if (userRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white rounded-3xl border border-slate-200 shadow-sm my-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4 text-2xl font-bold">🔒</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">สิทธิ์การเข้าถึงถูกจำกัด (Restricted Access)</h2>
        <p className="text-sm text-slate-500 max-w-md">หน้าจัดการข้อมูลหลัก (Master Data) สงวนสิทธิ์สำหรับผู้ดูแลระบบ (System Admin) เท่านั้น</p>
      </div>
    );
  }

  return <MasterDataContent {...props} />;
}

function MasterDataContent({
  products = [],
  vendors = [],
  storageLocations: initialLocations = [],
  usageUnits: initialUnits = [],
  departments: initialDepartments = [],
  users: initialUsers = [],
  currentRole,
  currentUser,
  onRefresh,
  onSaveUsageUnit,
  onDeleteUsageUnit,
  onSaveDepartment,
  onDeleteDepartment,
  onSaveUser,
  onDeleteUser
}) {
  const [activeTab, setActiveTab] = useState('products');
  const [showProdModal, setShowProdModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showUsageUnitModal, setShowUsageUnitModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [editVendor, setEditVendor] = useState(null);
  const [editLocation, setEditLocation] = useState(null);
  const [editUsageUnit, setEditUsageUnit] = useState(null);
  const [editDept, setEditDept] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [deleteLocationItem, setDeleteLocationItem] = useState(null);
  const [locsList, setLocsList] = useState(() => {
    if (initialLocations && initialLocations.length > 0) return initialLocations;
    return storageService.getStorageLocations?.() || [];
  });
  const [unitsList, setUnitsList] = useState(() => {
    if (initialUnits && initialUnits.length > 0) return initialUnits;
    return storageService.getUsageUnits?.() || [];
  });
  const [departmentsList, setDepartmentsList] = useState(() => {
    if (initialDepartments && initialDepartments.length > 0) return initialDepartments;
    return storageService.getDepartments?.() || [];
  });
  const [usersList, setUsersList] = useState(() => {
    if (initialUsers && initialUsers.length > 0) return initialUsers;
    return storageService.getUsers?.() || [];
  });

  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setUsersList(initialUsers);
    } else {
      setUsersList(storageService.getUsers?.() || []);
    }
  }, [initialUsers]);

  useEffect(() => {
    if (initialUnits && initialUnits.length > 0) {
      setUnitsList(initialUnits);
    } else {
      setUnitsList(storageService.getUsageUnits?.() || []);
    }
  }, [initialUnits]);

  useEffect(() => {
    if (initialLocations && initialLocations.length > 0) {
      setLocsList(initialLocations);
    } else {
      setLocsList(storageService.getStorageLocations?.() || []);
    }
  }, [initialLocations, products]);

  useEffect(() => {
    if (initialDepartments && initialDepartments.length > 0) {
      setDepartmentsList(initialDepartments);
    } else {
      setDepartmentsList(storageService.getDepartments?.() || []);
    }
  }, [initialDepartments]);

  // Search & Dept Filter States
  const [prodSearch, setProdSearch] = useState('');
  const [prodCategoryFilter, setProdCategoryFilter] = useState(currentRole?.canViewAllDepts ? 'ALL' : currentRole?.department || 'ALL');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorDeptFilter, setVendorDeptFilter] = useState(currentRole?.canViewAllDepts ? 'ALL' : currentRole?.department || 'ALL');
  const [locSearch, setLocSearch] = useState('');
  const [locDeptFilter, setLocDeptFilter] = useState(currentRole?.canViewAllDepts ? 'ALL' : currentRole?.department || 'ALL');
  const [unitSearch, setUnitSearch] = useState('');
  const [unitDeptFilter, setUnitDeptFilter] = useState(currentRole?.canViewAllDepts ? 'ALL' : currentRole?.department || 'ALL');
  const [deptSearch, setDeptSearch] = useState('');
  const [deptStatusFilter, setDeptStatusFilter] = useState('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('ALL');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');

  // Pagination states
  const [prodPage, setProdPage] = useState(1);
  const [prodPageSize, setProdPageSize] = useState(10);
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorPageSize, setVendorPageSize] = useState(10);
  const [locPage, setLocPage] = useState(1);
  const [locPageSize, setLocPageSize] = useState(10);
  const [unitPage, setUnitPage] = useState(1);
  const [unitPageSize, setUnitPageSize] = useState(10);
  const [deptPage, setDeptPage] = useState(1);
  const [deptPageSize, setDeptPageSize] = useState(10);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);

  // Auto-resets on filter/search change
  useEffect(() => { setProdPage(1); }, [prodCategoryFilter, prodSearch, prodPageSize]);
  useEffect(() => { setVendorPage(1); }, [vendorDeptFilter, vendorSearch, vendorPageSize]);
  useEffect(() => { setLocPage(1); }, [locDeptFilter, locSearch, locPageSize]);
  useEffect(() => { setUnitPage(1); }, [unitDeptFilter, unitSearch, unitPageSize]);
  useEffect(() => { setDeptPage(1); }, [deptStatusFilter, deptSearch, deptPageSize]);
  useEffect(() => { setUserPage(1); }, [userDeptFilter, userRoleFilter, userSearch, userPageSize]);

  const canSeeAll = currentRole?.canViewAllDepts;
  const myDept = currentRole?.department;
  const isAdmin = currentRole?.id === 'ADMIN' || currentRole?.roleId === 'ADMIN' || Number(currentRole?.level) >= 99;
  const canDeleteMaster = currentRole?.canDeleteMaster || currentRole?.canManageMaster || isAdmin;


  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesDeptRole = canSeeAll || p.category === myDept;
      const matchesCategory = prodCategoryFilter === 'ALL' || p.category === prodCategoryFilter;
      const q = prodSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        p.code?.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.locationName?.toLowerCase().includes(q)
      );
      return matchesDeptRole && matchesCategory && matchesSearch;
    });
  }, [products, canSeeAll, myDept, prodCategoryFilter, prodSearch]);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesDeptRole = canSeeAll || v.department === myDept || v.department === 'BOTH';
      const matchesDeptFilter = vendorDeptFilter === 'ALL' || v.department === vendorDeptFilter || v.department === 'BOTH';
      const q = vendorSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        v.code?.toLowerCase().includes(q) ||
        v.name?.toLowerCase().includes(q) ||
        v.contactPerson?.toLowerCase().includes(q) ||
        v.phone?.toLowerCase().includes(q) ||
        v.taxId?.toLowerCase().includes(q)
      );
      return matchesDeptRole && matchesDeptFilter && matchesSearch;
    });
  }, [vendors, canSeeAll, myDept, vendorDeptFilter, vendorSearch]);

  // Filtered Storage Locations (Clean Simple by Name)
  const filteredLocations = useMemo(() => {
    return locsList.filter(l => {
      const matchesDeptRole = canSeeAll || l.department === myDept || l.department === 'ALL';
      const matchesDeptFilter = locDeptFilter === 'ALL' || l.department === locDeptFilter;
      const q = locSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        l.name?.toLowerCase().includes(q)
      );
      return matchesDeptRole && matchesDeptFilter && matchesSearch;
    });
  }, [locsList, canSeeAll, myDept, locDeptFilter, locSearch]);

  // Paginated collections
  const prodTotalPages = Math.ceil(filteredProducts.length / prodPageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (prodPage - 1) * prodPageSize;
    return filteredProducts.slice(start, start + prodPageSize);
  }, [filteredProducts, prodPage, prodPageSize]);

  const vendorTotalPages = Math.ceil(filteredVendors.length / vendorPageSize) || 1;
  const paginatedVendors = useMemo(() => {
    const start = (vendorPage - 1) * vendorPageSize;
    return filteredVendors.slice(start, start + vendorPageSize);
  }, [filteredVendors, vendorPage, vendorPageSize]);

  const locTotalPages = Math.ceil(filteredLocations.length / locPageSize) || 1;
  const paginatedLocations = useMemo(() => {
    const start = (locPage - 1) * locPageSize;
    return filteredLocations.slice(start, start + locPageSize);
  }, [filteredLocations, locPage, locPageSize]);

  // Filtered Usage Units (Department-Scoped Rooms)
  const filteredUsageUnits = useMemo(() => {
    return unitsList.filter(u => {
      const matchesDeptRole = canSeeAll || u.department === myDept;
      const matchesDeptFilter = unitDeptFilter === 'ALL' || u.department === unitDeptFilter;
      const q = unitSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        u.name?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q)
      );
      return matchesDeptRole && matchesDeptFilter && matchesSearch;
    });
  }, [unitsList, canSeeAll, myDept, unitDeptFilter, unitSearch]);

  const unitTotalPages = Math.ceil(filteredUsageUnits.length / unitPageSize) || 1;
  const paginatedUsageUnits = useMemo(() => {
    const start = (unitPage - 1) * unitPageSize;
    return filteredUsageUnits.slice(start, start + unitPageSize);
  }, [filteredUsageUnits, unitPage, unitPageSize]);

  // Filtered Users (Multi-department Access & RBAC)
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      // Dept filter: checks primaryDepartment or allowedDepartments
      const matchesDept = userDeptFilter === 'ALL' ||
        u.primaryDepartment === userDeptFilter ||
        u.department === userDeptFilter ||
        (Array.isArray(u.allowedDepartments) && (u.allowedDepartments.includes(userDeptFilter) || u.allowedDepartments.includes('*')));

      // Role filter
      const matchesRole = userRoleFilter === 'ALL' || u.roleId === userRoleFilter || u.positionKey === userRoleFilter;

      // Search
      const q = userSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        u.name?.toLowerCase().includes(q) ||
        u.employeeName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.employeeId?.toLowerCase().includes(q) ||
        u.title?.toLowerCase().includes(q)
      );

      return matchesDept && matchesRole && matchesSearch;
    });
  }, [usersList, userDeptFilter, userRoleFilter, userSearch]);

  const userTotalPages = Math.ceil(filteredUsers.length / userPageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, userPage, userPageSize]);

  // Dynamic Department Filter Options (No Hardcoding)
  const deptFilterOptions = useMemo(() => {
    return [
      { code: 'ALL', label: 'ทุกแผนก' },
      ...departmentsList.filter(d => d.isActive).map(d => ({
        code: d.code,
        label: `${d.name} (${d.code})`
      }))
    ];
  }, [departmentsList]);

  // Filtered Departments
  const filteredDepartments = useMemo(() => {
    return departmentsList.filter(d => {
      const matchesStatus = deptStatusFilter === 'ALL' || 
        (deptStatusFilter === 'ACTIVE' ? d.isActive : !d.isActive);
      const q = deptSearch.trim().toLowerCase();
      const matchesSearch = !q || (
        d.code?.toLowerCase().includes(q) ||
        d.name?.toLowerCase().includes(q) ||
        d.nameEn?.toLowerCase().includes(q) ||
        d.managerName?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q)
      );
      return matchesStatus && matchesSearch;
    });
  }, [departmentsList, deptStatusFilter, deptSearch]);

  const deptTotalPages = Math.ceil(filteredDepartments.length / deptPageSize) || 1;
  const paginatedDepartments = useMemo(() => {
    const start = (deptPage - 1) * deptPageSize;
    return filteredDepartments.slice(start, start + deptPageSize);
  }, [filteredDepartments, deptPage, deptPageSize]);

  const handleDeleteProduct = async (prod) => {
    if (!canDeleteMaster) return;
    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบสินค้า',
      message: `ต้องการลบรายการสินค้า "${prod.name}" (${prod.code}) ออกจากระบบหรือไม่?`,
      type: 'error',
      confirmText: 'ลบสินค้า',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;
    const prods = storageService.getProducts().filter(p => p.id !== prod.id);
    storageService.saveProducts(prods);
    modalService.success('ลบสินค้าสำเร็จ', `ลบ "${prod.name}" เรียบร้อยแล้ว`);
    onRefresh();
  };

  const handleDeleteVendor = async (vendor) => {
    if (!canDeleteMaster) return;
    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบผู้ขาย',
      message: `ต้องการลบข้อมูลผู้จัดจำหน่าย "${vendor.name}" ออกจากระบบหรือไม่?`,
      type: 'error',
      confirmText: 'ลบผู้ขาย',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;
    const vends = storageService.getVendors().filter(v => v.id !== vendor.id);
    storageService.saveVendors(vends);
    modalService.success('ลบผู้ขายสำเร็จ', `ลบ "${vendor.name}" เรียบร้อยแล้ว`);
    onRefresh();
  };

  // ─── Requirement 1: Data Integrity Guardrail on Delete ───
  const handleDeleteLocation = async (loc) => {
    if (!canDeleteMaster) return;
    
    // Check if any product is assigned to this storage location
    const allProds = storageService.getProducts();
    const assigned = allProds.filter(p => p.locationId === loc.id);
    
    if (assigned.length > 0) {
      return modalService.warning(
        'ไม่สามารถลบจุดเก็บนี้ได้',
        `เนื่องจากมีสินค้าผูกอยู่ ${assigned.length} รายการ กรุณาย้ายหรือเปลี่ยนจุดเก็บของสินค้าออกก่อน`
      );
    }

    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบจุดจัดเก็บ',
      message: `ต้องการลบจุดจัดเก็บสินค้า "${loc.name}" ออกจากระบบหรือไม่?`,
      type: 'error',
      confirmText: 'ลบจุดจัดเก็บ',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;

    try {
      await apiService.deleteStorageLocation(loc.id, currentRole?.name);
      modalService.success('ลบจุดจัดเก็บสำเร็จ', `ลบ "${loc.name}" เรียบร้อยแล้ว`);
      onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาด', err.message);
    }
  };

  const handleDeleteUsageUnit = async (unit) => {
    if (!canDeleteMaster) return;
    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบหน่วยเบิกใช้งาน',
      message: `ต้องการลบหน่วยเบิกใช้งาน "${unit.name}" (${unit.department}) ออกจากระบบหรือไม่?`,
      type: 'error',
      confirmText: 'ลบหน่วยเบิก',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;
    try {
      if (onDeleteUsageUnit) {
        await onDeleteUsageUnit(unit.id);
      } else {
        await apiService.deleteUsageUnit(unit.id, currentRole?.name);
      }
      setUnitsList(prev => prev.filter(u => u.id !== unit.id));
      modalService.success('ลบหน่วยเบิกสำเร็จ', `ลบ "${unit.name}" เรียบร้อยแล้ว`);
      if (onRefresh) onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาด', err.message);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!canDeleteMaster) return;

    // Self-lockout guard: Prevent user from deleting own account
    const isSelf = currentRole?.id === targetUser.id || currentRole?.username === targetUser.username;
    if (isSelf) {
      modalService.warning(
        'ไม่สามารถลบบัญชีตนเองได้',
        'ระบบมีมาตรการป้องกัน Self-Lockout Guard ห้ามลบหรือปิดการใช้งานบัญชีที่คุณกำลังเข้าสู่ระบบอยู่'
      );
      return;
    }

    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบผู้ใช้งาน',
      message: `ต้องการลบผู้ใช้งาน "${targetUser.name}" (@${targetUser.username || targetUser.employeeId}) ออกจากระบบหรือไม่?`,
      type: 'error',
      confirmText: 'ลบผู้ใช้งาน',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;

    try {
      if (onDeleteUser) {
        await onDeleteUser(targetUser.id);
      } else {
        await apiService.deleteUser(targetUser.id, currentRole?.name);
      }
      setUsersList(prev => prev.filter(u => u.id !== targetUser.id));
      modalService.success('ลบผู้ใช้งานสำเร็จ', `ลบผู้ใช้งาน "${targetUser.name}" เรียบร้อยแล้ว`);
      if (onRefresh) onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการลบผู้ใช้งาน', err.message);
    }
  };

  const roleBadge = (user) => {
    const rawRoleId = user?.roleId || user?.positionKey;
    // Normalize legacy department-coupled roleIds
    const roleId = (rawRoleId === 'REQUESTER_PD' || rawRoleId === 'REQUESTER_QC') ? 'REQUESTER' : rawRoleId;
    const colors = {
      ADMIN: 'bg-purple-50 text-purple-700 border-purple-200/80',
      PLANT_MANAGER: 'bg-rose-50 text-rose-700 border-rose-200/80',
      ASST_MANAGER: 'bg-violet-50 text-violet-700 border-violet-200/80',
      ONLINE_PURCHASER: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
      REQUESTER: 'bg-blue-50 text-blue-700 border-blue-200/80',
    };
    const title = user?.title || roleId || 'User';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${colors[roleId] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
        <Shield className="w-3.5 h-3.5" />
        <span>{title}</span>
      </span>
    );
  };

  const deptBadge = (deptCode) => {
    if (!deptCode) return null;
    if (deptCode === 'BOTH' || deptCode === 'ALL') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200/80">
          ส่วนกลาง (ALL)
        </span>
      );
    }
    const found = departmentsList.find(d => d.code === deptCode);
    const color = found?.color;
    const badgeStyle = color === 'amber'
      ? 'bg-amber-50 text-amber-700 border-amber-200/80'
      : color === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
      : color === 'purple'
      ? 'bg-purple-50 text-purple-700 border-purple-200/80'
      : color === 'cyan'
      ? 'bg-cyan-50 text-cyan-700 border-cyan-200/80'
      : 'bg-blue-50 text-blue-700 border-blue-200/80';

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle}`}>
        {found ? `${found.name} (${found.code})` : deptCode}
      </span>
    );
  };

  const handleSaveDepartment = async (deptData) => {
    try {
      if (onSaveDepartment) {
        await onSaveDepartment(deptData);
      } else {
        await apiService.saveDepartment(deptData, currentUser?.name || currentRole?.name);
      }
      setDepartmentsList(storageService.getDepartments());
      modalService.success(
        deptData.id ? 'แก้ไขข้อมูลแผนกสำเร็จ' : 'เพิ่มแผนกใหม่สำเร็จ',
        `บันทึกข้อมูลแผนก "${deptData.name}" (${deptData.code}) เรียบร้อยแล้ว`
      );
      if (onRefresh) onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการบันทึกแผนก', err.message);
    }
  };

  const handleToggleDeptStatus = async (dept) => {
    const updated = { ...dept, isActive: !dept.isActive };
    await handleSaveDepartment(updated);
  };

  const handleDeleteDepartment = async (dept) => {
    const allUsers = storageService.getUsers?.() || [];
    const assignedUsers = allUsers.filter(u => u.primaryDepartment === dept.code || u.department === dept.code);
    if (assignedUsers.length > 0) {
      return modalService.warning(
        'ไม่สามารถลบแผนกนี้ได้',
        `เนื่องจากมีผู้ใช้งานผูกอยู่กับแผนก ${dept.code} จำนวน ${assignedUsers.length} คน กรุณาย้ายแผนกของผู้ใช้ก่อน`
      );
    }

    const confirmed = await modalService.confirm({
      title: 'ยืนยันการลบแผนก',
      message: `ต้องการลบแผนก "${dept.name}" (${dept.code}) ออกจากระบบ Master Data หรือไม่?`,
      type: 'error',
      confirmText: 'ลบแผนก',
      cancelText: 'ยกเลิก'
    });
    if (!confirmed) return;

    try {
      if (onDeleteDepartment) {
        await onDeleteDepartment(dept.id);
      } else {
        await apiService.deleteDepartment(dept.id, currentUser?.name || currentRole?.name);
      }
      setDepartmentsList(prev => prev.filter(d => d.id !== dept.id && d.code !== dept.code));
      modalService.success('ลบแผนกสำเร็จ', `ลบแผนก "${dept.name}" เรียบร้อยแล้ว`);
      if (onRefresh) onRefresh();
    } catch (err) {
      modalService.error('เกิดข้อผิดพลาดในการลบแผนก', err.message);
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade-in pb-10">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-2xs">
                <Database className="w-5 h-5" />
              </div>
              <span>จัดการข้อมูลหลัก (Master Data)</span>
            </h2>
            {!canSeeAll && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
                <Building2 className="w-4 h-4" />
                แผนก {myDept}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            {canSeeAll
              ? 'จัดการและค้นหารายการสินค้า ข้อมูลผู้ขาย (Vendor) และจุดจัดเก็บสินค้าในคลัง'
              : `สิทธิ์เฉพาะแผนก ${myDept} — เพิ่ม/แก้ไขข้อมูลสินค้า จุดจัดเก็บ และ Vendor ของคุณ`}
          </p>
        </div>

        {/* Primary Action Button in Header */}
        <div className="flex items-center gap-2.5">
          {activeTab === 'products' ? (
            <button
              onClick={() => { setEditProd(null); setShowProdModal(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มสินค้าใหม่</span>
            </button>
          ) : activeTab === 'vendors' ? (
            <button
              onClick={() => { setEditVendor(null); setShowVendorModal(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มผู้ขายใหม่</span>
            </button>
          ) : activeTab === 'locations' ? (
            <button
              onClick={() => { setEditLocation(null); setShowLocationModal(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มจุดจัดเก็บใหม่</span>
            </button>
          ) : activeTab === 'usageUnits' ? (
            <button
              onClick={() => { setEditUsageUnit(null); setShowUsageUnitModal(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มหน่วยเบิกใหม่</span>
            </button>
          ) : activeTab === 'departments' ? (
            <button
              onClick={() => { setEditDept(null); setShowDeptModal(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มแผนกใหม่</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl w-fit border border-slate-200/60 shadow-2xs overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('products')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'products'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Package className="w-4 h-4 text-indigo-600" />
          <span>แคตตาล็อกสินค้า</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-600">
            {filteredProducts.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          aria-label="ผู้ขาย / Vendor"
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'vendors'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Store className="w-4 h-4 text-emerald-600" />
          <span>รายชื่อผู้ขาย / ร้านค้า</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-600">
            {filteredVendors.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'locations'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <MapPin className="w-4 h-4 text-violet-600" />
          <span>จุดจัดเก็บสินค้า</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-600">
            {filteredLocations.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('usageUnits')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'usageUnits'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <DoorClosed className="w-4 h-4 text-cyan-600" />
          <span>หน่วยเบิกใช้งาน / ห้อง</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-600">
            {filteredUsageUnits.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Users className="w-4 h-4 text-sky-600" />
          <span>ผู้ใช้งานและสิทธิ์</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-600">
            {filteredUsers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'departments'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Building2 className="w-4 h-4 text-blue-600" />
          <span>แผนก / ฝ่าย</span>
          <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-600">
            {departmentsList.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Products */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {canSeeAll && (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0 flex-wrap">
                {deptFilterOptions.map(cat => (
                  <button
                    key={cat.code}
                    onClick={() => setProdCategoryFilter(cat.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      prodCategoryFilter === cat.code
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
            <div className="relative flex-1 sm:w-80 ml-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหารหัส, ชื่อสินค้า, จุดเก็บ หรือโซน..."
                value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {prodSearch && (
                <button onClick={() => setProdSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5">✕</button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[580px] custom-scrollbar">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs shadow-2xs border-b border-slate-200/80 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 pl-5">รหัสสินค้า</th>
                    <th className="py-3 px-4 w-1/3">ชื่อสินค้า / สเปก & จุดจัดเก็บ</th>
                    <th className="py-3 px-4">แผนก</th>
                    <th className="py-3 px-4 text-right">ราคาต่อหน่วย</th>
                    <th className="py-3 px-4 text-right">สต็อกคงเหลือ</th>
                    <th className="py-3 px-4 text-right">จุดสั่งซื้อ (ROP)</th>
                    <th className="py-3 pr-5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-6 font-mono font-bold text-slate-800 text-xs">{p.code}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50/80 text-indigo-700 border border-indigo-100">
                            <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>{p.locationName || 'ไม่ระบุจุดจัดเก็บ'}</span>
                          </span>
                          {Number(p.conversionRate) > 1 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              1 {p.purchaseUnit || p.unit} = {p.conversionRate} {p.stockUnit || p.unit}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">{deptBadge(p.category)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        ฿{p.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-700 tabular-nums">
                        {p.stockBalance || 0} <span className="text-xs text-slate-400 font-sans">{p.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 tabular-nums">
                        {p.reorderPoint || 0} <span className="text-xs text-slate-400 font-sans">{p.unit}</span>
                      </td>
                      <td className="py-3.5 pr-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => { setEditProd(p); setShowProdModal(true); }}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขสินค้า"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {canDeleteMaster && (
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="ลบสินค้า"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={prodPage}
              totalPages={prodTotalPages}
              totalItems={filteredProducts.length}
              pageSize={prodPageSize}
              onPageChange={setProdPage}
              onPageSizeChange={setProdPageSize}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Vendors */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {canSeeAll && (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0 flex-wrap">
                {deptFilterOptions.map(cat => (
                  <button
                    key={cat.code}
                    onClick={() => setVendorDeptFilter(cat.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      vendorDeptFilter === cat.code
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
            <div className="relative flex-1 sm:w-80 ml-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อผู้ขาย, เบอร์โทร, เลขภาษี..."
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {vendorSearch && (
                <button onClick={() => setVendorSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5">✕</button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[580px] custom-scrollbar">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs shadow-2xs border-b border-slate-200/80 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 pl-5">รหัสผู้ขาย</th>
                    <th className="py-3 px-4 w-1/3">ชื่อบริษัท / ร้านค้า</th>
                    <th className="py-3 px-4">ผู้ติดต่อ</th>
                    <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                    <th className="py-3 px-4">แผนก</th>
                    <th className="py-3 pr-5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedVendors.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-6 font-mono font-bold text-slate-800 text-xs">{v.code}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{v.name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{v.contactPerson || '-'}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{v.phone || '-'}</td>
                      <td className="py-3.5 px-4">{deptBadge(v.department)}</td>
                      <td className="py-3.5 pr-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => { setEditVendor(v); setShowVendorModal(true); }}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขข้อมูลผู้ขาย"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {canDeleteMaster && (
                            <button
                              onClick={() => handleDeleteVendor(v)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="ลบผู้ขาย"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={vendorPage}
              totalPages={vendorTotalPages}
              totalItems={filteredVendors.length}
              pageSize={vendorPageSize}
              onPageChange={setVendorPage}
              onPageSizeChange={setVendorPageSize}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Storage Locations */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {canSeeAll && (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0 flex-wrap">
                {deptFilterOptions.map(cat => (
                  <button
                    key={cat.code}
                    onClick={() => setLocDeptFilter(cat.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      locDeptFilter === cat.code
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
            <div className="relative flex-1 sm:w-80 ml-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อจุดจัดเก็บสินค้า..."
                value={locSearch}
                onChange={e => setLocSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {locSearch && (
                <button onClick={() => setLocSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5">✕</button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[580px] custom-scrollbar">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs shadow-2xs border-b border-slate-200/80 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 pl-5 w-16">ลำดับ</th>
                    <th className="py-3 px-4 w-1/2">ชื่อจุดจัดเก็บสินค้า</th>
                    <th className="py-3 px-4">แผนกที่ใช้งาน</th>
                    <th className="py-3 px-4 text-center">จำนวนสินค้าที่จัดเก็บ</th>
                    <th className="py-3 pr-5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLocations.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-400">
                        ไม่พบข้อมูลจุดจัดเก็บสินค้าตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    paginatedLocations.map((loc, idx) => {
                      const assignedProducts = products.filter(p => p.locationId === loc.id);
                      return (
                        <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 pl-6 font-mono font-bold text-slate-400 text-xs whitespace-nowrap">
                            #{idx + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shrink-0 shadow-2xs">
                                <MapPin className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-slate-900 text-sm">{loc.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">{deptBadge(loc.department)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border tabular-nums ${
                              assignedProducts.length > 0
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}>
                              <Boxes className="w-3.5 h-3.5" />
                              <span>{assignedProducts.length} รายการ</span>
                            </span>
                          </td>
                          <td className="py-3.5 pr-6 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => { setEditLocation(loc); setShowLocationModal(true); }}
                                className="p-2 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
                                title="แก้ไขจุดจัดเก็บ"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {canDeleteMaster && (
                                <button
                                  onClick={() => setDeleteLocationItem(loc)}
                                  className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                                  title="ลบจุดจัดเก็บ"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={locPage}
              totalPages={locTotalPages}
              totalItems={filteredLocations.length}
              pageSize={locPageSize}
              onPageChange={setLocPage}
            />
          </div>
        </div>
      )}

      {/* Tab 4: Usage Units (Department-Scoped Rooms) */}
      {activeTab === 'usageUnits' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {canSeeAll && (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0 flex-wrap">
                {deptFilterOptions.map(cat => (
                  <button
                    key={cat.code}
                    onClick={() => setUnitDeptFilter(cat.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      unitDeptFilter === cat.code
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
                placeholder="ค้นหาชื่อหน่วยเบิก / ห้อง / รหัสหน่วย..."
                className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
              />
              {unitSearch && (
                <button
                  onClick={() => setUnitSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Units Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 pl-6">ชื่อหน่วยเบิก / ห้อง</th>
                    <th className="py-3.5 px-4 text-center">แผนก</th>
                    <th className="py-3.5 px-4">รหัสระบบ</th>
                    <th className="py-3.5 px-4 text-center">รูปแบบสีแท็ก (Color Pill)</th>
                    <th className="py-3.5 px-4 text-center">สถานะ</th>
                    <th className="py-3.5 pr-6 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {paginatedUsageUnits.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        <DoorClosed className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">ไม่พบรายการหน่วยเบิกใช้งาน</p>
                        <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือเพิ่มหน่วยเบิกใหม่</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsageUnits.map(unit => {
                      const dot = unit.dot || 'bg-slate-500';
                      const color = unit.color || 'bg-slate-50 text-slate-700 border-slate-200/80';
                      return (
                        <tr key={unit.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 pl-6 font-semibold text-slate-900">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                              <span className="text-sm font-bold text-slate-800">{unit.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {deptBadge(unit.department)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                            {unit.id}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${color}`}>
                              <span className={`w-2 h-2 rounded-full ${dot}`} />
                              <span>{unit.name}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              unit.status === 'INACTIVE'
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {unit.status === 'INACTIVE' ? 'ปิดใช้งาน' : 'ใช้งานปกติ'}
                            </span>
                          </td>
                          <td className="py-3.5 pr-6 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => { setEditUsageUnit(unit); setShowUsageUnitModal(true); }}
                                className="p-2 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
                                title="แก้ไขหน่วยเบิก"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {canDeleteMaster && (
                                <button
                                  onClick={() => handleDeleteUsageUnit(unit)}
                                  className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                                  title="ลบหน่วยเบิก"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={unitPage}
              totalPages={unitTotalPages}
              totalItems={filteredUsageUnits.length}
              pageSize={unitPageSize}
              onPageChange={setUnitPage}
            />
          </div>
        </div>
      )}

      {/* Tab 5: Users & E-Signature Management */}
      {activeTab === 'users' && (
        <UserMasterView 
          users={usersList} 
          departments={departmentsList}
          currentRole={currentRole} 
          currentUser={currentUser}
          onRefresh={() => {
            if (onRefresh) onRefresh();
            setUsersList(storageService.getUsers() || []);
          }} 
        />
      )}

      {/* Tab 6: Departments Master Data */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0">
              {[
                { id: 'ALL', label: 'ทุกสถานะ' },
                { id: 'ACTIVE', label: '✓ เปิดใช้งาน' },
                { id: 'INACTIVE', label: '⚠️ ระงับการใช้งาน' }
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setDeptStatusFilter(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    deptStatusFilter === st.id
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-80 ml-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหารหัสย่อ, ชื่อแผนก, ผู้จัดการ..."
                value={deptSearch}
                onChange={e => setDeptSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {deptSearch && (
                <button onClick={() => setDeptSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5">✕</button>
              )}
            </div>
          </div>

          {/* Departments Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200/70 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 pl-6">รหัสย่อ (Code)</th>
                    <th className="py-3.5 px-4">ชื่อแผนก / ฝ่าย (Department Name)</th>
                    <th className="py-3.5 px-4">คำนำหน้า (Prefix)</th>
                    <th className="py-3.5 px-4 text-right">งบประมาณ/เดือน</th>
                    <th className="py-3.5 px-4">ผู้จัดการ / หัวหน้าฝ่าย</th>
                    <th className="py-3.5 px-4 text-center">สถานะการใช้งาน</th>
                    <th className="py-3.5 pr-6 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedDepartments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600 text-sm">ไม่พบข้อมูลแผนก / ฝ่าย</p>
                        <p className="text-xs text-slate-400 mt-0.5">ลองปรับตัวกรองหรือเพิ่มแผนกใหม่เข้าสู่ระบบ</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedDepartments.map(dept => {
                      return (
                        <tr key={dept.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 pl-6 font-mono font-bold text-xs">
                            <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                              {dept.code}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div>
                              <span className="font-bold text-slate-900 text-sm">{dept.name}</span>
                              {dept.nameEn && (
                                <p className="text-[11px] text-slate-400 font-normal">{dept.nameEn}</p>
                              )}
                              {dept.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{dept.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-600">
                            {dept.prefix || dept.code}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                            ฿{(Number(dept.monthlyBudget) || 0).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 text-xs">
                            {dept.managerName ? (
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                <span>{dept.managerName}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleDeptStatus(dept)}
                              title="คลิกเพื่อสลับสถานะเปิด/ปิด"
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
                                dept.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {dept.isActive ? '✓ เปิดใช้งาน' : '⚠️ ระงับการใช้งาน'}
                            </button>
                          </td>
                          <td className="py-3.5 pr-6 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => { setEditDept(dept); setShowDeptModal(true); }}
                                className="p-2 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded-xl transition-colors cursor-pointer"
                                title="แก้ไขแผนก"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDepartment(dept)}
                                className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                                title="ลบแผนก"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={deptPage}
              totalPages={deptTotalPages}
              totalItems={filteredDepartments.length}
              pageSize={deptPageSize}
              onPageChange={setDeptPage}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {showProdModal && (
        <ProductCRUDModal
          editProd={editProd}
          product={editProd}
          products={products}
          vendors={vendors}
          departments={departmentsList}
          storageLocations={locsList}
          currentRole={currentRole}
          onClose={() => { setShowProdModal(false); setEditProd(null); }}
          onRefresh={onRefresh}
        />
      )}

      {showVendorModal && (
        <VendorCRUDModal
          editVendor={editVendor}
          vendor={editVendor}
          vendors={vendors}
          departments={departmentsList}
          currentRole={currentRole}
          onClose={() => { setShowVendorModal(false); setEditVendor(null); }}
          onRefresh={onRefresh}
        />
      )}

      {showLocationModal && (
        <StorageLocationCRUDModal
          editLocation={editLocation}
          location={editLocation}
          storageLocations={locsList}
          departments={departmentsList}
          currentRole={currentRole}
          onClose={() => { setShowLocationModal(false); setEditLocation(null); }}
          onSaved={(saved) => {
            setLocsList(prev => prev.map(l => l.id === saved.id ? saved : l));
            if (onRefresh) onRefresh();
          }}
          onCreated={(created) => {
            setLocsList(prev => [created, ...prev.filter(l => l.id !== created.id)]);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {deleteLocationItem && (
        <DeleteLocationModal
          location={deleteLocationItem}
          products={products}
          storageLocations={locsList}
          currentRole={currentRole}
          onClose={() => setDeleteLocationItem(null)}
          onDeleted={(deletedId) => {
            setLocsList(prev => prev.filter(l => l.id !== deletedId));
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {showUsageUnitModal && (
        <UsageUnitCRUDModal
          unit={editUsageUnit}
          usageUnits={unitsList}
          departments={departmentsList}
          currentRole={currentRole}
          onClose={() => { setShowUsageUnitModal(false); setEditUsageUnit(null); }}
          onSaved={(saved) => {
            setUnitsList(prev => prev.map(u => u.id === saved.id ? saved : u));
            if (onRefresh) onRefresh();
          }}
          onCreated={(created) => {
            setUnitsList(prev => [created, ...prev.filter(u => u.id !== created.id)]);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {showUserModal && (
        <UserCRUDModal
          user={editUser}
          users={usersList}
          departments={departmentsList}
          currentRole={currentRole}
          onClose={() => { setShowUserModal(false); setEditUser(null); }}
          onSaved={(saved) => {
            setUsersList(prev => prev.map(u => u.id === saved.id ? saved : u));
            if (onSaveUser) onSaveUser(saved);
            if (onRefresh) onRefresh();
          }}
          onCreated={(created) => {
            setUsersList(prev => [created, ...prev.filter(u => u.id !== created.id)]);
            if (onSaveUser) onSaveUser(created);
            if (onRefresh) onRefresh();
          }}
        />
      )}
      {showDeptModal && (
        <DepartmentCRUDModal
          department={editDept}
          departments={departmentsList}
          onClose={() => { setShowDeptModal(false); setEditDept(null); }}
          onSave={handleSaveDepartment}
        />
      )}
    </div>
  );
}
