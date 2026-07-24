/* =========================================================
Nombre completo: cone.active-filter.js
Ruta: /BDLocal/conexiones/cone.active-filter.js
Función:
- Excluir tombstones de períodos, estudiantes y requisitos compartidos.
- Proteger todas las pantallas aunque una caché antigua contenga eliminados.
- Envolver BDLocalConUtils sin modificar los conectores individualmente.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-active-only";
  var U=window.BDLocalConUtils;
  if(!U||U.__activeFilterInstalled){return;}

  function deleted(row){
    row=row||{};
    return row.eliminado===true||row._firebaseDeleted===true||
      String(row.estadoRegistro||"").trim().toUpperCase()==="ELIMINADO";
  }
  function list(value){return Array.isArray(value)?value:[];}
  function sanitize(cache){
    cache=cache&&typeof cache==="object"?cache:{};
    var result=Object.assign({},cache,{
      meta:Object.assign({},cache.meta||{}),
      periods:list(cache.periods||cache.periodos).filter(function(row){return !deleted(row);}),
      students:list(cache.students||cache.estudiantes||cache.rows).filter(function(row){return !deleted(row);}),
      requirements:list(cache.requirements||cache.requisitos).filter(function(row){return !deleted(row);}),
      summaries:Object.assign({},cache.summaries||cache.resumenes||{}),
      diagnostics:list(cache.diagnostics||cache.diagnosticos).slice()
    });
    result.meta.totalPeriods=result.periods.length;
    result.meta.totalStudents=result.students.length;
    result.meta.totalRequirements=result.requirements.length;
    result.meta.activeFilterVersion=VERSION;
    return result;
  }

  var originalRead=typeof U.readCache==="function"?U.readCache.bind(U):null;
  var originalNormalize=typeof U.normalizeCache==="function"?U.normalizeCache.bind(U):null;
  var originalWrite=typeof U.writeCache==="function"?U.writeCache.bind(U):null;
  var originalFilter=typeof U.filterStudents==="function"?U.filterStudents.bind(U):null;

  if(originalRead){
    U.readCache=function(force){return sanitize(originalRead(force));};
  }
  if(originalNormalize){
    U.normalizeCache=function(cache){return sanitize(originalNormalize(cache));};
  }
  if(originalWrite){
    U.writeCache=function(cache,options){return sanitize(originalWrite(sanitize(cache),options||{}));};
  }
  if(originalFilter){
    U.filterStudents=function(rows,options){
      return originalFilter(list(rows).filter(function(row){return !deleted(row);}),options||{});
    };
  }

  U.isDeleted=deleted;
  U.activeOnly=function(rows){return list(rows).filter(function(row){return !deleted(row);});};
  U.sanitizeActiveCache=sanitize;
  U.__activeFilterInstalled=true;
  U.activeFilterVersion=VERSION;

  window.BDLocalActiveFilter={version:VERSION,sanitize:sanitize,isDeleted:deleted,install:function(){return true;}};
  try{window.dispatchEvent(new CustomEvent("bdlocal:active-filter-ready",{detail:{ok:true,version:VERSION}}));}catch(error){}
})(window);
