import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange
}) {
  if (totalItems === 0) return null;

  const validTotalPages = Math.max(1, totalPages);
  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis for cleaner Linear/SaaS aesthetic
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (validTotalPages <= maxVisible) {
      for (let i = 1; i <= validTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(validTotalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < validTotalPages - 2) pages.push('...');
      if (!pages.includes(validTotalPages)) pages.push(validTotalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 bg-slate-50/70 text-xs text-slate-600 select-none">
      {/* Left: Summary */}
      <div className="font-normal text-slate-500">
        แสดง <span className="font-mono font-medium text-slate-800">{startItem}</span> - <span className="font-mono font-medium text-slate-800">{endItem}</span> จากทั้งหมด <span className="font-mono font-semibold text-slate-900">{totalItems.toLocaleString()}</span> รายการ
      </div>

      {/* Right: Controls & Page Info */}
      <div className="flex items-center gap-2">
        {/* Subtle Page Indicator Badge */}
        <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200/80 shadow-2xs font-mono">
          หน้า <strong className="text-slate-800">{currentPage}</strong> / {validTotalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange && onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs text-xs font-medium"
          title="หน้าก่อนหน้า"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">ก่อนหน้า</span>
        </button>

        {validTotalPages > 1 && (
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, idx) => {
              if (page === '...') {
                return (
                  <span key={`dots-${idx}`} className="px-1 text-slate-400 font-mono text-xs">
                    ...
                  </span>
                );
              }
              const isActive = page === currentPage;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => onPageChange && onPageChange(page)}
                  className={`min-w-[28px] h-7 px-2 font-mono text-xs rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => onPageChange && onPageChange(currentPage + 1)}
          disabled={currentPage >= validTotalPages}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs text-xs font-medium"
          title="หน้าถัดไป"
          aria-label="Next Page"
        >
          <span className="hidden sm:inline">ถัดไป</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
