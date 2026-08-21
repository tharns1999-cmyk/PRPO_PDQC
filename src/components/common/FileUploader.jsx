import React, { useCallback, useState } from 'react';
import { UploadCloud, File as FileIcon, X, Image as ImageIcon } from 'lucide-react';

export default function FileUploader({ 
  label, 
  required, 
  accept = "image/*,application/pdf", 
  multiple = false, 
  files, 
  setFiles,
  helperText
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles) => {
    const validFiles = newFiles.map(file => {
      // Create local preview URL
      const previewUrl = URL.createObjectURL(file);
      return {
        file,
        id: Math.random().toString(36).substring(7),
        name: file.name,
        size: file.size,
        type: file.type,
        previewUrl,
        isImage: file.type.startsWith('image/')
      };
    });

    if (multiple) {
      setFiles(prev => [...prev, ...validFiles]);
    } else {
      // If not multiple, revoke old URL and replace
      if (files.length > 0 && files[0].previewUrl) URL.revokeObjectURL(files[0].previewUrl);
      setFiles([validFiles[0]]);
    }
  };

  const removeFile = (idToRemove) => {
    const fileToRemove = files.find(f => f.id === idToRemove);
    if (fileToRemove && fileToRemove.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    setFiles(prev => prev.filter(f => f.id !== idToRemove));
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full animate-fade-in">
      <div className="flex justify-between items-end mb-2">
        <label className="text-[13px] font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {helperText && <span className="text-[11px] text-slate-500">{helperText}</span>}
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-sm p-6 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden group
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50 shadow-inner' 
            : 'border-slate-300 bg-white/50 hover:bg-white hover:border-indigo-300'
          }`}
      >
        <input 
          type="file" 
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        
        <div className={`p-3 rounded-full mb-3 transition-colors ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-slate-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 shadow-sm border border-slate-100'}`}>
          <UploadCloud className={`w-6 h-6 ${isDragging ? 'animate-bounce-slight' : ''}`} />
        </div>
        
        <h4 className="text-sm font-bold text-slate-700 mb-1">
          {isDragging ? 'วางไฟล์ที่นี่เลย!' : 'ลากไฟล์มาวาง หรือ คลิกเพื่อเลือก'}
        </h4>
        <p className="text-xs text-slate-500 font-medium max-w-xs leading-relaxed">
          รองรับไฟล์ {accept.replace(/image\/\*/g, 'รูปภาพ').replace(/application\/pdf/g, 'PDF')} {multiple && '(แนบได้หลายไฟล์)'}
        </p>
      </div>

      {/* Preview Gallery */}
      {files.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 animate-fade-in-up">
          {files.map(f => (
            <div key={f.id} className="relative group rounded-sm border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {f.isImage ? (
                <div className="aspect-square bg-slate-100 w-full">
                  <img src={f.previewUrl} alt={f.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-square bg-white flex flex-col items-center justify-center p-3 text-center">
                  <FileIcon className="w-8 h-8 text-indigo-400 mb-2" />
                  <span className="text-[10px] font-bold text-slate-600 line-clamp-2 w-full break-all">{f.name}</span>
                </div>
              )}
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                  className="self-end p-1.5 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-sm transform hover:scale-110 transition-all"
                  title="ลบไฟล์"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="text-[10px] font-semibold text-white/90 truncate">
                  {formatSize(f.size)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
