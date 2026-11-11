import React, { useState, useRef } from 'react';
import { Upload, Link2, X, Image as ImageIcon, Loader2, AlertCircle, Check } from 'lucide-react';
import { api } from '../../services/api';

interface ImageInputProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  fallbackText?: string;
  isAvatar?: boolean;
}

export const ImageInput: React.FC<ImageInputProps> = ({
  value = '',
  onChange,
  label = 'Image',
  fallbackText = 'No image selected',
  isAvatar = false,
}) => {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imgLoadError, setImgLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Format validation
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      setErrorMsg('Invalid format. Only PNG, JPG, JPEG, and WEBP images are supported.');
      return;
    }

    if (file.type && !ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setErrorMsg('Invalid file type. Please choose a valid PNG, JPG, or WEBP image.');
      return;
    }

    // Size validation (5MB max)
    if (file.size > MAX_SIZE) {
      setErrorMsg(`Image is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 5MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const res = await api.uploadImage(file);
      onChange(res.url);
      setImgLoadError(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyUrl = () => {
    setErrorMsg(null);
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMsg('Please enter an image URL.');
      return;
    }

    // Strict HTTP / HTTPS protocol validation
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setErrorMsg('Unsafe protocol. Only http:// or https:// URLs are permitted.');
        return;
      }
    } catch {
      setErrorMsg('Invalid URL format. Please enter a valid http:// or https:// address.');
      return;
    }

    onChange(trimmed);
    setImgLoadError(false);
    setUrlInput('');
  };

  const handleRemove = () => {
    onChange('');
    setImgLoadError(false);
    setErrorMsg(null);
    setUrlInput('');
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
                {imgLoadError ? 'Broken URL' : 'None'}
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
              onClick={() => { setMode('upload'); setErrorMsg(null); }}
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
              onClick={() => { setMode('url'); setErrorMsg(null); }}
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
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                id={`file-input-${label.replace(/\s+/g, '-').toLowerCase()}`}
              />
              <label
                htmlFor={`file-input-${label.replace(/\s+/g, '-').toLowerCase()}`}
                className="cursor-pointer px-3 py-1.5 rounded-[8px] bg-white border border-[#E1DCDC] hover:border-[#0A0A0A] text-xs font-medium text-[#333333] flex items-center space-x-1.5 shadow-2xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#5269A8]" />
                <span>{value ? 'Change Selected Image' : 'Choose Local File...'}</span>
              </label>
              <span className="text-[11px] text-[#888888] truncate">
                PNG, JPG, WEBP (Max 5MB)
              </span>
            </div>
          )}

          {/* Mode 2: Online URL Input */}
          {mode === 'url' && (
            <div className="flex items-center space-x-1.5">
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApplyUrl(); } }}
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

