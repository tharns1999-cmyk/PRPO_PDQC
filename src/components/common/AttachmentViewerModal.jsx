import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ExternalLink, FileText, Image as ImageIcon, Globe, ShieldCheck } from 'lucide-react';

export default function AttachmentViewerModal({ file, url, title, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!file && !url) return null;

  const targetUrl = url || file?.previewUrl || file?.url || '';
  const fileName = title || file?.name || 'เอกสารแนบ (Attachment)';
  const isPdf = (file?.type === 'application/pdf') || (typeof targetUrl === 'string' && targetUrl.endsWith('.pdf'));
  const isOnlineUrl = typeof targetUrl === 'string' && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'));
  const isImage = (file?.isImage) || (file?.type?.startsWith('image/')) || (typeof targetUrl === 'string' && targetUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i)) || (!isPdf && !isOnlineUrl && targetUrl.startsWith('blob:'));

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-sm shadow-md w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-white animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-10 h-10 rounded-sm bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
              {isImage ? <ImageIcon className="w-5 h-5" /> : isOnlineUrl ? <Globe className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate max-w-md" title={fileName}>
                {fileName}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium flex items-center gap-2">
                <span>{isImage ? 'รูปภาพแนบ (Image)' : isPdf ? 'เอกสาร PDF (Quotation/Doc)' : isOnlineUrl ? 'ลิงก์เว็บภายนอก (Web URL)' : 'เอกสารประกอบ'}</span>
                {file?.size ? <span>• {(file.size / 1024).toFixed(1)} KB</span> : null}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {isImage && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-700/60 p-1 rounded-sm border border-slate-600">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-slate-600 rounded-sm transition-colors text-slate-300 hover:text-white"
                  title="ย่อขนาด (Zoom Out)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-1 text-slate-300">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-slate-600 rounded-sm transition-colors text-slate-300 hover:text-white"
                  title="ขยายขนาด (Zoom In)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-1.5 hover:bg-slate-600 rounded-sm transition-colors text-slate-300 hover:text-white ml-1"
                  title="หมุน 90 องศา (Rotate)"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2 py-1 hover:bg-slate-600 rounded-sm transition-colors text-[11px] font-semibold text-slate-300 hover:text-white"
                >
                  รีเซ็ต
                </button>
              </div>
            )}

            {targetUrl && (
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={!isOnlineUrl ? fileName : undefined}
                className="p-2 hover:bg-slate-700 bg-slate-800 border border-slate-600 rounded-sm transition-colors text-slate-300 hover:text-white"
                title={isOnlineUrl ? "เปิดลิงก์ในแท็บใหม่" : "ดาวน์โหลดไฟล์"}
              >
                {isOnlineUrl ? <ExternalLink className="w-4.5 h-4.5" /> : <Download className="w-4.5 h-4.5" />}
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-rose-500/20 hover:text-rose-400 bg-slate-800 border border-slate-600 rounded-sm transition-colors text-slate-400"
              title="ปิดหน้าต่าง (Close)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content / Preview Area */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center min-h-[350px] max-h-[calc(90vh-140px)] bg-slate-950/60">
          {isImage ? (
            <div className="overflow-auto max-w-full max-h-full flex items-center justify-center p-4">
              <img
                src={targetUrl}
                alt={fileName}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-in-out'
                }}
                className="max-h-[60vh] max-w-full object-contain rounded-sm shadow-md select-none"
              />
            </div>
          ) : isPdf ? (
            <div className="w-full h-[60vh] flex flex-col items-center justify-center bg-slate-900/90 rounded-sm border border-slate-700 p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-sm bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-white">{fileName}</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  เอกสาร Quotation / PDF พร้อมสำหรับการตรวจสอบและพิมพ์
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-2">
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-sm shadow-sm shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  เปิดดูเอกสาร PDF เต็มหน้าจอ
                </a>
              </div>
            </div>
          ) : isOnlineUrl ? (
            <div className="w-full max-w-md bg-slate-800/90 border border-slate-700 rounded-sm p-6 text-center space-y-5 shadow-md">
              <div className="w-16 h-16 rounded-sm bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-400 mx-auto">
                <Globe className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-base text-white">ลิงก์สั่งซื้อสินค้าออนไลน์</h4>
                <p className="text-xs text-purple-300 font-mono break-all bg-slate-900/80 p-3 rounded-sm border border-slate-700/60">
                  {targetUrl}
                </p>
              </div>
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-sm shadow-sm shadow-purple-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                เปิดหน้าเว็บร้านค้าภายนอก (Shopee / Lazada)
              </a>
            </div>
          ) : (
            <div className="text-center p-8 space-y-3">
              <FileText className="w-12 h-12 text-slate-500 mx-auto" />
              <p className="text-sm text-slate-400">ไฟล์เอกสาร: <span className="text-white font-semibold">{fileName}</span></p>
              {targetUrl && (
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-sm border border-slate-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> เปิดไฟล์
                </a>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3 bg-slate-800/80 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ระบบรักษาความปลอดภัยเอกสารจัดซื้อ</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-sm transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
