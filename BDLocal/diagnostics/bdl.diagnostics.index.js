/* =========================================================
Archivo: bdl.diagnostics.index.js
Ruta: /BDLocal/diagnostics/bdl.diagnostics.index.js
Función:
- Crear el punto de entrada de diagnóstico de BDLocal.
- Registrar eventos técnicos sin depender todavía de una pantalla nueva.
- Preparar diagnóstico visible de reglas, repositorios, servicios, sync y migraciones.
- Cargar una sola instancia del sincronizador automático seguro de Google Sheets.
Con qué se conecta:
- BDLocal/bl2.core.js
- BDLocal/bl2.app.js
- BDLocal/bl2.raw-view.js
- BDLocal/sync/bdl.sync.google-auto.js
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "0.2.0-google-auto-bootstrap";
  var KEY = "REQ_BDL_DIAGNOSTICS_V1";
  var autoLoader = null;

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function read(){
    try{
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(error){
      return [];
    }
  }

  function write(rows){
    try{
      window.localStorage.setItem(KEY, JSON.stringify((rows || []).slice(-300)));
    }catch(error){}
  }

  function add(scope, level, message, data){
    var rows = read();
    rows.push({
      id: "diag_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      scope: text(scope || "BDLocal"),
      level: text(level || "INFO").toUpperCase(),
      message: text(message),
      data: data || null,
      createdAt: new Date().toISOString()
    });
    write(rows);
    return rows[rows.length - 1];
  }

  function clear(){
    write([]);
    return true;
  }

  function startGoogleAutoSync(){
    if(window.BDLGoogleAutoSync){
      if(typeof window.BDLGoogleAutoSync.start === "function"){
        window.BDLGoogleAutoSync.start();
      }
      return Promise.resolve(window.BDLGoogleAutoSync);
    }

    if(autoLoader){ return autoLoader; }

    autoLoader = new Promise(function(resolve){
      var existing = document.querySelector('script[data-bdl-google-auto-sync="true"]');
      if(existing){
        existing.addEventListener("load",function(){
          if(window.BDLGoogleAutoSync && typeof window.BDLGoogleAutoSync.start === "function"){
            window.BDLGoogleAutoSync.start();
          }
          resolve(window.BDLGoogleAutoSync || null);
        },{ once:true });
        existing.addEventListener("error",function(){ resolve(null); },{ once:true });
        return;
      }

      var script = document.createElement("script");
      script.src = "sync/bdl.sync.google-auto.js";
      script.async = false;
      script.setAttribute("data-bdl-google-auto-sync","true");
      script.onload = function(){
        if(window.BDLGoogleAutoSync && typeof window.BDLGoogleAutoSync.start === "function"){
          window.BDLGoogleAutoSync.start();
        }
        add("google_auto_sync","INFO","Automatización segura de Google Sheets cargada.",window.BDLGoogleAutoSync && window.BDLGoogleAutoSync.status ? window.BDLGoogleAutoSync.status() : null);
        resolve(window.BDLGoogleAutoSync || null);
      };
      script.onerror = function(){
        add("google_auto_sync","ERROR","No se pudo cargar la automatización de Google Sheets.",null);
        autoLoader = null;
        resolve(null);
      };
      document.body.appendChild(script);
    });

    return autoLoader;
  }

  window.BDLDiagnostics = {
    version: VERSION,
    key: KEY,
    add: add,
    read: read,
    clear: clear,
    startGoogleAutoSync: startGoogleAutoSync
  };

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",function(){
    startGoogleAutoSync();
  },{ once:true });
})(window,document);
