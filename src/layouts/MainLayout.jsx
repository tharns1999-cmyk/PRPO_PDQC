import React from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/common/Sidebar';
import PRDetailsModal from '../components/pr/PRDetailsModal';
import PODetailsModal from '../components/po/PODetailsModal';
import FeedbackModal from '../components/common/FeedbackModal';
import { useAppContext } from '../context/AppContext';

export default function MainLayout() {
  const {
    currentRole,
    prs,
    pos,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    onNavigate,
    handleOpenPRById,
    handleOpenPOById,
    handleLogout,
    refreshData,
    selectedPRForModal,
    setSelectedPRForModal,
    selectedPOForModal,
    setSelectedPOForModal,
    handleEditPR
  } = useAppContext();

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900">
      {/* ── Fixed Sidebar Menu (Desktop) & Overlay Drawer (Mobile) with integrated Notifications & Profile ── */}
      <Sidebar
        currentRole={currentRole}
        prs={prs}
        pos={pos}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onNavigate={onNavigate}
        onOpenPR={handleOpenPRById}
        onOpenPO={handleOpenPOById}
        onLogout={handleLogout}
        onRefresh={refreshData}
      />

      {/* ── Main Content Area (Clean layout starting from top edge) ── */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64 transition-all duration-300">
        
        {/* Mobile Header Bar (Compact & Minimal - Only shown on small screens) */}
        <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between no-print shadow-xs">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-1 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer active:scale-95"
              aria-label="Open Navigation Menu"
              title="เปิดเมนูการใช้งาน"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="font-bold text-slate-900 text-sm tracking-tight truncate">
              PR/PO & Inventory
            </div>
          </div>
          {currentRole?.department && currentRole.department !== 'ALL' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              currentRole.department === 'PD' 
                ? 'bg-blue-50 text-blue-700 border-blue-200/70' 
                : 'bg-amber-50 text-amber-700 border-amber-200/70'
            }`}>
              {currentRole.department}
            </span>
          )}
        </header>

        {/* Dynamic Content View Area with maximized vertical space */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Deep-Linked PR Details Modal */}
      {selectedPRForModal && (
        <PRDetailsModal
          selectedPR={prs.find(p => p.id === selectedPRForModal.id) || selectedPRForModal}
          currentRole={currentRole}
          onClose={() => setSelectedPRForModal(null)}
          onRefresh={refreshData}
          onEditPR={handleEditPR}
        />
      )}

      {/* Global Deep-Linked PO Details Modal */}
      {selectedPOForModal && (
        <PODetailsModal
          selectedPO={pos.find(p => p.id === selectedPOForModal.id) || selectedPOForModal}
          currentRole={currentRole}
          onClose={() => setSelectedPOForModal(null)}
          onRefresh={refreshData}
        />
      )}

      {/* Global In-App Feedback & Alert Modal System */}
      <FeedbackModal />
    </div>
  );
}
