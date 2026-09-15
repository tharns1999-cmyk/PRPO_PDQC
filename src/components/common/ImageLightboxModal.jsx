import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { resolveDriveImageUrl, getDriveFileViewUrl, handleDriveImageError } from '../../utils/driveHelper';

/**
 * ImageLightboxModal
 * High-definition Lightbox Preview Modal for viewing product and PR images.
 * Supports multi-image browsing, keyboard navigation (Left/Right/Esc), 
 * thumbnail filmstrip, and responsive centered rendering.
 */
export default function ImageLightboxModal({
  isOpen,
  images = [],
  initialIndex = 0,
  title = '',
  onClose
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Sync initialIndex when modal opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, (images?.length || 1) - 1)));
    }
  }, [isOpen, initialIndex, images]);

  // Normalize image list into standard objects
  const normalizedImages = useMemoImages(images, title);

  const total = normalizedImages.length;
  const currentImage = normalizedImages[currentIndex] || normalizedImages[0];

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex(prev => (prev - 1 + total) % total);
  }, [total]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex(prev => (prev + 1) % total);
  }, [total]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  if (!isOpen || !currentImage) return null;

  const modalElement = (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-between p-4 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      {/* ── Top Bar ── */}
      <div 
        className="w-full max-w-5xl flex items-center justify-between py-2.5 px-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 text-white shrink-0 z-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate max-w-sm sm:max-w-md md:max-w-lg" title={currentImage.name || title}>
              {currentImage.name || title || 'รูปภาพตัวอย่าง'}
            </h4>
            {title && currentImage.name && currentImage.name !== title && (
              <p className="text-[11px] text-slate-400 truncate max-w-sm">{title}</p>
            )}
          </div>
        </div>

        {/* Counter & Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {total > 1 && (
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {currentIndex + 1} / {total}
            </span>
          )}

          {/* ปุ่มเปิดดูใน Google Drive */}
          {currentImage.driveViewUrl && (
            <a
              href={currentImage.driveViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all hover:scale-105 cursor-pointer"
              title="เปิดดูใน Google Drive"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">เปิดดูใน Google Drive</span>
              <span className="sm:hidden">Drive</span>
            </a>
          )}

          {currentImage.url && (
            <a
              href={currentImage.url}
              download={currentImage.name || 'image'}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="ดาวน์โหลดรูปภาพ"
              onClick={e => e.stopPropagation()}
            >
              <Download className="w-4 h-4" />
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-rose-500/20 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
            title="ปิด (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Main Image View Container ── */}
      <div 
        className="relative w-full max-w-5xl flex-1 flex items-center justify-center p-2 min-h-0 my-2"
        onClick={e => e.stopPropagation()}
      >
        {/* Left / Previous Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 sm:left-4 z-20 p-3 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white border border-slate-700 shadow-xl transition-all hover:scale-110 cursor-pointer"
            title="รูปก่อนหน้า (ลูกศรซ้าย)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* The Image Itself */}
        <div className="relative max-h-[70vh] max-w-full flex items-center justify-center">
          <img
            src={currentImage.url}
            alt={currentImage.name || 'preview'}
            className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800 bg-slate-900/50 transition-all duration-200"
            onError={(e) => handleDriveImageError(e, currentImage.raw || currentImage.url)}
          />
        </div>

        {/* Right / Next Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 sm:right-4 z-20 p-3 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white border border-slate-700 shadow-xl transition-all hover:scale-110 cursor-pointer"
            title="รูปถัดไป (ลูกศรขวา)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* ── Bottom Filmstrip (if multiple images) ── */}
      {total > 1 && (
        <div 
          className="w-full max-w-2xl py-2 px-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex items-center justify-center gap-2 overflow-x-auto shrink-0 z-10"
          onClick={e => e.stopPropagation()}
        >
          {normalizedImages.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`relative w-11 h-11 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                idx === currentIndex
                  ? 'border-indigo-500 ring-2 ring-indigo-500/40 scale-105'
                  : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
              }`}
            >
              <img
                src={img.url}
                alt={img.name || `thumb-${idx}`}
                className="w-full h-full object-cover"
                onError={(e) => handleDriveImageError(e, img.raw || img.url)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' && document.body
    ? createPortal(modalElement, document.body)
    : modalElement;
}

function useMemoImages(rawImages, defaultTitle) {
  return React.useMemo(() => {
    if (!rawImages) return [];
    const list = Array.isArray(rawImages) ? rawImages : [rawImages];
    return list.map((item, idx) => {
      const rawInput = typeof item === 'string' ? item : (item.previewUrl || item.url || item.dataUrl || item.directUrl || item.fileUrl || item);
      const resolvedUrl = resolveDriveImageUrl(rawInput, 'w1600');
      const driveViewUrl = getDriveFileViewUrl(rawInput);
      const name = (typeof item === 'object' && item.name) ? item.name : (defaultTitle ? `${defaultTitle} (${idx + 1})` : `รูปที่ ${idx + 1}`);
      return {
        raw: item,
        url: resolvedUrl || (typeof item === 'string' ? item : (item.url || item.previewUrl || '')),
        driveViewUrl,
        name
      };
    }).filter(it => Boolean(it.url));
  }, [rawImages, defaultTitle]);
}
