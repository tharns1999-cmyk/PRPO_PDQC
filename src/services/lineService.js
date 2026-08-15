// LINE Authentication & LIFF Integration Service
import { ROLES, STORAGE_KEYS } from '../config/constants';

const LINE_PROFILE_KEY = 'prpo_line_profile';
const LINE_USERS_MAPPING_KEY = 'prpo_line_user_mappings';

// Default mock profiles for local dev & testing
export const DEFAULT_MOCK_LINE_USERS = [
  {
    lineUid: 'U4af4980629a8f2762e8731109a111111',
    displayName: 'Wichai (PD Staff)',
    pictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    roleId: 'REQUESTER_PD',
    department: 'PD',
    employeeName: 'คุณวิชัย (PD)',
    status: 'ACTIVE'
  },
  {
    lineUid: 'U4af4980629a8f2762e8731109a222222',
    displayName: 'Somying (QC Specialist)',
    pictureUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    roleId: 'REQUESTER_QC',
    department: 'QC',
    employeeName: 'คุณสมหญิง (QC)',
    status: 'ACTIVE'
  },
  {
    lineUid: 'U4af4980629a8f2762e8731109a333333',
    displayName: 'Somchai (Asst. Manager)',
    pictureUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    roleId: 'ASST_MANAGER',
    department: 'ALL',
    employeeName: 'คุณสมชาย (Asst. Mgr)',
    status: 'ACTIVE'
  },
  {
    lineUid: 'U4af4980629a8f2762e8731109a444444',
    displayName: 'Prasert (Plant Manager)',
    pictureUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    roleId: 'PLANT_MANAGER',
    department: 'ALL',
    employeeName: 'คุณประเสริฐ (Plant Mgr)',
    status: 'ACTIVE'
  },
  {
    lineUid: 'U4af4980629a8f2762e8731109a555555',
    displayName: 'Nat (Online Purchasing)',
    pictureUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    roleId: 'ONLINE_PURCHASER',
    department: 'ALL',
    employeeName: 'คุณนัท (Online Purchaser)',
    status: 'ACTIVE'
  },
  {
    lineUid: 'U4af4980629a8f2762e8731109a999999',
    displayName: 'System Administrator',
    pictureUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    roleId: 'ADMIN',
    department: 'ALL',
    employeeName: 'Admin System',
    status: 'ACTIVE'
  }
];

export const lineService = {
  // Get all user mappings
  getUserMappings() {
    try {
      const data = localStorage.getItem(LINE_USERS_MAPPING_KEY);
      return data ? JSON.parse(data) : DEFAULT_MOCK_LINE_USERS;
    } catch {
      return DEFAULT_MOCK_LINE_USERS;
    }
  },

  saveUserMappings(mappings) {
    localStorage.setItem(LINE_USERS_MAPPING_KEY, JSON.stringify(mappings));
  },

  // Get current logged-in LINE profile
  getCurrentProfile(currentRole) {
    try {
      const stored = localStorage.getItem(LINE_PROFILE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('[lineService] Failed to read stored profile', e);
    }

    // Default fallback mapped to current role
    const mappings = this.getUserMappings();
    const matched = mappings.find(m => m.roleId === currentRole?.id) || mappings[0];
    return {
      lineUid: matched.lineUid,
      displayName: matched.displayName,
      pictureUrl: matched.pictureUrl,
      roleId: matched.roleId,
      department: matched.department,
      employeeName: matched.employeeName,
      isLiff: false
    };
  },

  setCurrentProfile(profile) {
    localStorage.setItem(LINE_PROFILE_KEY, JSON.stringify(profile));
  },

  // Initialize LIFF if running in LINE app
  async initLiff(liffId) {
    if (typeof window !== 'undefined' && window.liff && liffId) {
      try {
        await window.liff.init({ liffId });
        if (window.liff.isLoggedIn()) {
          const profile = await window.liff.getProfile();
          const mappings = this.getUserMappings();
          const matched = mappings.find(m => m.lineUid === profile.userId);
          
          const activeProfile = {
            lineUid: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl || 'https://via.placeholder.com/150',
            roleId: matched ? matched.roleId : 'REQUESTER_PD',
            department: matched ? matched.department : 'PD',
            employeeName: matched ? matched.employeeName : profile.displayName,
            status: matched ? matched.status : 'PENDING_APPROVAL',
            isLiff: true
          };

          this.setCurrentProfile(activeProfile);
          return activeProfile;
        }
      } catch (err) {
        console.warn('[lineService] LIFF init skipped or failed:', err);
      }
    }
    return null;
  },

  // Bind or update a LINE UID to a system Role
  bindUserRole(lineUid, roleId, employeeName, department) {
    const mappings = this.getUserMappings();
    const index = mappings.findIndex(m => m.lineUid === lineUid);
    const updatedUser = {
      lineUid,
      displayName: employeeName,
      pictureUrl: mappings[index]?.pictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      roleId,
      department,
      employeeName,
      status: 'ACTIVE'
    };

    if (index >= 0) {
      mappings[index] = updatedUser;
    } else {
      mappings.push(updatedUser);
    }

    this.saveUserMappings(mappings);
    this.setCurrentProfile(updatedUser);
    return updatedUser;
  }
};
