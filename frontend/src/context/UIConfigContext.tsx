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
  refreshConfig: () => Promise<void>;
}

const UIConfigContext = createContext<UIConfigContextType | undefined>(undefined);

export const UIConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [customizationRole, setCustomizationRole] = useState<RoleName>('Developer');
  const [uiConfig, setUiConfig] = useState<Record<string, any>>({});
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirectEditingMode, setIsDirectEditingMode] = useState(false);

  // By default, load config for current active role (or customization role if developer)
  const activeTargetRole = (user?.role_name === 'Developer' ? customizationRole : user?.role_name) || 'Developer';

  const loadConfig = async () => {
    try {
      const res = await api.getUIConfig(activeTargetRole);
      setUiConfig(res.configurations || {});
    } catch (err) {
      console.error('Failed to load UI config:', err);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [activeTargetRole]);

  const updateConfig = async (componentKey: string, newConfig: any) => {
    const jsonStr = JSON.stringify(newConfig);
    await api.saveUIConfig(customizationRole, componentKey, jsonStr);
    setUiConfig(prev => ({
      ...prev,
      [componentKey]: newConfig
    }));
  };

  const directEdits: Record<string, ElementCustomization> = uiConfig['direct_edits'] || {};

  const saveDirectEdit = async (elementKey: string, customization: ElementCustomization) => {
    const updated = {
      ...(uiConfig['direct_edits'] || {}),
      [elementKey]: customization,
    };
    await updateConfig('direct_edits', updated);
  };

  const removeDirectEdit = async (elementKey: string) => {
    const current = { ...(uiConfig['direct_edits'] || {}) };
    delete current[elementKey];
    await updateConfig('direct_edits', current);
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

