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

/**
 * Detecta se o token está corrompido (formato de bytes: -79$-36$-9...)
 * Tokens válidos são alfanuméricos com alguns caracteres especiais permitidos
 */
function isTokenCorrupted(token: string): boolean {
  if (!token || token.length < 10) return false;
  
  // Padrão de token corrompido: contém números negativos separados por $
  // Ex: "-79$-36$-9$45$..." ou "123$-45$67$..."
  const corruptedPattern = /\$-?\d+\$/;
  if (corruptedPattern.test(token)) {
    return true;
  }
  
  // Tokens válidos geralmente são base64 ou alfanuméricos
  // Tokens corrompidos têm muitos $ e números negativos
  const dollarCount = (token.match(/\$/g) || []).length;
  if (dollarCount > 10) {
    return true;
  }
  
  return false;
}

export function useInflexConfig() {
  const [config, setConfig] = useState<InflexConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const token = parsed.token || '';
        
        // Se o token está corrompido, limpar e avisar
        if (isTokenCorrupted(token)) {
          console.warn('[useInflexConfig] Token corrompido detectado! Limpando configuração.');
          console.warn('[useInflexConfig] Token preview:', token.substring(0, 30) + '...');
          localStorage.removeItem(STORAGE_KEY);
          return DEFAULT_CONFIG;
        }
        
        return {
          baseUrl: parsed.baseUrl || '',
          token: token,
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
      // Não salvar se o token está corrompido
      if (isTokenCorrupted(config.token)) {
        console.warn('[useInflexConfig] Tentativa de salvar token corrompido bloqueada');
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('[useInflexConfig] Erro ao salvar localStorage:', error);
    }
  }, [config]);

  const updateConfig = useCallback((newConfig: Partial<InflexConfig>) => {
    // Validar token antes de salvar
    if (newConfig.token && isTokenCorrupted(newConfig.token)) {
      console.error('[useInflexConfig] Token corrompido rejeitado:', newConfig.token.substring(0, 30) + '...');
      return; // Não atualizar com token corrompido
    }
    
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

  // Verifica se a configuração está completa e válida
  const isConfigured = 
    config.baseUrl.trim() !== '' && 
    config.token.trim() !== '' && 
    !isTokenCorrupted(config.token);

  // Verifica se pelo menos um campo está preenchido
  const hasPartialConfig = config.baseUrl.trim() !== '' || config.token.trim() !== '';
  
  // Flag para indicar se o token atual está corrompido
  const isTokenInvalid = isTokenCorrupted(config.token);

  return {
    config,
    updateConfig,
    clearConfig,
    isConfigured,
    hasPartialConfig,
    isTokenInvalid,
  };
}
