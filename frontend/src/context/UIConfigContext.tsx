import React, { createContext, useContext, useState, useEffect } from 'react';
import { RoleName, ElementCustomization } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface UIConfigContextType {
  customizationRole: RoleName;
  setCustomizationRole: (role: RoleName) => void;
  uiConfig: Record<string, any>;
  updateConfig: (componentKey: string, newConfig: any) => Promise<void>;
  isEditorOpen: boolean;
  setIsEditorOpen: (open: boolean) => void;
  isDirectEditingMode: boolean;
  setIsDirectEditingMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
  directEdits: Record<string, ElementCustomization>;
  saveDirectEdit: (elementKey: string, customization: ElementCustomization) => Promise<void>;
  removeDirectEdit: (elementKey: string) => Promise<void>;
  resetAllDirectEdits: () => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const UIConfigContext = createContext<UIConfigContextType | undefined>(undefined);

const CACHE_KEY = (role: string) => `avd_ui_config_${role}`;

const generateDirectEditsCSS = (directEdits: Record<string, ElementCustomization>): string => {
  const rules: string[] = [];

  for (const [key, custom] of Object.entries(directEdits)) {
    if (!custom) continue;

    const selectors: string[] = [];
    if (custom.selector) {
      selectors.push(custom.selector);
    }
    selectors.push(`[data-ui-editable="${key}"]`);
    selectors.push(`[data-ui-key="${key}"]`);
    if (key.startsWith('el_')) {
      selectors.push(`#${key.replace('el_', '')}`);
    }

    const declarations: string[] = [];
    if (custom.fontSize) declarations.push(`font-size: ${custom.fontSize} !important;`);
    if (custom.fontWeight) declarations.push(`font-weight: ${custom.fontWeight} !important;`);
    if (custom.textColor) declarations.push(`color: ${custom.textColor} !important;`);
    if (custom.backgroundColor) declarations.push(`background-color: ${custom.backgroundColor} !important;`);
    if (custom.border) declarations.push(`border: ${custom.border} !important;`);
    if (custom.borderRadius) declarations.push(`border-radius: ${custom.borderRadius} !important;`);
    if (custom.width) declarations.push(`width: ${custom.width} !important;`);
    if (custom.height) declarations.push(`height: ${custom.height} !important;`);
    if (custom.visibility) declarations.push(`visibility: ${custom.visibility} !important;`);
    if (custom.padding) declarations.push(`padding: ${custom.padding} !important;`);
    if (custom.margin) declarations.push(`margin: ${custom.margin} !important;`);

    if (declarations.length > 0) {
      rules.push(`${selectors.join(', ')} {\n  ${declarations.join('\n  ')}\n}`);
    }
  }

  return rules.join('\n\n');
};

const applyDirectEditsToDOM = (directEdits: Record<string, ElementCustomization>) => {
  for (const [key, custom] of Object.entries(directEdits)) {
    if (!custom) continue;

    let el: HTMLElement | null = null;
    if (custom.selector) {
      try {
        el = document.querySelector(custom.selector);
      } catch (e) {}
    }
    if (!el) {
      el = document.querySelector(`[data-ui-editable="${key}"]`);
    }
    if (!el) {
      el = document.querySelector(`[data-ui-key="${key}"]`);
    }
    if (!el && key.startsWith('el_')) {
      el = document.getElementById(key.replace('el_', ''));
    }

    if (el) {
      if (!el.hasAttribute('data-ui-key')) {
        el.setAttribute('data-ui-key', key);
      }

      // Apply text if present
      if (custom.text !== undefined && custom.text !== null && custom.text.trim() !== '') {
        if (el.children.length === 0) {
          if (el.textContent !== custom.text) {
            el.textContent = custom.text;
          }
        } else {
          const textNode = (Array.from(el.childNodes) as ChildNode[]).find(
            n => n.nodeType === Node.TEXT_NODE && Boolean(n.textContent && n.textContent.trim().length > 0)
          );
          if (textNode) {
            if (textNode.textContent?.trim() !== custom.text.trim()) {
              textNode.textContent = ` ${custom.text.trim()} `;
            }
          } else {
            const childSpan = el.querySelector('span:not([class*="lucide"])') as HTMLElement;
            if (childSpan && childSpan.children.length === 0) {
              if (childSpan.textContent !== custom.text) {
                childSpan.textContent = custom.text;
              }
            }
          }
        }
      }

      // Apply styles as inline overrides to ensure 100% adherence
      if (custom.fontSize && el.style.fontSize !== custom.fontSize) el.style.fontSize = custom.fontSize;
      if (custom.fontWeight && el.style.fontWeight !== custom.fontWeight) el.style.fontWeight = custom.fontWeight;
      if (custom.textColor && el.style.color !== custom.textColor) el.style.color = custom.textColor;
      if (custom.backgroundColor && el.style.backgroundColor !== custom.backgroundColor) el.style.backgroundColor = custom.backgroundColor;
      if (custom.border && el.style.border !== custom.border) el.style.border = custom.border;
      if (custom.borderRadius && el.style.borderRadius !== custom.borderRadius) el.style.borderRadius = custom.borderRadius;
      if (custom.width && el.style.width !== custom.width) el.style.width = custom.width;
      if (custom.height && el.style.height !== custom.height) el.style.height = custom.height;
      if (custom.visibility && el.style.visibility !== custom.visibility) el.style.visibility = custom.visibility;
      if (custom.padding && el.style.padding !== custom.padding) el.style.padding = custom.padding;
      if (custom.margin && el.style.margin !== custom.margin) el.style.margin = custom.margin;
    }
  }
};

export const UIConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [customizationRole, setCustomizationRole] = useState<RoleName>('Developer');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirectEditingMode, setIsDirectEditingMode] = useState(false);

  // Initialize from localStorage cache immediately to eliminate any render flicker
  const [uiConfig, setUiConfig] = useState<Record<string, any>>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY('Developer')) || localStorage.getItem('avd_ui_config_global');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {};
  });

  // Load config for active target role
  const activeTargetRole = (user?.role_name === 'Developer' ? customizationRole : user?.role_name) || 'Developer';

  const loadConfig = async () => {
    try {
      const res = await api.getUIConfig(activeTargetRole);
      const configs = res.configurations || {};
      setUiConfig(configs);
      try {
        localStorage.setItem(CACHE_KEY(activeTargetRole), JSON.stringify(configs));
        localStorage.setItem('avd_ui_config_global', JSON.stringify(configs));
      } catch (e) {}
    } catch (err) {
      console.error('Failed to load UI config:', err);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [activeTargetRole]);

  // Apply theme settings to DOM root and body live
  useEffect(() => {
    const theme = uiConfig.global_theme;
    if (theme) {
      const root = document.documentElement;
      if (theme.backgroundColor) {
        root.style.setProperty('--avd-bg-color', theme.backgroundColor);
        document.body.style.backgroundColor = theme.backgroundColor;
      }
      if (theme.cardBackgroundColor) {
        root.style.setProperty('--avd-card-bg', theme.cardBackgroundColor);
      }
      if (theme.primaryButtonColor) {
        root.style.setProperty('--avd-primary-btn', theme.primaryButtonColor);
      }
      if (theme.cardBorderRadius) {
        root.style.setProperty('--avd-card-radius', theme.cardBorderRadius);
      }
      if (theme.buttonBorderRadius) {
        root.style.setProperty('--avd-btn-radius', theme.buttonBorderRadius);
      }
      if (theme.logoBorderRadius) {
        root.style.setProperty('--avd-logo-radius', theme.logoBorderRadius);
      }
    }
  }, [uiConfig.global_theme]);

  const directEdits: Record<string, ElementCustomization> = uiConfig['direct_edits'] || {};

  // Continuous DOM applicator & dynamic CSS injection to ensure edits NEVER revert on render
  useEffect(() => {
    // 1. Inject or update dynamic stylesheet
    const styleId = 'avd-direct-edits-styles';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = generateDirectEditsCSS(directEdits);

    // 2. Apply to current DOM
    applyDirectEditsToDOM(directEdits);

    // 3. Setup MutationObserver so any re-renders, route changes, data loads stay updated!
    let rafId: number | null = null;
    const observer = new MutationObserver((mutations) => {
      const isInternal = mutations.some(m => {
        const target = m.target as HTMLElement;
        return target && (target.id === 'direct-ui-toolbar' || target.closest?.('#direct-ui-toolbar') || target.closest?.('.lucide'));
      });
      if (isInternal) return;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        applyDirectEditsToDOM(directEdits);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [directEdits]);

  const updateConfig = async (componentKey: string, newConfig: any) => {
    const jsonStr = JSON.stringify(newConfig);
    await api.saveUIConfig(customizationRole, componentKey, jsonStr);
    setUiConfig(prev => {
      const updated = {
        ...prev,
        [componentKey]: newConfig
      };
      try {
        localStorage.setItem(CACHE_KEY(customizationRole), JSON.stringify(updated));
        localStorage.setItem('avd_ui_config_global', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const saveDirectEdit = async (elementKey: string, customization: ElementCustomization) => {
    const updated = {
      ...(uiConfig['direct_edits'] || {}),
      [elementKey]: customization,
    };
    await updateConfig('direct_edits', updated);
  };

  const removeDirectEdit = async (elementKey: string) => {
    const current = { ...(uiConfig['direct_edits'] || {}) };
    const removedCustomization = current[elementKey];
    delete current[elementKey];
    await updateConfig('direct_edits', current);

    // Clean up DOM element immediately on revert
    const el = document.querySelector(`[data-ui-key="${elementKey}"]`) || 
               document.querySelector(`[data-ui-editable="${elementKey}"]`) ||
               (elementKey.startsWith('el_') ? document.getElementById(elementKey.replace('el_', '')) : null) ||
               (removedCustomization?.selector ? document.querySelector(removedCustomization.selector) : null);

    if (el) {
      (el as HTMLElement).removeAttribute('style');
      (el as HTMLElement).removeAttribute('data-ui-key');
      if (removedCustomization?.originalText) {
        if (el.children.length === 0) {
          el.textContent = removedCustomization.originalText;
        } else {
          const textNode = (Array.from(el.childNodes) as ChildNode[]).find(
            n => n.nodeType === Node.TEXT_NODE && Boolean(n.textContent?.trim())
          );
          if (textNode) {
            textNode.textContent = ` ${removedCustomization.originalText} `;
          }
        }
      }
    }
  };

  const resetAllDirectEdits = async () => {
    await updateConfig('direct_edits', {});
    const styleTag = document.getElementById('avd-direct-edits-styles');
    if (styleTag) styleTag.textContent = '';
    document.querySelectorAll('[data-ui-key]').forEach(node => {
      const el = node as HTMLElement;
      el.removeAttribute('style');
      el.removeAttribute('data-ui-key');
    });
  };

  return (
    <UIConfigContext.Provider
      value={{
        customizationRole,
        setCustomizationRole,
        uiConfig,
        updateConfig,
        isEditorOpen,
        setIsEditorOpen,
        isDirectEditingMode,
        setIsDirectEditingMode,
        directEdits,
        saveDirectEdit,
        removeDirectEdit,
        resetAllDirectEdits,
        refreshConfig: loadConfig,
      }}
    >
      {children}
    </UIConfigContext.Provider>
  );
};

export const useUIConfig = () => {
  const context = useContext(UIConfigContext);
  if (!context) throw new Error('useUIConfig must be used within an UIConfigProvider');
  return context;
};
