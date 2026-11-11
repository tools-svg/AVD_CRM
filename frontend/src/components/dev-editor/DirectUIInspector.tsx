import React, { useState, useEffect, useRef } from 'react';
import { 
  Edit3, 
  X, 
  Check, 
  RotateCcw, 
  Sliders, 
  Eye, 
  Save, 
  Move, 
  Type, 
  Palette, 
  Square, 
  Sparkles,
  Layers
} from 'lucide-react';
import { useUIConfig } from '../../context/UIConfigContext';
import { ElementCustomization } from '../../types';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const DirectUIInspector: React.FC = () => {
  const { 
    isDirectEditingMode, 
    setIsDirectEditingMode, 
    directEdits, 
    saveDirectEdit, 
    removeDirectEdit 
  } = useUIConfig();

  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);
  const [hoverRect, setHoverRect] = useState<TargetRect | null>(null);
  const [hoverTag, setHoverTag] = useState<string>('');

  const [selectedEl, setSelectedEl] = useState<HTMLElement | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [originalCustomization, setOriginalCustomization] = useState<ElementCustomization | null>(null);

  // Form state
  const [text, setText] = useState<string>('');
  const [fontSize, setFontSize] = useState<string>('');
  const [fontWeight, setFontWeight] = useState<string>('');
  const [textColor, setTextColor] = useState<string>('');
  const [backgroundColor, setBackgroundColor] = useState<string>('');
  const [border, setBorder] = useState<string>('');
  const [borderRadius, setBorderRadius] = useState<string>('');
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [visibility, setVisibility] = useState<'visible' | 'hidden'>('visible');
  const [padding, setPadding] = useState<string>('');
  const [margin, setMargin] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Helper to generate a clean deterministic key for any element if no data-ui-editable exists
  const getElementKey = (el: HTMLElement): string => {
    const attrKey = el.getAttribute('data-ui-editable');
    if (attrKey) return attrKey;

    const id = el.id;
    if (id) return `el_${id}`;

    const textContent = (el.innerText || el.textContent || '').trim().slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const tagName = el.tagName.toLowerCase();
    return `${tagName}_${textContent || 'elem'}`;
  };

  // Hover detection when direct editing mode is active
  useEffect(() => {
    if (!isDirectEditingMode) {
      setHoveredEl(null);
      setHoverRect(null);
      return;
    }

    const handlePointerMove = (e: MouseEvent) => {
      if (selectedEl) return; // Don't track hover while editor panel is open

      const target = e.target as HTMLElement;
      if (!target || panelRef.current?.contains(target) || target.closest('#direct-ui-toolbar')) {
        setHoveredEl(null);
        setHoverRect(null);
        return;
      }

      // Check if element is a valid UI element
      const isValid = 
        target.hasAttribute('data-ui-editable') ||
        ['H1', 'H2', 'H3', 'H4', 'TH', 'TD', 'BUTTON', 'LABEL', 'P', 'SPAN', 'A', 'INPUT'].includes(target.tagName);

      if (isValid) {
        const rect = target.getBoundingClientRect();
        setHoveredEl(target);
        setHoverRect({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
        const key = getElementKey(target);
        setHoverTag(target.getAttribute('data-ui-editable') || target.tagName.toLowerCase());
      } else {
        setHoveredEl(null);
        setHoverRect(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || panelRef.current?.contains(target) || target.closest('#direct-ui-toolbar')) {
        return;
      }

      const isValid = 
        target.hasAttribute('data-ui-editable') ||
        ['H1', 'H2', 'H3', 'H4', 'TH', 'TD', 'BUTTON', 'LABEL', 'P', 'SPAN', 'A', 'INPUT'].includes(target.tagName);

      if (isValid) {
        e.preventDefault();
        e.stopPropagation();

        const key = getElementKey(target);
        setSelectedEl(target);
        setSelectedKey(key);
        setHoveredEl(null);
        setHoverRect(null);

        // Load existing custom or computed styles
        const existingCustom = directEdits[key] || {};
        setOriginalCustomization(existingCustom);

        const computed = window.getComputedStyle(target);
        setText(existingCustom.text !== undefined ? existingCustom.text : (target.innerText || target.textContent || '').trim());
        setFontSize(existingCustom.fontSize || computed.fontSize || '14px');
        setFontWeight(existingCustom.fontWeight || computed.fontWeight || '400');
        setTextColor(existingCustom.textColor || rgbToHex(computed.color) || '#333333');
        setBackgroundColor(existingCustom.backgroundColor || (computed.backgroundColor !== 'rgba(0, 0, 0, 0)' ? rgbToHex(computed.backgroundColor) : ''));
        setBorder(existingCustom.border || (computed.border && computed.border !== 'none' ? computed.border : ''));
        setBorderRadius(existingCustom.borderRadius || computed.borderRadius || '0px');
        setWidth(existingCustom.width || '');
        setHeight(existingCustom.height || '');
        setVisibility(existingCustom.visibility || 'visible');
        setPadding(existingCustom.padding || computed.padding || '');
        setMargin(existingCustom.margin || computed.margin || '');
      }
    };

    document.addEventListener('mousemove', handlePointerMove, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mousemove', handlePointerMove, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isDirectEditingMode, selectedEl, directEdits]);

  // Helper RGB to Hex converter
  const rgbToHex = (rgbStr: string): string => {
    if (!rgbStr || rgbStr.startsWith('#')) return rgbStr;
    const match = rgbStr.match(/\d+/g);
    if (!match || match.length < 3) return rgbStr;
    const r = parseInt(match[0]).toString(16).padStart(2, '0');
    const g = parseInt(match[1]).toString(16).padStart(2, '0');
    const b = parseInt(match[2]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  };

  // Live Preview: immediately apply style changes to selected element
  useEffect(() => {
    if (!selectedEl) return;

    if (text !== undefined) {
      if (selectedEl.children.length === 0) {
        selectedEl.innerText = text;
      }
    }
    if (fontSize) selectedEl.style.fontSize = fontSize;
    if (fontWeight) selectedEl.style.fontWeight = fontWeight;
    if (textColor) selectedEl.style.color = textColor;
    if (backgroundColor) selectedEl.style.backgroundColor = backgroundColor;
    if (border) selectedEl.style.border = border;
    if (borderRadius) selectedEl.style.borderRadius = borderRadius;
    if (width) selectedEl.style.width = width;
    if (height) selectedEl.style.height = height;
    if (visibility) selectedEl.style.visibility = visibility;
    if (padding) selectedEl.style.padding = padding;
    if (margin) selectedEl.style.margin = margin;
  }, [selectedEl, text, fontSize, fontWeight, textColor, backgroundColor, border, borderRadius, width, height, visibility, padding, margin]);

  const handleSave = async () => {
    if (!selectedKey) return;
    setIsSaving(true);
    try {
      const customization: ElementCustomization = {
        text: text.trim() ? text : undefined,
        fontSize: fontSize || undefined,
        fontWeight: fontWeight || undefined,
        textColor: textColor || undefined,
        backgroundColor: backgroundColor || undefined,
        border: border || undefined,
        borderRadius: borderRadius || undefined,
        width: width || undefined,
        height: height || undefined,
        visibility: visibility || undefined,
        padding: padding || undefined,
        margin: margin || undefined,
      };

      await saveDirectEdit(selectedKey, customization);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setSelectedEl(null);
      }, 500);
    } catch (err) {
      console.error('Failed to save direct edit:', err);
      alert('Failed to save customization. Please check permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Revert element to previous state
    if (selectedEl && originalCustomization) {
      if (originalCustomization.text !== undefined) {
        if (selectedEl.children.length === 0) selectedEl.innerText = originalCustomization.text;
      }
      selectedEl.style.fontSize = originalCustomization.fontSize || '';
      selectedEl.style.fontWeight = originalCustomization.fontWeight || '';
      selectedEl.style.color = originalCustomization.textColor || '';
      selectedEl.style.backgroundColor = originalCustomization.backgroundColor || '';
      selectedEl.style.border = originalCustomization.border || '';
      selectedEl.style.borderRadius = originalCustomization.borderRadius || '';
      selectedEl.style.width = originalCustomization.width || '';
      selectedEl.style.height = originalCustomization.height || '';
      selectedEl.style.visibility = originalCustomization.visibility || '';
      selectedEl.style.padding = originalCustomization.padding || '';
      selectedEl.style.margin = originalCustomization.margin || '';
    } else if (selectedEl) {
      selectedEl.removeAttribute('style');
    }
    setSelectedEl(null);
  };

  const handleResetToDefault = async () => {
    if (!selectedKey) return;
    if (!confirm('Reset this element to application default styles?')) return;
    try {
      await removeDirectEdit(selectedKey);
      if (selectedEl) selectedEl.removeAttribute('style');
      setSelectedEl(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isDirectEditingMode) return null;

  return (
    <>
      {/* 1. Global Floating Toolbar (Top Banner) */}
      <div 
        id="direct-ui-toolbar"
        className="fixed top-16 right-6 z-50 bg-[#0A0A0A] text-white px-4 py-2.5 rounded-[12px] shadow-2xl border border-white/20 flex items-center space-x-3 text-xs animate-in slide-in-from-top-3 duration-200"
      >
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#5269A8] animate-ping" />
          <span className="font-bold flex items-center space-x-1.5">
            <Edit3 className="w-3.5 h-3.5 text-[#A5B4FC]" />
            <span>Direct UI Editing Mode</span>
          </span>
        </div>
        <span className="text-[#A1A1AA] hidden sm:inline">• Click any element to customize</span>
        <button
          onClick={() => {
            setIsDirectEditingMode(false);
            setSelectedEl(null);
          }}
          className="ml-2 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-[6px] font-semibold transition-colors flex items-center space-x-1"
        >
          <X className="w-3 h-3" />
          <span>Exit</span>
        </button>
      </div>

      {/* 2. Selection Outline on Hover */}
      {hoverRect && !selectedEl && (
        <div
          style={{
            top: hoverRect.top,
            left: hoverRect.left,
            width: hoverRect.width,
            height: hoverRect.height,
          }}
          className="fixed pointer-events-none z-40 border-2 border-dashed border-[#5269A8] bg-[#5269A8]/10 rounded transition-all"
        >
          <div className="absolute -top-6 left-0 bg-[#5269A8] text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
            {hoverTag} • Click to Edit
          </div>
        </div>
      )}

      {/* 3. Compact Inline Editing Panel Modal */}
      {selectedEl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div 
            ref={panelRef}
            className="bg-white rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#5269A8]" />
                <div>
                  <h3 className="text-xs font-bold text-[#0A0A0A]">
                    Direct UI Editor: <span className="font-mono text-[#5269A8]">{selectedKey}</span>
                  </h3>
                  <span className="text-[10px] text-[#888888]">Live preview applied instantly</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="p-1.5 rounded-[8px] text-[#888888] hover:text-[#0A0A0A] hover:bg-[#E8E4E4] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Properties Form */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Text Content */}
              <div>
                <label className="block text-[11px] font-semibold text-[#888888] uppercase mb-1 flex items-center space-x-1">
                  <Type className="w-3.5 h-3.5" />
                  <span>Text / Heading / Label Content</span>
                </label>
                <input
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Enter text..."
                  className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              {/* Typography Row: Font Size & Font Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Font Size</label>
                  <select
                    value={fontSize}
                    onChange={e => setFontSize(e.target.value)}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1.5 text-xs text-[#333333]"
                  >
                    <option value="">Default</option>
                    <option value="10px">10px - Tiny</option>
                    <option value="11px">11px - Small</option>
                    <option value="12px">12px - Regular</option>
                    <option value="13px">13px - Medium</option>
                    <option value="14px">14px - Base</option>
                    <option value="16px">16px - Large</option>
                    <option value="18px">18px - Subheading</option>
                    <option value="20px">20px - Heading</option>
                    <option value="24px">24px - Title</option>
                    <option value="32px">32px - Hero</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Font Weight</label>
                  <select
                    value={fontWeight}
                    onChange={e => setFontWeight(e.target.value)}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1.5 text-xs text-[#333333]"
                  >
                    <option value="">Default</option>
                    <option value="400">400 - Normal</option>
                    <option value="500">500 - Medium</option>
                    <option value="600">600 - Semibold</option>
                    <option value="700">700 - Bold</option>
                    <option value="800">800 - Extrabold</option>
                  </select>
                </div>
              </div>

              {/* Colors Row: Text Color & Background Color */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1 flex items-center space-x-1">
                    <Palette className="w-3 h-3" />
                    <span>Text Colour</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={textColor.startsWith('#') ? textColor : '#333333'}
                      onChange={e => setTextColor(e.target.value)}
                      className="w-7 h-7 rounded border border-[#E1DCDC] p-0.5 cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={textColor}
                      onChange={e => setTextColor(e.target.value)}
                      placeholder="#333333"
                      className="flex-1 bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1 text-xs text-[#333333]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1 flex items-center space-x-1">
                    <Palette className="w-3 h-3" />
                    <span>Background Colour</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={backgroundColor.startsWith('#') ? backgroundColor : '#FFFFFF'}
                      onChange={e => setBackgroundColor(e.target.value)}
                      className="w-7 h-7 rounded border border-[#E1DCDC] p-0.5 cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={e => setBackgroundColor(e.target.value)}
                      placeholder="#FFFFFF or transparent"
                      className="flex-1 bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1 text-xs text-[#333333]"
                    />
                  </div>
                </div>
              </div>

              {/* Border & Border Radius */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1 flex items-center space-x-1">
                    <Square className="w-3 h-3" />
                    <span>Border</span>
                  </label>
                  <input
                    type="text"
                    value={border}
                    onChange={e => setBorder(e.target.value)}
                    placeholder="1px solid #E1DCDC"
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1.5 text-xs text-[#333333]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Border Radius</label>
                  <select
                    value={borderRadius}
                    onChange={e => setBorderRadius(e.target.value)}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1.5 text-xs text-[#333333]"
                  >
                    <option value="">Default</option>
                    <option value="0px">0px - Sharp</option>
                    <option value="4px">4px - Subtle</option>
                    <option value="8px">8px - Rounded</option>
                    <option value="10px">10px - Apple Button</option>
                    <option value="14px">14px - Apple Card</option>
                    <option value="18px">18px - Modal</option>
                    <option value="9999px">9999px - Pill / Full</option>
                  </select>
                </div>
              </div>

              {/* Dimensions: Width & Height */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Width</label>
                  <input
                    type="text"
                    value={width}
                    onChange={e => setWidth(e.target.value)}
                    placeholder="auto, 100%, 120px"
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1.5 text-xs text-[#333333]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Height</label>
                  <input
                    type="text"
                    value={height}
                    onChange={e => setHeight(e.target.value)}
                    placeholder="auto, 36px, 48px"
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1.5 text-xs text-[#333333]"
                  />
                </div>
              </div>

              {/* Visibility & Spacing */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Visibility</label>
                  <select
                    value={visibility}
                    onChange={e => setVisibility(e.target.value as any)}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2 py-1.5 text-xs text-[#333333]"
                  >
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Padding</label>
                  <input
                    type="text"
                    value={padding}
                    onChange={e => setPadding(e.target.value)}
                    placeholder="4px 8px"
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2 py-1.5 text-xs text-[#333333]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Margin</label>
                  <input
                    type="text"
                    value={margin}
                    onChange={e => setMargin(e.target.value)}
                    placeholder="0px or 4px"
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2 py-1.5 text-xs text-[#333333]"
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-3 border-t border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[11px] text-[#888888] hover:text-[#A93232] flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Default</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3.5 py-1.5 rounded-[8px] border border-[#E1DCDC] text-xs font-medium text-[#666666] hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-[8px] bg-[#0A0A0A] hover:bg-[#333333] text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#43866B]" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Modification</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

