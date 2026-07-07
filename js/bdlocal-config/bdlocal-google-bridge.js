/*
  Archivo: bdlocal-google-bridge.js
  Ruta: js/bdlocal-config/bdlocal-google-bridge.js

  Función:
  - Evitar dos rutas distintas de Google Sheets.
  - Hacer que el botón antiguo de BL2 y la sincronización automática usen BDLocalSyncManager.
  - BDLocalSyncManager sí envía token, spreadsheetId y payload multi-tabla al Apps Script.
*/
(function (window, document) {
  'use strict';

  var installed = false;
  var attempts = 0;
  var maxAttempts = 40;

  function manager() {
    return window.BDLocalSyncManager || null;
  }

  function sync() {
    return window.BL2Sync || null;
  }

  function isIdle() {
    var s = sync();

    if (s && typeof s.isIdle === 'function') {
      return s.isIdle();
    }

    return true;
  }

  function log(message, data) {
    try {
      if (window.BDLocalConfigStore && typeof window.BDLocalConfigStore.addLog === 'function') {
        window.BDLocalConfigStore.addLog('sheets', message, 'success', data || {});
      }
    } catch (error) {}
  }

  function install() {
    var s = sync();
    var m = manager();

    attempts += 1;

    if (!s || !m || typeof m.pushLocalToSheets !== 'function') {
      return false;
    }

    if (installed || s.__bdlocalGoogleBridgeInstalled) {
      return true;
    }

    s.__bdlocalOriginalSyncGoogle = s.syncGoogle;
    s.__bdlocalOriginalMaybeSyncGoogleIdle = s.maybeSyncGoogleIdle;
    s.__bdlocalOriginalSyncBeforeClose = s.syncBeforeClose;

    s.syncGoogle = function (options) {
      return m.pushLocalToSheets(Object.assign({}, options || {}, {
        source: 'BL2Sync.bridge.manual'
      }));
    };

    s.maybeSyncGoogleIdle = function (options) {
      options = options || {};

      if (!options.force && !isIdle()) {
        return Promise.resolve({
          ok: true,
          skipped: true,
          reason: 'La app todavía está en uso.'
        });
      }

      return m.pushLocalToSheets(Object.assign({}, options, {
        source: 'BL2Sync.bridge.idle'
      }));
    };

    s.syncBeforeClose = function (options) {
      options = options || {};

      return m.pushLocalToSheets(Object.assign({}, options, {
        force: true,
        source: 'BL2Sync.bridge.close'
      })).then(function (googleResult) {
        if (typeof s.maybeSyncFirebaseDaily !== 'function') {
          return {
            ok: true,
            google: googleResult,
            firebase: {
              ok: true,
              skipped: true,
              reason: 'Firebase no disponible en cierre.'
            }
          };
        }

        return s.maybeSyncFirebaseDaily(Object.assign({}, options, {
          force: false
        })).then(function (firebaseResult) {
          return {
            ok: true,
            google: googleResult,
            firebase: firebaseResult
          };
        });
      });
    };

    s.__bdlocalGoogleBridgeInstalled = true;
    installed = true;

    log('Google Sheets quedó unificado con BDLocalSyncManager.', {
      source: 'bdlocal-google-bridge'
    });

    return true;
  }

  function start() {
    if (install()) return;

    var timer = window.setInterval(function () {
      if (install() || attempts >= maxAttempts) {
        window.clearInterval(timer);
      }
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.addEventListener('bl2:ready', start);
})(window, document);
