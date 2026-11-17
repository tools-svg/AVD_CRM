import React, { useState, useRef, useEffect, useId } from 'react';
import { Upload, Link2, X, Image as ImageIcon, Loader2, AlertCircle, Check } from 'lucide-react';
import { api } from '../../services/api';

interface ImageInputProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  fallbackText?: string;
  isAvatar?: boolean;
}

function dataURLtoFile(dataurl: string, filename: string): File | null {
  try {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch {
    return null;
  }
}

export const ImageInput: React.FC<ImageInputProps> = ({
  value = '',
  onChange,
  label = 'Image',
  fallbackText = 'No image selected',
  isAvatar = false,
}) => {
  const uniqueId = useId();
  const inputId = `file-input-${uniqueId.replace(/[:/]/g, '')}`;

  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState(value || '');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imgLoadError, setImgLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.jfif'];
  const ALLOWED_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/svg+xml',
    'image/pjpeg',
    'image/jfif',
    'image/x-png',
  ];
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

  // Sync urlInput and clear errors when external value changes
  useEffect(() => {
    setUrlInput(value || '');
    setImgLoadError(false);
  }, [value]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Extension validation
    const lastDot = file.name.lastIndexOf('.');
    const ext = lastDot !== -1 ? file.name.substring(lastDot).toLowerCase() : '';
    if (!ALLOWED_EXTS.includes(ext)) {
      setErrorMsg(`Invalid format '${ext || 'unknown'}'. Supported formats: PNG, JPG, JPEG, WEBP, SVG`);
      return;
    }

    // MIME type validation (relaxed for Windows / unmapped types)
    if (file.type && !ALLOWED_TYPES.includes(file.type.toLowerCase()) && file.type !== 'application/octet-stream') {
      setErrorMsg('Invalid file type. Please choose a valid PNG, JPG, WEBP, or SVG image.');
      return;
    }

    // Size validation
    if (file.size > MAX_SIZE) {
      setErrorMsg(`Image is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 10MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const res = await api.uploadImage(file);
      onChange(res.url);
      setUrlInput(res.url);
      setImgLoadError(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUrlInputChange = (newVal: string) => {
    setUrlInput(newVal);
    setErrorMsg(null);
    // Auto-propagate entered URL to parent state so saving the form always includes the new URL
    onChange(newVal.trim());
    if (imgLoadError) setImgLoadError(false);
  };

  const handleApplyUrl = async () => {
    setErrorMsg(null);
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMsg('Please enter an image URL.');
      return;
    }

    // If it's a base64 data URI, auto-upload it to avoid oversized DB columns
    if (trimmed.startsWith('data:image/')) {
      const file = dataURLtoFile(trimmed, `uploaded_image_${Date.now()}.png`);
      if (file) {
        setIsUploading(true);
        try {
          const res = await api.uploadImage(file);
          onChange(res.url);
          setUrlInput(res.url);
          setImgLoadError(false);
          return;
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to process base64 image data.');
          return;
        } finally {
          setIsUploading(false);
        }
      }
    }

    // Validation: allow relative paths (/logos/..., /uploads/..., etc.) or standard HTTP(S)
    if (!trimmed.startsWith('/') && !trimmed.startsWith('./') && !trimmed.startsWith('data:')) {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setErrorMsg('Unsafe protocol. Only http:// or https:// URLs are permitted.');
          return;
        }
      } catch {
        setErrorMsg('Invalid URL format. Please enter a valid path (/logos/1.png) or http(s):// address.');
        return;
      }
    }

    onChange(trimmed);
    setImgLoadError(false);
  };

  const handleRemove = () => {
    onChange('');
    setUrlInput('');
    setImgLoadError(false);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
          {label}
        </label>
      )}

      {/* Preview and Controls Container */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-[#F5F3F4] rounded-[10px] border border-[#E1DCDC]">
        {/* Thumbnail Preview with Fallback */}
        <div
          className={`relative flex items-center justify-center bg-white border border-[#E1DCDC] overflow-hidden flex-shrink-0 ${
            isAvatar ? 'w-14 h-14 rounded-full' : 'w-20 h-14 rounded-[8px]'
          }`}
        >
          {value && !imgLoadError ? (
            <img
              src={value}
              alt="Preview"
              onError={() => setImgLoadError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-[#888888] p-1 text-center">
              <ImageIcon className="w-5 h-5 opacity-40 mb-0.5" />
              <span className="text-[9px] leading-tight text-[#888888]">
                {imgLoadError ? 'Broken URL' : fallbackText === 'No image selected' ? 'None' : fallbackText}
              </span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Action Controls & Input Tabs */}
        <div className="flex-1 min-w-0 space-y-2 w-full">
          {/* Method Selector Tabs */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => {
                setMode('upload');
                setErrorMsg(null);
              }}
              className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                mode === 'upload'
                  ? 'bg-[#0A0A0A] text-white'
                  : 'bg-white text-[#666666] hover:bg-[#E8E4E4] border border-[#E1DCDC]'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>Upload Image</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('url');
                setErrorMsg(null);
                if (!urlInput && value) setUrlInput(value);
              }}
              className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                mode === 'url'
                  ? 'bg-[#0A0A0A] text-white'
                  : 'bg-white text-[#666666] hover:bg-[#E8E4E4] border border-[#E1DCDC]'
              }`}
            >
              <Link2 className="w-3 h-3" />
              <span>Add Image Using URL</span>
            </button>
            {value && (
              <button
                type="button"
                onClick={handleRemove}
                className="px-2 py-1 rounded-[6px] text-xs font-medium text-[#A93232] hover:bg-[#F5DEDE]/40 ml-auto flex items-center space-x-1 transition-colors"
                title="Remove image"
              >
                <X className="w-3 h-3" />
                <span>Remove</span>
              </button>
            )}
          </div>

          {/* Mode 1: Local System Upload */}
          {mode === 'upload' && (
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg,.jfif,image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileSelect}
                className="hidden"
                id={inputId}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer px-3 py-1.5 rounded-[8px] bg-white border border-[#E1DCDC] hover:border-[#0A0A0A] text-xs font-medium text-[#333333] flex items-center space-x-1.5 shadow-2xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#5269A8]" />
                <span>{value ? 'Change Selected Image' : 'Choose Local File...'}</span>
              </button>
              <span className="text-[11px] text-[#888888] truncate">
                PNG, JPG, WEBP, SVG (Max 10MB)
              </span>
            </div>
          )}

          {/* Mode 2: Online or Local Relative URL Input */}
          {mode === 'url' && (
            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                placeholder="https://... or /logos/1.png"
                value={urlInput}
                onChange={e => handleUrlInputChange(e.target.value)}
                onBlur={() => {
                  if (urlInput.trim() && urlInput.trim() !== value) {
                    handleApplyUrl();
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyUrl();
                  }
                }}
                className="flex-1 bg-white border border-[#E1DCDC] rounded-[8px] px-2.5 py-1 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A]"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-3 py-1 rounded-[8px] bg-[#0A0A0A] text-white hover:bg-[#333333] text-xs font-semibold flex items-center space-x-1 transition-colors flex-shrink-0"
              >
                <Check className="w-3 h-3" />
                <span>Apply</span>
              </button>
            </div>
          )}

          {/* Current URL indicator */}
          {value && (
            <p className="text-[10px] text-[#888888] truncate max-w-sm">
              Current: <span className="font-mono text-[#555555]">{value}</span>
            </p>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center space-x-1 text-[11px] text-[#A93232] font-medium">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
