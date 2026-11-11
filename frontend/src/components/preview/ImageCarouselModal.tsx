import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Download } from 'lucide-react';
import { AttachmentRecord } from '../../types';

interface ImageCarouselModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string;
  images: AttachmentRecord[];
  initialIndex?: number;
}

export const ImageCarouselModal: React.FC<ImageCarouselModalProps> = ({
  isOpen,
  onClose,
  moduleName,
  images,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length, onClose]);

  if (!isOpen) return null;

  const currentImg = images[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E1DCDC] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#FFFFFF] border border-[#E1DCDC] text-[#B65F65]">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#333333]">Attached Images</h3>
              <p className="text-xs text-[#888888] truncate max-w-md">{moduleName}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {images.length > 0 && (
              <span className="text-xs font-semibold text-[#666666] bg-[#FFFFFF] px-2.5 py-1 rounded-full border border-[#E1DCDC]">
                {currentIndex + 1} of {images.length}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#888888] hover:text-[#333333] hover:bg-[#E8E4E4] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Display Canvas with Left/Right Controls */}
        <div className="flex-1 bg-[#0A0A0A] relative flex items-center justify-center min-h-[380px] p-4 overflow-hidden">
          {images.length === 0 ? (
            <div className="text-center text-sm text-[#888888]">
              No image attachments uploaded for this module.
            </div>
          ) : (
            <>
              {/* Navigation Left Arrow */}
              {images.length > 1 && (
                <button
                  onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))}
                  className="absolute left-4 z-20 p-2.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition-all"
                  title="Previous image (Left Arrow)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* Main Image */}
              <div className="max-w-full max-h-[60vh] flex items-center justify-center">
                <img
                  src={currentImg?.file_path}
                  alt={currentImg?.file_name}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg select-none"
                />
              </div>

              {/* Navigation Right Arrow */}
              {images.length > 1 && (
                <button
                  onClick={() => setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))}
                  className="absolute right-4 z-20 p-2.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition-all"
                  title="Next image (Right Arrow)"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer Info */}
        {currentImg && (
          <div className="px-6 py-3 border-t border-[#E1DCDC] bg-[#FFFFFF] flex items-center justify-between text-xs text-[#666666]">
            <div>
              <span className="font-semibold text-[#333333]">{currentImg.file_name}</span>
              <span className="text-[#888888] ml-2">
                ({(currentImg.file_size / 1024).toFixed(1)} KB) • Uploaded by {currentImg.uploaded_by_name}
              </span>
            </div>

            <a
              href={currentImg.file_path}
              download={currentImg.file_name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-[#0A0A0A] hover:underline font-medium"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

