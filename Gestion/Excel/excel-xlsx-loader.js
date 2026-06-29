/* =========================================================
Nombre completo: excel-xlsx-loader.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-xlsx-loader.js
Función o funciones:
- Asegurar disponibilidad de SheetJS/XLSX.
- Evitar duplicar scripts XLSX si varias pantallas lo piden.
- Mantener carga local primero y CDN como respaldo.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "1.1.0-safe-loader";
  var URLS = ["./vendor/xlsx.full.min.js","https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js","https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js"];
  var loading = null;
  var lastStatus = {ok:!!window.XLSX, version:VERSION, source:window.XLSX ? "already_loaded" : "pending", updatedAt:new Date().toISOString()};

  function updateStatus(status){lastStatus = Object.assign({version:VERSION, updatedAt:new Date().toISOString()}, status || {});return lastStatus;}
  function hasScript(src){var scripts = document.getElementsByTagName("script");for(var i=0;i<scripts.length;i+=1){if((scripts[i].src || "").indexOf(src) >= 0){return scripts[i];}}return null;}
  function load(src){return new Promise(function(resolve,reject){var existing = hasScript(src);if(existing){existing.addEventListener("load", function(){resolve(true);});existing.addEventListener("error", function(){reject(new Error("No se pudo cargar " + src));});if(window.XLSX){resolve(true);}return;}var s = document.createElement("script");s.src = src;s.async = false;s.dataset.excelXlsxLoader = VERSION;s.onload = function(){resolve(true);};s.onerror = function(){reject(new Error("No se pudo cargar " + src));};document.head.appendChild(s);});}
  async function ensureXLSX(){if(window.XLSX){updateStatus({ok:true, source:"already_loaded"});return true;}if(loading){return loading;}loading = (async function(){for(var i=0;i<URLS.length;i+=1){try{await load(URLS[i]);if(window.XLSX){updateStatus({ok:true, source:URLS[i]});return true;}}catch(e){console.warn("[ExcelXlsxLoader]", e.message);updateStatus({ok:false, source:URLS[i], errorMessage:e.message});}}throw new Error("XLSX no está disponible. Revisa internet o vendor/xlsx.full.min.js.");})();return loading;}
  function status(){return Object.assign({}, lastStatus, {loaded:!!window.XLSX});}

  window.ExcelXlsxLoader = {version:VERSION, ensureXLSX:ensureXLSX, status:status};
})(window,document);
