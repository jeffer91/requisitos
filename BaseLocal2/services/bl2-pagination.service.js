/* =========================================================
Nombre completo: bl2-pagination.service.js
Ruta o ubicación: /Requisitos/BaseLocal2/services/bl2-pagination.service.js
Función o funciones:
- Centralizar paginación liviana para Base Local, Tabla y módulos futuros.
- Evitar renderizar cientos o miles de filas en una sola vista.
- Calcular límites, desplazamientos y texto de página de forma consistente.
- Normalizar respuestas paginadas de repositorios síncronos o asíncronos.
Con qué se conecta:
- BaseLocal/baselocal.app.js
- BaseLocal2/repositories/bl2-estudiantes.repo.js
- Gestion/Tabla/tabla.core.js
- Gestion/Tabla/tabla.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-pagination-fast.1";
  var DEFAULT_PAGE_SIZE = 100;
  var MIN_PAGE_SIZE = 25;
  var MAX_PAGE_SIZE = 500;

  function num(value, fallback){var n = Number(value);return Number.isFinite(n) ? n : fallback;}
  function clamp(value, min, max){return Math.max(min, Math.min(max, value));}

  function normalize(options){
    options = options || {};
    var pageSize = clamp(Math.floor(num(options.pageSize || options.limit, DEFAULT_PAGE_SIZE)), MIN_PAGE_SIZE, MAX_PAGE_SIZE);
    var page = Math.max(1, Math.floor(num(options.page, 1)));
    var offset = options.offset == null ? ((page - 1) * pageSize) : Math.max(0, Math.floor(num(options.offset, 0)));
    if(options.offset != null){page = Math.floor(offset / pageSize) + 1;}
    return {page:page, pageSize:pageSize, limit:pageSize, offset:offset};
  }

  function pageCount(total, pageSize){return Math.max(1, Math.ceil(Math.max(0, num(total, 0)) / Math.max(1, num(pageSize, DEFAULT_PAGE_SIZE))));}

  function build(total, options){
    var base = normalize(options || {});
    var pages = pageCount(total, base.pageSize);
    base.page = clamp(base.page, 1, pages);
    base.offset = (base.page - 1) * base.pageSize;
    base.limit = base.pageSize;
    base.total = Math.max(0, num(total, 0));
    base.pages = pages;
    base.hasPrev = base.page > 1;
    base.hasNext = base.page < pages;
    base.from = base.total ? base.offset + 1 : 0;
    base.to = Math.min(base.offset + base.pageSize, base.total);
    base.label = base.total ? (base.from + "-" + base.to + " de " + base.total) : "0 registros";
    return base;
  }

  function slice(rows, total, options){
    rows = Array.isArray(rows) ? rows : [];
    var info = build(total == null ? rows.length : total, options || {});
    var alreadyPaged = rows.length <= info.pageSize && total != null && Number(total) > rows.length;
    var data = alreadyPaged ? rows : rows.slice(info.offset, info.offset + info.pageSize);
    return {rows:data, pagination:info, total:info.total, offset:info.offset, limit:info.limit};
  }

  function fromOffset(offset, limit){
    limit = clamp(Math.floor(num(limit, DEFAULT_PAGE_SIZE)), MIN_PAGE_SIZE, MAX_PAGE_SIZE);
    offset = Math.max(0, Math.floor(num(offset, 0)));
    return {page:Math.floor(offset / limit) + 1, pageSize:limit, limit:limit, offset:offset};
  }

  function toQuery(options){
    var info = normalize(options || {});
    return {offset:info.offset, limit:info.limit, page:info.page, pageSize:info.pageSize};
  }

  function mergeResult(result, options){
    result = result || {};
    var rows = Array.isArray(result.rows) ? result.rows : (Array.isArray(result.estudiantes) ? result.estudiantes : []);
    var total = result.total == null ? rows.length : Number(result.total || 0);
    var info = build(total, Object.assign({}, options || {}, {offset:result.offset == null ? (options && options.offset) : result.offset, limit:result.limit || (options && options.limit)}));
    return Object.assign({}, result, {rows:rows, estudiantes:rows, total:total, offset:info.offset, limit:info.limit, pagination:info});
  }

  function empty(options){return mergeResult({rows:[], total:0}, options || {});}

  window.BL2PaginationService = {version:VERSION, normalize:normalize, build:build, slice:slice, pageCount:pageCount, fromOffset:fromOffset, toQuery:toQuery, mergeResult:mergeResult, empty:empty};
})(window);
