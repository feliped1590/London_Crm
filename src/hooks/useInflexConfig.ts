/**
 * Hook para gerenciar credenciais da API Iniflex
 * 
 * Armazena URL e Token no localStorage do navegador.
 * Isso garante que as credenciais são explícitas e visíveis,
 * sem depender de variáveis de ambiente ou Vault.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'iniflex-crm-config';

export interface InflexConfig {
  baseUrl: string;
  token: string;
}

const DEFAULT_CONFIG: InflexConfig = {
  baseUrl: '',
  token: '',
};

export function useInflexConfig() {
  const [config, setConfig] = useState<InflexConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          baseUrl: parsed.baseUrl || '',
          token: parsed.token || '',
        };
      }
    } catch (error) {
      console.error('[useInflexConfig] Erro ao ler localStorage:', error);
    }
    return DEFAULT_CONFIG;
  });

  // Sincroniza com localStorage sempre que config mudar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('[useInflexConfig] Erro ao salvar localStorage:', error);
    }
  }, [config]);

  const updateConfig = useCallback((newConfig: Partial<InflexConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...newConfig,
    }));
  }, []);

  const clearConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[useInflexConfig] Erro ao limpar localStorage:', error);
    }
  }, []);

  // Verifica se a configuração está completa
  const isConfigured = config.baseUrl.trim() !== '' && config.token.trim() !== '';

  // Verifica se pelo menos um campo está preenchido
  const hasPartialConfig = config.baseUrl.trim() !== '' || config.token.trim() !== '';
  
  return {
    config,
    updateConfig,
    clearConfig,
    isConfigured,
    hasPartialConfig,
  };
}
