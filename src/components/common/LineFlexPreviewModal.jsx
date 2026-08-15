import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, Copy, Check, ExternalLink, Smartphone, Code2, X } from 'lucide-react';

export default function LineFlexPreviewModal({ notification, onClose }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' | 'json'

  if (!notification || !notification.flexMessagePayload) return null;

  const flex = notification.flexMessagePayload;
  const bubble = flex.contents;
  const headerColor = bubble.header?.backgroundColor || '#4F46E5';

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(flex, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 glass-backdrop z-[70] flex items-center justify-center p-4 print:hidden animate-fade-in">
      <div className="impeccable-card w-full max-w-lg max-h-[90vh] flex flex-col bg-white overflow-hidden shadow-2xl animate-zoom-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#06C755] flex items-center justify-center text-white font-bold shadow-sm">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                ตัวอย่างการแจ้งเตือน LINE Flex Message
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">LINE Messaging API</span>
              </h3>
              <p className="text-xs text-slate-500">จำลองข้อความที่ส่งเข้า LINE Application ของผู้ใช้งานจริง</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-4 pt-2">
          <button
            onClick={() => setActiveTab('visual')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'visual'
                ? 'border-[#06C755] text-[#06C755]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> จำลองหน้าจอบนมือถือ
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'json'
                ? 'border-[#06C755] text-[#06C755]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> LINE Flex JSON Payload
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-100 flex items-center justify-center custom-scrollbar">
          {activeTab === 'visual' ? (
            /* LINE Chat Bubble Mock */
            <div className="w-full max-w-[340px] bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200 animate-fade-in">
              {/* Header Box */}
              <div style={{ backgroundColor: headerColor }} className="p-4 text-white">
                <div className="text-[10px] font-black tracking-widest uppercase opacity-90">
                  {bubble.header?.contents[0]?.text || '🏭 PR/PO & STOCK ALERT'}
                </div>
                <div className="text-base font-bold mt-1 leading-snug">
                  {bubble.header?.contents[1]?.text || notification.title}
                </div>
              </div>

              {/* Body Box */}
              <div className="p-4 space-y-3 bg-white text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">เอกสาร/รายการ:</span>
                  <span className="font-mono font-bold text-slate-900">{notification.docNo || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">ฝ่าย/แผนก:</span>
                  <span className="font-bold text-slate-800">{notification.department || 'ALL'}</span>
                </div>
                {notification.amount !== null && notification.amount !== undefined && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">ยอดเงินสุทธิ:</span>
                    <span className="font-black text-indigo-600 text-sm">฿{Number(notification.amount).toLocaleString()}</span>
                  </div>
                )}
                
                <div className="pt-2 text-slate-700 leading-relaxed font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {notification.message}
                </div>

                <div className="text-[10px] text-slate-400">
                  โดย: <span className="font-semibold text-slate-600">{notification.actor || 'ระบบ'}</span> • {notification.timeFormatted}
                </div>
              </div>

              {/* Footer Button */}
              <div className="p-3 bg-slate-50 border-t border-slate-100">
                <button
                  style={{ backgroundColor: headerColor }}
                  className="w-full text-white font-bold py-2 rounded-xl text-xs shadow-md transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> เปิดดูในระบบ (Open App)
                </button>
              </div>
            </div>
          ) : (
            /* JSON Viewer */
            <div className="w-full h-full min-h-[300px] relative">
              <pre className="w-full h-full bg-slate-900 text-emerald-400 p-4 rounded-xl text-[11px] font-mono overflow-auto max-h-[400px] custom-scrollbar shadow-inner leading-relaxed">
                {JSON.stringify(flex, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-white flex items-center justify-between">
          <button
            onClick={handleCopyJson}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'คัดลอก JSON แล้ว!' : 'คัดลอก LINE Flex JSON'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
