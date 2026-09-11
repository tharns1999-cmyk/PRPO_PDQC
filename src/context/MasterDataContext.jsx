import React, { createContext, useContext, useMemo } from 'react';
import { useAppContext } from './AppContext';
import { storageService } from '../services/storageService';

const MasterDataContext = createContext(null);

export function MasterDataProvider({ children }) {
  const app = useAppContext ? useAppContext() : {};

  const value = useMemo(() => ({
    products: app?.products || storageService.getProducts() || [],
    vendors: app?.vendors || storageService.getVendors() || [],
    departments: app?.departments || storageService.getDepartments() || [],
    storageLocations: app?.storageLocations || storageService.getStorageLocations() || [],
    usageUnits: app?.usageUnits || storageService.getUsageUnits() || [],
    saveProduct: app?.saveProduct,
    saveVendor: app?.saveVendor,
    deleteProduct: app?.deleteProduct,
    deleteVendor: app?.deleteVendor
  }), [app]);

  return (
    <MasterDataContext.Provider value={value}>
      {children}
    </MasterDataContext.Provider>
  );
}

export const useMasterDataContext = () => {
  const ctx = useContext(MasterDataContext);
  if (!ctx) {
    return {
      products: storageService.getProducts() || [],
      vendors: storageService.getVendors() || [],
      departments: storageService.getDepartments() || [],
      storageLocations: storageService.getStorageLocations() || [],
      usageUnits: storageService.getUsageUnits() || []
    };
  }
  return ctx;
};

export default MasterDataContext;
