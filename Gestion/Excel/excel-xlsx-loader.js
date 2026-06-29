/* =========================================================
Nombre completo: excel-xlsx-loader.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-xlsx-loader.js
Función o funciones:
- Asegurar disponibilidad de SheetJS/XLSX.
- Evitar que la pantalla falle si el CDN demora o no carga.
Con qué se conecta:
- excel-reader.js
========================================================= */
(function(window,document){
  "use strict";
  var URLS=["./vendor/xlsx.full.min.js","https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js","https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js"];
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement("script");s.src=src;s.async=false;s.onload=function(){resolve(true);};s.onerror=function(){reject(new Error("No se pudo cargar "+src));};document.head.appendChild(s);});}
  async function ensureXLSX(){if(window.XLSX)return true;for(var i=0;i<URLS.length;i++){try{await load(URLS[i]);if(window.XLSX)return true;}catch(e){console.warn("[ExcelXlsxLoader]",e.message);}}throw new Error("XLSX no está disponible. Revisa internet o vendor/xlsx.full.min.js.");}
  window.ExcelXlsxLoader={ensureXLSX:ensureXLSX};
})(window,document);
