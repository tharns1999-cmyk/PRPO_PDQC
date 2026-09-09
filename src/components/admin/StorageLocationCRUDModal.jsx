import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, X, Check, AlertCircle, Building2 } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { modalService } from '../../services/modalService';

export default function StorageLocationCRUDModal({
  location = null,
  storageLocations = [],
  currentRole,
  onClose,
  onSaved,
  onCreated
}) {
  const isEdit = Boolean(location && location.id);

  const [name, setName] = useState(location?.name || '');
  const [department, setDepartment] = useState(
    location?.department || (currentRole.canViewAllDepts ? 'ALL' : currentRole.department)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Duplicate name check (case-insensitive)
  const isNameDuplicate = Boolean(
    name.trim() &&
    storageLocations.some(
      l => l.id !== location?.id && l.name.trim().toLowerCase() === name.trim().toLowerCase()
    )
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('กรุณาระบุชื่อจุดจัดเก็บสินค้า');
      return;
    }

    if (isNameDuplicate) {
      setError(`ชื่อจุดจัดเก็บ "${name.trim()}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        id: location?.id || undefined,
        name: name.trim(),
        department
      };

      const saved = await apiService.saveStorageLocation(payload, `${currentRole.name} (${currentRole.title})`);

      modalService.success(
        isEdit ? 'แก้ไขจุดจัดเก็บเรียบร้อย' : 'เพิ่มจุดจัดเก็บสำเร็จ',
        `บันทึก "${saved.name}" เรียบร้อยแล้ว`
      );

      if (onCreated) onCreated(saved);
      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 animate-zoom-in">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 flex items-center justify-center shadow-2xs shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-base tracking-tight">
                {isEdit ? 'แก้ไขจุดจัดเก็บสินค้า' : 'เพิ่มจุดจัดเก็บสินค้าใหม่'}
              </h3>
              <p className="text-xs text-slate-500 font-normal truncate mt-0.5">
                ระบุชื่อจุดหรือตำแหน่งที่จัดเก็บสินค้าในคลัง
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 bg-slate-50/30">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-2xs">
            {/* Storage Location Name */}
            <div>
              <label className="text-xs font-bold text-slate-800 mb-1.5 block">
                ชื่อจุดจัดเก็บสินค้า <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="เช่น ชั้นวาง A-01, ตู้เก็บเคมี 1, คลังพัสดุกลาง, ห้องเย็น 4°C"
                  required
                  autoFocus
                  className={`w-full h-11 pl-10 pr-3 bg-white border rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all shadow-2xs ${
                    isNameDuplicate
                      ? 'border-rose-300 focus:ring-2 focus:ring-rose-500/20'
                      : 'border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
                />
              </div>
              {isNameDuplicate && (
                <p className="text-xs text-rose-600 mt-1 font-medium">
                  * มีชื่อจุดจัดเก็บนี้ในระบบแล้ว
                </p>
              )}
            </div>

            {/* Department Assignment */}
            <div>
              <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>แผนกที่ใช้งานจุดเก็บนี้ <span className="text-rose-500">*</span></span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDepartment('ALL')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    department === 'ALL'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs ring-1 ring-indigo-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  ทุกแผนก / กลาง
                </button>
                <button
                  type="button"
                  onClick={() => setDepartment('PD')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    department === 'PD'
                      ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-2xs ring-1 ring-blue-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  ฝ่ายผลิต (PD)
                </button>
                <button
                  type="button"
                  onClick={() => setDepartment('QC')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    department === 'QC'
                      ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-2xs ring-1 ring-amber-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  ฝ่าย QC
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving || isNameDuplicate || !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : (isEdit ? 'บันทึกการแก้ไข' : 'บันทึกจุดจัดเก็บ')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
