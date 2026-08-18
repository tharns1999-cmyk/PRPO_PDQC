import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { modalService } from '../../services/modalService';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  HelpCircle, 
  X, 
  ArrowRight,
  MessageSquareQuote,
  Sparkles
} from 'lucide-react';

export default function FeedbackModal() {
  const [modalState, setModalState] = useState(null);
  const [promptInput, setPromptInput] = useState('');
  const [inputError, setInputError] = useState('');
  const inputRef = useRef(null);
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    const unsubscribe = modalService.subscribe((state) => {
      setModalState(state);
      if (state?.mode === 'prompt') {
        setPromptInput(state.defaultValue || '');
        setInputError('');
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (modalState) {
      if (modalState.mode === 'prompt') {
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        setTimeout(() => confirmButtonRef.current?.focus(), 50);
      }
    }
  }, [modalState]);

  // Handle Keyboard Navigation (Esc to close, Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!modalState) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (modalState.mode === 'confirm' || modalState.mode === 'prompt') {
          modalState.onCancel();
        } else {
          modalState.onClose();
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (modalState.mode === 'prompt') {
          // If prompt has input, submit
          if (e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            handlePromptSubmit();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalState, promptInput]);

  if (!modalState) return null;

  const handlePromptSubmit = () => {
    if (modalState.required && !promptInput.trim()) {
      setInputError('กรุณากรอกข้อมูลในช่องนี้');
      inputRef.current?.focus();
      return;
    }
    modalState.onConfirm(promptInput.trim());
  };

  const getVariantStyles = () => {
    const type = modalState.type || 'info';
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle2,
          iconBg: 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/30',
          badgeText: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          confirmBtn: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/25',
          defaultTitle: 'ดำเนินการสำเร็จ'
        };
      case 'error':
      case 'danger':
        return {
          icon: AlertOctagon,
          iconBg: 'bg-gradient-to-tr from-rose-500 to-red-600 text-white shadow-rose-500/30',
          badgeText: 'text-rose-700 bg-rose-50 border-rose-200',
          confirmBtn: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-rose-600/25',
          defaultTitle: 'เกิดข้อผิดพลาด'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-500/30',
          badgeText: 'text-amber-700 bg-amber-50 border-amber-200',
          confirmBtn: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-amber-600/25',
          defaultTitle: 'ข้อควรระวัง / แจ้งเตือน'
        };
      case 'info':
      default:
        return {
          icon: modalState.mode === 'prompt' ? MessageSquareQuote : Info,
          iconBg: 'bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white shadow-indigo-500/30',
          badgeText: 'text-indigo-700 bg-indigo-50 border-indigo-200',
          confirmBtn: 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-indigo-600/25',
          defaultTitle: modalState.mode === 'prompt' ? 'ระบุรายละเอียด' : 'ข้อมูลระบบ'
        };
    }
  };

  const variant = getVariantStyles();
  const IconComponent = variant.icon;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      {/* Blurred Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
        onClick={() => {
          if (modalState.mode === 'confirm' || modalState.mode === 'prompt') {
            modalState.onCancel();
          } else {
            modalState.onClose();
          }
        }}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden transform transition-all animate-zoom-in z-10">
        {/* Subtle Top Accent Border */}
        <div className={`h-1.5 w-full ${
          modalState.type === 'success' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
          modalState.type === 'error' ? 'bg-gradient-to-r from-rose-500 to-red-600' :
          modalState.type === 'warning' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
          'bg-gradient-to-r from-indigo-500 to-purple-500'
        }`} />

        <div className="p-6 sm:p-7">
          {/* Header Area */}
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl shadow-lg shrink-0 ${variant.iconBg}`}>
              <IconComponent className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug tracking-tight">
                  {modalState.title || variant.defaultTitle}
                </h3>
                <button
                  onClick={() => {
                    if (modalState.mode === 'confirm' || modalState.mode === 'prompt') {
                      modalState.onCancel();
                    } else {
                      modalState.onClose();
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Message Body */}
              <div className="mt-2.5 text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                {modalState.message}
              </div>
            </div>
          </div>

          {/* Prompt Input Form (When Mode is 'prompt') */}
          {modalState.mode === 'prompt' && (
            <div className="mt-5 space-y-2">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={promptInput}
                  onChange={(e) => {
                    setPromptInput(e.target.value);
                    if (inputError) setInputError('');
                  }}
                  placeholder={modalState.placeholder}
                  rows={modalState.rows || 3}
                  className={`w-full px-4 py-3 rounded-2xl border bg-slate-50/50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 transition-all resize-none ${
                    inputError 
                      ? 'border-rose-400 focus:ring-rose-400 focus:border-rose-400' 
                      : 'border-slate-200 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                />
              </div>
              {inputError && (
                <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                  <span>{inputError}</span>
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-7 flex items-center justify-end gap-3">
            {(modalState.mode === 'confirm' || modalState.mode === 'prompt') && (
              <button
                type="button"
                onClick={modalState.onCancel}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
              >
                {modalState.cancelText || 'ยกเลิก'}
              </button>
            )}

            <button
              ref={confirmButtonRef}
              type="button"
              onClick={() => {
                if (modalState.mode === 'prompt') {
                  handlePromptSubmit();
                } else {
                  modalState.onConfirm();
                }
              }}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center gap-2 cursor-pointer ${variant.confirmBtn}`}
            >
              <span>{modalState.confirmText || 'ตกลง'}</span>
              <ArrowRight className="w-4 h-4 opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
