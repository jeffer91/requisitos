/* =========================================================
Nombre completo: preload.js
Ruta o ubicacion: /Requisitos/electron/preload.js
Funcion o funciones:
- Exponer una API minima de Electron al navegador.
- Permitir que las pantallas detecten que corren en Electron sin activar nodeIntegration.
- Abrir enlaces externos mediante el proceso principal.
Con que se conecta:
- electron/main.js
- Maqueta/maq-index.html
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
  openExternal: (url) => ipcRenderer.invoke('requisitos:open-external', String(url || ''))
});

window.addEventListener('DOMContentLoaded', () => {
  try {
    document.documentElement.setAttribute('data-runtime', 'electron');
  } catch (error) {}
});
