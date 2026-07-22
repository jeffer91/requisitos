/* =========================================================
Nombre completo: preload.js
Ruta o ubicación: /Requisitos/electron/preload.js
Función o funciones:
- Exponer una API mínima de Electron al navegador.
- Permitir que las pantallas detecten que corren en Electron sin activar nodeIntegration.
- Abrir enlaces externos mediante el proceso principal.
- Exponer el puente seguro y limitado para AutoSync de Base Local.
- Exponer funciones seguras para abrir, navegar y probar lectura en SISACAD desde Sacar N.
Con qué se conecta:
- electron/main.js
- electron/main-safe.js
- Maqueta/maq-index.html
- sn-sacar-n/sn-sisacad-browser.service.js
- sn-sacar-n/sn-sisacad-navigation.service.js
- sn-sacar-n/sn-sisacad-extractor.service.js
========================================================= */
const { contextBridge, ipcRenderer } = require('electron');

function cleanText(value, maxLength) {
  return String(value === null || value === undefined ? '' : value)
    .trim()
    .slice(0, Number(maxLength || 180));
}

function cleanTarget(value) {
  const target = cleanText(value, 20).toLowerCase();
  return ['google', 'firebase', 'supabase'].includes(target) ? target : '';
}

function cleanTargets(values) {
  return (Array.isArray(values) ? values : [])
    .map(cleanTarget)
    .filter(Boolean)
    .slice(0, 3);
}

function cleanLimit(value) {
  const limit = Math.floor(Number(value || 5));
  return Math.min(25, Math.max(1, Number.isFinite(limit) ? limit : 5));
}

contextBridge.exposeInMainWorld('electronAPI', {
  runtime: 'electron',
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  getAppInfo: () => ipcRenderer.invoke('requisitos:get-app-info'),
  openExternal: (url) => ipcRenderer.invoke('requisitos:open-external', String(url || '')),
  baseLocalSync: {
    status: () => ipcRenderer.invoke('requisitos:sync-status'),
    installConfirmationGuard: () => ipcRenderer.invoke('requisitos:sync-install-guard'),
    snapshot: (options) => {
      options = options && typeof options === 'object' ? options : {};
      return ipcRenderer.invoke('requisitos:sync-snapshot', {
        targets: cleanTargets(options.targets),
        forceRetry: options.forceRetry === true
      });
    },
    request: (options) => {
      options = options && typeof options === 'object' ? options : {};
      return ipcRenderer.invoke('requisitos:sync-request', {
        target: cleanTarget(options.target),
        periodoId: cleanText(options.periodoId, 120),
        periodoLabel: cleanText(options.periodoLabel || options.periodoId, 120),
        source: cleanText(options.source || 'MAQAutoSync.preload', 120),
        limit: cleanLimit(options.limit),
        forceRetry: options.forceRetry === true
      });
    },
    getIdleState: () => ipcRenderer.invoke('requisitos:sync-idle-state')
  },
  sacarN: {
    openSisacad: () => ipcRenderer.invoke('sn:sisacad-open'),
    getSisacadStatus: () => ipcRenderer.invoke('sn:sisacad-status'),
    focusSisacad: () => ipcRenderer.invoke('sn:sisacad-focus'),
    closeSisacad: () => ipcRenderer.invoke('sn:sisacad-close'),
    checkRegistroNotasProyecto: () => ipcRenderer.invoke('sn:sisacad-check-registro'),
    navigateRegistroNotasProyecto: () => ipcRenderer.invoke('sn:sisacad-navigate-registro'),
    runPruebaVisible: (estudiantes) => ipcRenderer.invoke('sn:sisacad-prueba-visible', Array.isArray(estudiantes) ? estudiantes : [])
  }
});

window.addEventListener('DOMContentLoaded', () => {
  try {
    document.documentElement.setAttribute('data-runtime', 'electron');
  } catch (error) {}
});
