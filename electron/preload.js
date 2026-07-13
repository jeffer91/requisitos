/* =========================================================
Nombre completo: preload.js
Ruta o ubicacion: /Requisitos/electron/preload.js
Funcion o funciones:
- Exponer una API minima de Electron al navegador.
- Permitir que las pantallas detecten que corren en Electron sin activar nodeIntegration.
- Abrir enlaces externos mediante el proceso principal.
- Exponer funciones seguras para abrir, navegar y probar lectura en SISACAD desde Sacar N.
Con que se conecta:
- electron/main.js
- Maqueta/maq-index.html
- sn-sacar-n/sn-sisacad-browser.service.js
- sn-sacar-n/sn-sisacad-navigation.service.js
- sn-sacar-n/sn-sisacad-extractor.service.js
========================================================= */
const { contextBridge, ipcRenderer } = require('electron');

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
