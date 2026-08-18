import React, { useState, useEffect } from 'react';
import { storageService } from './services/storageService';
import { apiService } from './services/apiService';
import { authService } from './services/authService';
import Sidebar from './components/common/Sidebar';
import Navbar from './components/common/Navbar';
import LoginView from './components/auth/LoginView';
import PRDetailsModal from './components/pr/PRDetailsModal';
import PODetailsModal from './components/po/PODetailsModal';
import FeedbackModal from './components/common/FeedbackModal';

import DashboardView from './views/DashboardView';
import MyWorkView from './views/MyWorkView';
import PRListView from './views/PRListView';
import PRCreateView from './views/PRCreateView';
import POListView from './views/POListView';
import StockCardView from './views/StockCardView';
import QuickIssueView from './views/QuickIssueView';
import BudgetView from './views/BudgetView';
import MasterDataView from './views/MasterDataView';
import OnlineTaskView from './views/OnlineTaskView';

export default function App() {
  const [currentUser, setCurrentUser] = useState(authService.getCurrentSession());
  const [currentRole, setCurrentRole] = useState(currentUser || storageService.getCurrentRole());
  const [activeView, setActiveView] = useState(() => {
    const session = authService.getCurrentSession();
    if (session?.roleId === 'ONLINE_PURCHASER' || session?.id === 'ONLINE_PURCHASER') {
      return 'online-tasks';
    }
    return 'dashboard';
  });
  
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [prs, setPRs] = useState([]);
  const [pos, setPOs] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState(null);
  
  const [preselectedProduct, setPreselectedProduct] = useState(null);
  const [selectedPRForModal, setSelectedPRForModal] = useState(null);
  const [selectedPOForModal, setSelectedPOForModal] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Initialize Data
  const refreshData = async () => {
    storageService.init();
    const p = await apiService.getProducts();
    const v = await apiService.getVendors();
    const pr = await apiService.getPRs();
    const po = await apiService.getPOs();
    const log = await apiService.getStockLogs();
    const b = apiService.calculateBudgetSummary();

    setProducts(p);
    setVendors(v);
    setPRs(pr);
    setPOs(po);
    setStockLogs(log);
    setBudgetSummary(b);
  };

  useEffect(() => {
    if (currentUser) {
      refreshData();
    }
  }, [currentUser]);

  const handleLoginSuccess = (session) => {
    setCurrentUser(session);
    setCurrentRole(session);
    storageService.setCurrentRole(session);
    if (session?.roleId === 'ONLINE_PURCHASER' || session?.id === 'ONLINE_PURCHASER') {
      setActiveView('online-tasks');
    } else {
      setActiveView('dashboard');
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  const handleQuickPR = (product) => {
    setPreselectedProduct(product);
    setActiveView('pr-create');
  };

  // Deep linking handler from Notifications
  const handleOpenPRById = (prId) => {
    const found = prs.find(p => p.id === prId);
    if (found) {
      setSelectedPRForModal(found);
    } else {
      setActiveView('pr-list');
    }
  };

  const handleOpenPOById = (poId) => {
    const found = pos.find(p => p.id === poId);
    if (found) {
      setSelectedPOForModal(found);
    } else {
      setActiveView('po-list');
    }
  };

  // If user is not authenticated, show Login Screen
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex bg-[#f1f5f9] font-sans text-slate-900">
      {/* Fixed Sidebar Menu (Desktop) & Overlay Drawer (Mobile) */}
      <Sidebar
        activeView={activeView}
        setActiveView={(view) => {
          setActiveView(view);
          setIsMobileSidebarOpen(false);
        }}
        currentRole={currentRole}
        prs={prs}
        pos={pos}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64 transition-all duration-300">
        
        {/* Top Navbar with Notifications & Verified User Profile */}
        <Navbar
          currentRole={currentRole}
          onNavigate={setActiveView}
          onOpenPR={handleOpenPRById}
          onOpenPO={handleOpenPOById}
          onLogout={handleLogout}
          onRefresh={refreshData}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        />

        {/* Dynamic Content View Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-full mx-auto">
          {activeView === 'dashboard' && (
            <DashboardView
              prs={prs}
              pos={pos}
              products={products}
              budgetSummary={budgetSummary?.current}
              currentRole={currentRole}
              onNavigate={setActiveView}
              onQuickPR={handleQuickPR}
              onOpenPR={handleOpenPRById}
              onOpenPO={handleOpenPOById}
            />
          )}

          {activeView === 'my-workspace' && (
            <MyWorkView
              prs={prs}
              pos={pos}
              products={products}
              vendors={vendors}
              currentRole={currentRole}
              onNavigate={setActiveView}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'pr-list' && (
            <PRListView
              prs={prs}
              currentRole={currentRole}
              onRefresh={refreshData}
              onNavigate={setActiveView}
            />
          )}

          {activeView === 'pr-create' && (
            <PRCreateView
              products={products}
              currentRole={currentRole}
              onNavigate={setActiveView}
              onRefresh={refreshData}
              preselectedProduct={preselectedProduct}
              clearPreselectedProduct={() => setPreselectedProduct(null)}
            />
          )}

          {activeView === 'po-list' && (
            <POListView
              pos={pos}
              products={products}
              vendors={vendors}
              currentRole={currentRole}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'stock-card' && (
            <StockCardView
              products={products}
              stockLogs={stockLogs}
              currentRole={currentRole}
              onQuickPR={handleQuickPR}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'quick-issue' && (
            <QuickIssueView
              products={products}
              stockLogs={stockLogs}
              currentRole={currentRole}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'budget' && (
            <BudgetView
              budgetSummary={budgetSummary}
              currentRole={currentRole}
              prs={prs}
              pos={pos}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'master-data' && (
            <MasterDataView
              products={products}
              vendors={vendors}
              currentRole={currentRole}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'online-tasks' && (
            <OnlineTaskView
              currentRole={currentRole}
              onRefresh={refreshData}
            />
          )}
        </main>
      </div>

      {/* Global Deep-Linked PR Details Modal */}
      {selectedPRForModal && (
        <PRDetailsModal
          selectedPR={prs.find(p => p.id === selectedPRForModal.id) || selectedPRForModal}
          currentRole={currentRole}
          onClose={() => setSelectedPRForModal(null)}
          onRefresh={() => {
            refreshData();
          }}
        />
      )}

      {/* Global Deep-Linked PO Details Modal */}
      {selectedPOForModal && (
        <PODetailsModal
          selectedPO={pos.find(p => p.id === selectedPOForModal.id) || selectedPOForModal}
          currentRole={currentRole}
          onClose={() => setSelectedPOForModal(null)}
          onRefresh={() => {
            refreshData();
          }}
        />
      )}

      {/* Global In-App Feedback & Alert Modal System */}
      <FeedbackModal />
    </div>
  );
}
