/**
 * Exportação centralizada de todos os serviços
 * Uso: import { authService, operacaoService } from '@/services'
 */

export { default as api } from './apiService';
export { default as authService } from './authService';
export { default as operacaoService } from './operacaoService';
export { authService as auth } from './apiService'; // Manter compatibilidade
