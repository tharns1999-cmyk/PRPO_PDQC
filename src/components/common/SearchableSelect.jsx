import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = '-- เลือกรายการ --',
  searchPlaceholder = 'พิมพ์เพื่อค้นหา...',
  emptyMessage = 'ไม่พบข้อมูลที่ตรงกับการค้นหา',
  disabled = false,
  className = '',
  buttonClassName = '',
  required = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0, openUpward: false });

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find(opt => String(opt.value) === String(value));
  }, [options, value]);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.trim().toLowerCase();
    return options.filter(opt => {
      const matchLabel = opt.label?.toLowerCase().includes(q);
      const matchSub = opt.subLabel?.toLowerCase().includes(q);
      const matchCode = opt.code?.toLowerCase().includes(q);
      const matchKeywords = opt.keywords?.toLowerCase().includes(q);
      return matchLabel || matchSub || matchCode || matchKeywords;
    });
  }, [options, searchTerm]);

  // Calculate coordinates for portal dropdown
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownEstimatedHeight = 280;
    const openUpward = spaceBelow < dropdownEstimatedHeight && spaceAbove > spaceBelow;

    // Minimum width is trigger width or 320px for clear readability
    const width = Math.max(rect.width, 320);
    // Ensure dropdown stays within viewport horizontal bounds
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

    setDropdownCoords({
      top: openUpward ? rect.top - 6 : rect.bottom + 6,
      left,
      width,
      openUpward
    });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  // Update position on window resize and scroll events
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
    };
  }, [isOpen]);

  // Handle click outside to close (checks both trigger and portal dropdown)
  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const clickedDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);

      if (!clickedTrigger && !clickedDropdown) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex];
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (opt) => {
    if (opt.disabled) return;
    onChange(opt.value, opt);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < filteredOptions.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          type="text"
          value={value || ''}
          required={required}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full h-[44px] min-h-[44px] flex items-center justify-between text-left border rounded-xl px-3.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : isOpen
              ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
              : 'bg-white border-slate-300 hover:border-slate-400 text-slate-800 shadow-xs'
        } ${buttonClassName}`}
      >
        <div className="flex-1 min-w-0 pr-2 overflow-hidden">
          {selectedOption ? (
            <div className="flex items-center gap-2 min-w-0">
              {selectedOption.code && (
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                  {selectedOption.code}
                </span>
              )}
              <span className="font-semibold text-slate-800 truncate block text-sm">
                {selectedOption.label}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 font-medium truncate block">
              {placeholder}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Popup rendered in Portal on document.body (Never clipped by overflow-hidden) */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            left: `${dropdownCoords.left}px`,
            width: `${dropdownCoords.width}px`,
            top: dropdownCoords.openUpward ? 'auto' : `${dropdownCoords.top}px`,
            bottom: dropdownCoords.openUpward ? `${window.innerHeight - dropdownCoords.top}px` : 'auto',
            zIndex: 99999
          }}
          className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-zoom-in text-slate-800"
        >
          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/90">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto p-1.5 space-y-1 custom-scrollbar text-xs"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-950 font-bold border border-indigo-200/80'
                        : isHighlighted
                          ? 'bg-slate-100 text-slate-900 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                    } ${opt.disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {opt.code && (
                          <span className="font-mono font-bold text-[11px] text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded shrink-0">
                            {opt.code}
                          </span>
                        )}
                        <span className="font-bold text-slate-800 truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded border bg-indigo-100 text-indigo-800 border-indigo-200 shrink-0">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subLabel && (
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5 truncate">
                          {opt.subLabel}
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-1.5" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                {emptyMessage}
              </div>
            )}
          </div>

          {/* Footer count indicator */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>แสดง {filteredOptions.length} รายการ</span>
            <span className="text-slate-400">ใช้ปุ่มลูกศร ↑ ↓ เพื่อเลือก</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
