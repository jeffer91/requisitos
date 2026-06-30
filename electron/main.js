/* =========================================================
Nombre completo: main.js
Ruta o ubicacion: /Requisitos/electron/main.js
Funcion o funciones:
- Abrir la aplicacion Requisitos desde npm start.
- Cargar Maqueta/maq-index.html como pantalla principal.
- Mantener Electron simple, local y seguro.
- Bloquear navegacion externa dentro de la ventana principal y abrir enlaces externos seguros fuera de la app.
- Permitir enlaces http/https y mailto para abrir navegador, Outlook o cliente de correo predeterminado.
- Abrir SISACAD en una ventana visible independiente para el modulo Sacar N.
- Navegar de forma controlada hasta Registro Notas Proyecto sin modificar informacion academica.
- Ejecutar prueba visible y extraccion automatica controlada.
- Exponer funciones controladas mediante preload.js.
Con que se conecta:
- package.json
- electron/preload.js
- electron/sn-sisacad-automation.js
- Maqueta/maq-index.html
- sn-sacar-n/sn-sisacad-browser.service.js
- sn-sacar-n/sn-sisacad-navigation.service.js
- sn-sacar-n/sn-sisacad-extractor.service.js
- Coordi/coo.mail.js
========================================================= */
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const snSisacadAutomation = require('./sn-sisacad-automation');

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

