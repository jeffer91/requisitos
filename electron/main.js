/* =========================================================
Nombre completo: main.js
Ruta o ubicacion: /Requisitos/electron/main.js
Funcion o funciones:
- Abrir la aplicacion Requisitos desde npm start.
- Cargar Maqueta/maq-index.html como pantalla principal.
- Mantener Electron simple, local y seguro.
- Bloquear navegacion externa dentro de la ventana principal y abrir enlaces externos en el navegador.
- Abrir SISACAD en una ventana visible independiente para el modulo Sacar N.
- Exponer funciones controladas mediante preload.js.
Con que se conecta:
- package.json
- electron/preload.js
- Maqueta/maq-index.html
- sn-sacar-n/sn-sisacad-browser.service.js
========================================================= */
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const APP_ROOT = path.resolve(__dirname, '..');
const SN_SISACAD_URL = 'https://sisacad.itsqmet.edu.ec/';

let mainWindow = null;
let snSisacadWindow = null;

function normalizeFilePath(fileUrl) {
  try {
    if (!fileUrl || !fileUrl.startsWith('file://')) return '';
    return decodeURIComponent(new URL(fileUrl).pathname).replace(/^\/(.:\/)/, '$1');
  } catch (error) {
    return '';
  }
}

function isInsideApp(url) {
  if (!url || url === 'about:blank') return true;
  if (!url.startsWith('file://')) return false;

  const currentPath = normalizeFilePath(url);
  if (!currentPath) return false;

  const resolved = path.resolve(currentPath);
  return resolved.startsWith(APP_ROOT) || resolved.startsWith(path.resolve(APP_ROOT, '..'));
}

function isExternalHttp(url) {
  return /^https?:\/\//i.test(String(url || ''));
}

function isSisacadUrl(url) {
  try {
    if (!url || url === 'about:blank') return true;
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'sisacad.itsqmet.edu.ec';
  } catch (error) {
    return false;
  }
}

function findEntryFile() {
  const candidates = [
    path.join(APP_ROOT, 'Maqueta', 'maq-index.html'),
    path.join(APP_ROOT, 'index.html')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error('No se encontro Maqueta/maq-index.html ni index.html para iniciar Requisitos.');
}

function getSisacadWindowStatus() {
  const abierta = !!(snSisacadWindow && !snSisacadWindow.isDestroyed());
  return {
    ok: true,
    abierta,
    url: abierta ? snSisacadWindow.webContents.getURL() : '',
    titulo: abierta ? snSisacadWindow.getTitle() : '',
    visible: abierta ? snSisacadWindow.isVisible() : false,
    enfocada: abierta ? snSisacadWindow.isFocused() : false,
    sesionPersistente: true,
    soloLectura: true,
    guardaContrasena: false
  };
}

async function openSisacadWindow() {
  if (snSisacadWindow && !snSisacadWindow.isDestroyed()) {
    if (snSisacadWindow.isMinimized()) snSisacadWindow.restore();
    snSisacadWindow.show();
    snSisacadWindow.focus();
    return getSisacadWindowStatus();
  }

  snSisacadWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 650,
    show: false,
    backgroundColor: '#ffffff',
    title: 'SISACAD - Sacar N',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:requisitos-sacar-n-sisacad'
    }
  });

  snSisacadWindow.once('ready-to-show', () => {
    if (snSisacadWindow && !snSisacadWindow.isDestroyed()) snSisacadWindow.show();
  });

  snSisacadWindow.on('closed', () => {
    snSisacadWindow = null;
  });

  snSisacadWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSisacadUrl(url)) return { action: 'allow' };
    if (isExternalHttp(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  snSisacadWindow.webContents.on('will-navigate', (event, url) => {
    if (isSisacadUrl(url)) return;
    event.preventDefault();
    if (isExternalHttp(url)) shell.openExternal(url);
  });

  snSisacadWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Sacar N SISACAD] Error de carga:', errorCode, errorDescription, validatedURL);
  });

  await snSisacadWindow.loadURL(SN_SISACAD_URL);
  return getSisacadWindowStatus();
}

function focusSisacadWindow() {
  if (snSisacadWindow && !snSisacadWindow.isDestroyed()) {
    if (snSisacadWindow.isMinimized()) snSisacadWindow.restore();
    snSisacadWindow.show();
    snSisacadWindow.focus();
  }
  return getSisacadWindowStatus();
}

function closeSisacadWindow() {
  if (snSisacadWindow && !snSisacadWindow.isDestroyed()) {
    snSisacadWindow.close();
  }
  return getSisacadWindowStatus();
}

function createMainWindow() {
  const entryFile = findEntryFile();

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    backgroundColor: '#f8fafc',
    title: 'Requisitos',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttp(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    if (isInsideApp(url)) return { action: 'allow' };

    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isExternalHttp(url)) {
      event.preventDefault();
      shell.openExternal(url);
      return;
    }

    if (!isInsideApp(url)) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Requisitos Electron] Error de carga:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.loadFile(entryFile);
}

ipcMain.handle('requisitos:get-app-info', () => ({
  appName: 'Requisitos',
  appRoot: APP_ROOT,
  entry: pathToFileURL(findEntryFile()).toString(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform
}));

ipcMain.handle('requisitos:open-external', async (_event, url) => {
  if (!isExternalHttp(url)) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('sn:sisacad-open', async () => openSisacadWindow());
ipcMain.handle('sn:sisacad-status', () => getSisacadWindowStatus());
ipcMain.handle('sn:sisacad-focus', () => focusSisacadWindow());
ipcMain.handle('sn:sisacad-close', () => closeSisacadWindow());

app.whenReady().then(createMainWindow).catch((error) => {
  console.error('[Requisitos Electron] No se pudo iniciar:', error);
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
