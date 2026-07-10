/* =========================================================
Nombre completo: plani.section-assets.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.section-assets.js
Funcion:
- Organizar recursos por seccion documental.
- Permitir que cada seccion tenga imagenes, graficos, tablas y archivos propios.
- Preparar estructura robusta para carpetas logicas por seccion.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function safeList(value){return Array.isArray(value) ? value : [];}
  function clone(value){return JSON.parse(JSON.stringify(value == null ? null : value));}

  function emptyMap(){return {};}

  function ensureSection(map, sectionId){
    map = map || emptyMap();
    sectionId = text(sectionId || "general");
    map[sectionId] = map[sectionId] || {sectionId:sectionId, images:[], charts:[], tables:[], files:[]};
    return map[sectionId];
  }

  function addAsset(map, sectionId, asset){
    map = map || emptyMap();
    var bucket = ensureSection(map, sectionId);
    var kind = text(asset && asset.kind).toUpperCase();
    if(kind === "IMAGE"){bucket.images.push(asset);}
    else if(kind === "CHART"){bucket.charts.push(asset);}
    else if(kind === "TABLE"){bucket.tables.push(asset);}
    else{bucket.files.push(asset);}
    return clone(map);
  }

  function listSection(map, sectionId){
    var bucket = ensureSection(map || emptyMap(), sectionId);
    return clone(bucket);
  }

  function flatten(map){
    map = map || emptyMap();
    return Object.keys(map).reduce(function(out,key){
      var b = map[key] || {};
      return out.concat(safeList(b.images), safeList(b.charts), safeList(b.tables), safeList(b.files));
    },[]);
  }

  function summary(map){
    map = map || emptyMap();
    return Object.keys(map).map(function(key){
      var b = map[key] || {};
      return {
        sectionId:key,
        images:safeList(b.images).length,
        charts:safeList(b.charts).length,
        tables:safeList(b.tables).length,
        files:safeList(b.files).length,
        total:safeList(b.images).length + safeList(b.charts).length + safeList(b.tables).length + safeList(b.files).length
      };
    });
  }

  window.PlaniSectionAssets = {emptyMap:emptyMap, ensureSection:ensureSection, addAsset:addAsset, listSection:listSection, flatten:flatten, summary:summary};
})(window);