function isExternalHttp(url) { return /^https?:\/\//i.test(String(url || '')); }
function isExternalMailto(url) { return /^mailto:/i.test(String(url || '')); }
function isOpenableExternal(url) { return isExternalHttp(url) || isExternalMailto(url); }

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
  const candidates = [path.join(APP_ROOT, 'Maqueta', 'maq-index.html'), path.join(APP_ROOT, 'index.html')];
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  throw new Error('No se encontro Maqueta/maq-index.html ni index.html para iniciar Requisitos.');
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

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

  snSisacadWindow.on('closed', () => { snSisacadWindow = null; });

  snSisacadWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSisacadUrl(url)) return { action: 'allow' };
    if (isOpenableExternal(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  snSisacadWindow.webContents.on('will-navigate', (event, url) => {
    if (isSisacadUrl(url)) return;
    event.preventDefault();
    if (isOpenableExternal(url)) shell.openExternal(url);
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
  if (snSisacadWindow && !snSisacadWindow.isDestroyed()) snSisacadWindow.close();
  return getSisacadWindowStatus();
}

function ensureSisacadOpen() {
  if (snSisacadWindow && !snSisacadWindow.isDestroyed()) {
    focusSisacadWindow();
    return Promise.resolve(getSisacadWindowStatus());
  }
  return openSisacadWindow();
}

function pageStatusScript() {
  return `(() => {
    const normalize = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .toLowerCase()
      .replace(/\\s+/g, ' ')
      .trim();
    const bodyText = normalize(document.body ? document.body.innerText : '');
    const title = document.title || '';
    const url = location.href;
    const hasAny = (terms) => terms.some((term) => bodyText.includes(normalize(term)));
    const hasUser = hasAny(['usuario', 'user', 'correo']);
    const hasPassword = hasAny(['contraseña', 'contrasena', 'password', 'clave']);
    const necesitaLogin = (hasUser && hasPassword) || hasAny(['iniciar sesion', 'iniciar sesión', 'login']);
    const enRegistro = hasAny([
      'registro notas proyecto',
      'registro de notas proyecto',
      'notas proyecto',
      'promedio trabajo escrito',
      'promedio defensa oral del proyecto de titulacion',
      'promedio defensa oral del proyecto de titulación',
      'calificacion final del proyecto de titulacion',
      'calificación final del proyecto de titulación'
    ]);
    return { ok:true, url, title, necesitaLogin, enRegistro, textoMuestra: bodyText.slice(0, 1200) };
  })()`;
}

function clickTextScript(texts) {
  return `(() => {
    const wanted = ${JSON.stringify(texts || [])};
    const normalize = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .toLowerCase()
      .replace(/\\s+/g, ' ')
      .trim();
    const terms = wanted.map(normalize).filter(Boolean);
    const selectors = 'a,button,input[type="button"],input[type="submit"],[role="button"],[onclick],li,span,div';
    const nodes = Array.from(document.querySelectorAll(selectors));
    const candidates = [];
    for (const node of nodes) {
      const raw = node.innerText || node.textContent || node.value || node.title || node.getAttribute('aria-label') || '';
      const label = normalize(raw);
      if (!label || label.length > 180) continue;
      for (const term of terms) {
        if (label === term || label.includes(term)) {
          candidates.push({ node, label, term, exact: label === term });
          break;
        }
      }
    }
    candidates.sort((a, b) => Number(b.exact) - Number(a.exact) || a.label.length - b.label.length);
    const found = candidates[0];
    if (!found) return { ok:false, clicked:false, reason:'texto_no_encontrado', buscado:wanted };
    const target = found.node.closest('a,button,[role="button"],[onclick],li') || found.node;
    try { target.scrollIntoView({ block:'center', inline:'center' }); } catch (error) {}
    try { target.dispatchEvent(new MouseEvent('mouseover', { bubbles:true, cancelable:true, view:window })); } catch (error) {}
    try { target.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, view:window })); } catch (error) {}
    try { target.dispatchEvent(new MouseEvent('mouseup', { bubbles:true, cancelable:true, view:window })); } catch (error) {}
    try { target.click(); } catch (error) {
      return { ok:false, clicked:false, reason:'click_error', error:error.message, label:found.label };
    }
    return { ok:true, clicked:true, label:found.label, buscado:wanted };
  })()`;
}

async function executeInSisacad(script) {
  if (!snSisacadWindow || snSisacadWindow.isDestroyed()) return { ok: false, error: 'SISACAD no esta abierto.' };
  try { return await snSisacadWindow.webContents.executeJavaScript(script, true); }
  catch (error) { return { ok: false, error: error.message }; }
}

async function checkRegistroNotasProyecto() {
  await ensureSisacadOpen();
  const page = await executeInSisacad(pageStatusScript());
  return Object.assign({}, getSisacadWindowStatus(), page || {});
}

async function navigateRegistroNotasProyecto() {
  await ensureSisacadOpen();
  await wait(800);
  let page = await executeInSisacad(pageStatusScript());

  if (page && page.necesitaLogin) {
    return Object.assign({}, getSisacadWindowStatus(), page, {
      ok: false,
      necesitaLogin: true,
      mensaje: 'SISACAD necesita inicio de sesion manual. Ingrese en la ventana visible y vuelva a intentar.'
    });
  }

  if (page && page.enRegistro) {
    return Object.assign({}, getSisacadWindowStatus(), page, {
      ok: true,
      enRegistro: true,
      mensaje: 'SISACAD ya esta en Registro Notas Proyecto.'
    });
  }

  const ingreso = await executeInSisacad(clickTextScript(['Ingreso', 'INGRESO']));
  await wait(1200);
  page = await executeInSisacad(pageStatusScript());

  if (page && page.necesitaLogin) {
    return Object.assign({}, getSisacadWindowStatus(), page, {
      ok: false,
      necesitaLogin: true,
      paso: 'Ingreso',
      mensaje: 'SISACAD necesita inicio de sesion manual. Ingrese en la ventana visible y vuelva a intentar.'
    });
  }

  let registro = await executeInSisacad(clickTextScript([
    'Registro Notas Proyecto',
    'Registro de Notas Proyecto',
    'Registro Notas Proyecto de Titulacion',
    'Registro Notas Proyecto de Titulación',
    'Notas Proyecto',
    'Notas Proyecto de Titulacion',
    'Notas Proyecto de Titulación'
  ]));
  await wait(1500);
  page = await executeInSisacad(pageStatusScript());

  if (page && page.enRegistro) {
    return Object.assign({}, getSisacadWindowStatus(), page, {
      ok: true,
      enRegistro: true,
      paso: 'Registro Notas Proyecto',
      clickIngreso: ingreso,
      clickRegistro: registro,
      mensaje: 'SISACAD esta en Registro Notas Proyecto.'
    });
  }

  registro = await executeInSisacad(clickTextScript(['Registro Notas Proyecto', 'Registro de Notas Proyecto', 'Notas Proyecto']));
  await wait(1500);
  page = await executeInSisacad(pageStatusScript());

  return Object.assign({}, getSisacadWindowStatus(), page || {}, {
    ok: !!(page && page.enRegistro),
    enRegistro: !!(page && page.enRegistro),
    clickIngreso: ingreso,
    clickRegistro: registro,
    mensaje: page && page.enRegistro
      ? 'SISACAD esta en Registro Notas Proyecto.'
      : 'No se pudo llegar automaticamente a Registro Notas Proyecto. Puede navegar manualmente en la ventana visible y luego continuar.'
  });
}

function automationContext() {
  return {
    getWindow: () => snSisacadWindow,
    ensureOpen: ensureSisacadOpen,
    status: getSisacadWindowStatus
  };
}

async function runPruebaVisible(estudiantes) {
  return snSisacadAutomation.runPruebaVisible(estudiantes, automationContext());
}

async function runExtraccionAutomatica(estudiantes) {
  return snSisacadAutomation.runExtraccionAutomatica(estudiantes, automationContext());
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
  mainWindow.once('ready-to-show', () => { if (mainWindow) mainWindow.show(); });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isOpenableExternal(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    if (isInsideApp(url)) return { action: 'allow' };
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isOpenableExternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
      return;
    }
    if (!isInsideApp(url)) event.preventDefault();
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
  if (!isOpenableExternal(url)) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('sn:sisacad-open', async () => openSisacadWindow());
ipcMain.handle('sn:sisacad-status', () => getSisacadWindowStatus());
ipcMain.handle('sn:sisacad-focus', () => focusSisacadWindow());
ipcMain.handle('sn:sisacad-close', () => closeSisacadWindow());
ipcMain.handle('sn:sisacad-check-registro', async () => checkRegistroNotasProyecto());
ipcMain.handle('sn:sisacad-navigate-registro', async () => navigateRegistroNotasProyecto());
ipcMain.handle('sn:sisacad-prueba-visible', async (_event, estudiantes) => runPruebaVisible(estudiantes));
ipcMain.handle('sn:sisacad-extraccion-automatica', async (_event, estudiantes) => runExtraccionAutomatica(estudiantes));

app.whenReady().then(createMainWindow).catch((error) => {
  console.error('[Requisitos Electron] No se pudo iniciar:', error);
  app.quit();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
