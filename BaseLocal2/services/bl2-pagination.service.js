/* =========================================================
Nombre completo: bl2-pagination.service.js
Ruta o ubicación: /Requisitos/BaseLocal2/services/bl2-pagination.service.js
Función o funciones:
- Centralizar paginación liviana para Tabla y módulos futuros.
- Evitar renderizar cientos o miles de filas en una sola vista.
- Calcular límites, desplazamientos y texto de página de forma consistente.
Con qué se conecta:
- Gestion/Tabla/tabla.core.js
- Gestion/Tabla/tabla.app.js
========================================================= */
(function(window){
  "use strict";

  function num(value, fallback){var n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

  function normalize(options){
    options=options||{};
    var pageSize=clamp(num(options.pageSize,100),25,500);
    var page=Math.max(1,num(options.page,1));
    return {page:page,pageSize:pageSize,offset:(page-1)*pageSize};
  }

  function pageCount(total,pageSize){return Math.max(1,Math.ceil(Math.max(0,num(total,0))/Math.max(1,num(pageSize,100))));}

  function build(total, options){
    var base=normalize(options||{});
    var pages=pageCount(total,base.pageSize);
    base.page=clamp(base.page,1,pages);
    base.offset=(base.page-1)*base.pageSize;
    base.total=Math.max(0,num(total,0));
    base.pages=pages;
    base.hasPrev=base.page>1;
    base.hasNext=base.page<pages;
    base.from=base.total?base.offset+1:0;
    base.to=Math.min(base.offset+base.pageSize,base.total);
    base.label=base.total?base.from+"-"+base.to+" de "+base.total:"0 registros";
    return base;
  }

  function slice(rows,total,options){
    rows=Array.isArray(rows)?rows:[];
    var info=build(total==null?rows.length:total,options||{});
    var data=rows.length>info.pageSize?rows.slice(info.offset,info.offset+info.pageSize):rows;
    return {rows:data,pagination:info};
  }

  window.BL2PaginationService={version:"2.0.0-alpha.1",normalize:normalize,build:build,slice:slice,pageCount:pageCount};
})(window);
