/* =========================================================
Nombre completo: plani.assets.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.assets.js
Funcion:
- Gestionar recursos generales de Plani por tipo y seccion.
- Normalizar imagenes, graficos, tablas y adjuntos ligeros.
- Mantener reglas de recursos fuera del motor documental.
========================================================= */
(function(window){
  "use strict";

  var ALLOWED = ["image/png","image/jpeg","image/webp","image/svg+xml","text/plain","text/csv"];

  function text(value){return String(value == null ? "" : value).trim();}
  function safeList(value){return Array.isArray(value) ? value : [];}
  function uid(prefix){return (prefix || "asset") + "-" + Date.now() + "-" + Math.random().toString(16).slice(2,8);}

  function typeOf(file){
    var mime = text(file && file.type);
    var name = text(file && file.name).toLowerCase();
    if(mime.indexOf("image/") === 0){return "IMAGE";}
    if(name.indexOf(".csv") > -1 || mime.indexOf("csv") > -1){return "TABLE";}
    return "FILE";
  }

  function validateFile(file){
    if(!file){return {ok:false,message:"Archivo vacio."};}
    if(file.type && ALLOWED.indexOf(file.type) === -1){return {ok:false,message:"Tipo de archivo no permitido para Plani."};}
    return {ok:true,message:"Archivo permitido."};
  }

  function normalizeFile(file, sectionId){
    var validation = validateFile(file);
    return {
      id:uid("asset"),
      sectionId:text(sectionId || "general"),
      name:text(file && file.name),
      mime:text(file && file.type),
      size:file && file.size ? file.size : 0,
      kind:typeOf(file),
      valid:validation.ok,
      message:validation.message,
      createdAt:new Date().toISOString()
    };
  }

  function countByKind(assets){
    return safeList(assets).reduce(function(acc,item){
      var key = item.kind || "FILE";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },{});
  }

  window.PlaniAssets = {normalizeFile:normalizeFile, validateFile:validateFile, countByKind:countByKind, uid:uid};
})(window);
