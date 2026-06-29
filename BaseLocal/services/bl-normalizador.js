/* =========================================================
Nombre completo: bl-normalizador.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-normalizador.js
Función o funciones:
- Normalizar estudiantes y períodos sin borrar campos originales.
- Usar cédula como clave principal y numeroIdentificacion como respaldo.
- Mantener tolerancia para campos con tilde, sin tilde y variaciones de mayúsculas.
- Normalizar el campo divisiones como array simple: ["Nombre de división"].
Con qué se conecta:
- bl-campos.js
- bl-periodos-canon.service.js
- bl-divisiones.service.js
- baselocal.core.js
- futuros servicios de sincronización BL
========================================================= */
(function(window){
  "use strict";

  function campos(){if(!window.BLCampos){throw new Error("BLCampos no disponible.");}return window.BLCampos;}
  function text(value){return campos().text(value);}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}

  function normalizeText(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function periodKey(value){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.keyFromPeriod === "function"){
      return window.BLPeriodosCanon.keyFromPeriod({id:value, label:value});
    }
    var raw = text(value);
    if(!raw){return "";}
    return normalizeText(raw).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function normalizePeriod(period){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function"){
      return window.BLPeriodosCanon.normalizePeriod(period);
    }
    var src = Object.assign({}, period || {});
    var id = text(src.id || src.periodoId || src.value || src.periodId);
    var label = text(src.label || src.periodoLabel || src.periodo || src.nombrePeriodo || id);
    if(!id && label){id = periodKey(label);}
    if(!label && id){label = id;}
    return Object.assign({}, src, {id:id, periodoId:text(src.periodoId || id), label:label, periodoLabel:text(src.periodoLabel || label), updatedAt:text(src.updatedAt || src.actualizadoEn || src.creadoEn) || now()});
  }

  function normalizeDivisiones(value){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.normalizeDivisiones === "function"){
      return window.BLDivisionesService.normalizeDivisiones(value);
    }
    if(Array.isArray(value)){
      var seen = {};
      var out = [];
      value.forEach(function(item){
        var name = text(typeof item === "object" && item ? (item.nombre || item.name || item.label || item.id) : item);
        var key = normalizeText(name);
        if(!name || key === "sin division" || seen[key]){return;}
        seen[key] = true;
        out.push(name);
      });
      return out;
    }
    var single = text(value);
    return single && normalizeText(single) !== "sin division" ? [single] : [];
  }

  function getCampo(row, name, fallback){return campos().getValue(row || {}, name, fallback);}

  function cedulaFromDocId(value){
    var raw = text(value);
    var match = raw.match(/^(\d{7,13})(?:\D|$)/);
    return match ? match[1] : "";
  }

  function normalizeStudent(row, index, options){
    options = options || {};
    var src = clone(row || {}) || {};
    var out = campos().ensureIdentity(src);
    var firebaseCedula = cedulaFromDocId(out._firebaseId || out._docId || out.docId || out.id);
    var cedula = text(getCampo(out, "cedula", "")) || firebaseCedula;
    var numero = text(getCampo(out, "numeroIdentificacion", cedula)) || cedula;
    var periodoId = text(getCampo(out, "periodoId", options.periodoId || out.periodoId || out.ultimoPeriodoId || ""));
    var periodoLabel = text(getCampo(out, "periodoLabel", options.periodoLabel || out.periodoLabel || periodoId));
    var normalizedPeriod = normalizePeriod({id:periodoId, periodoId:periodoId, label:periodoLabel, periodoLabel:periodoLabel});
    var nombres = text(getCampo(out, "nombres", out.nombres || out.Nombres || ""));
    var carrera = text(getCampo(out, "nombreCarrera", out.nombrecarrera || out.nombreCarrera || out.NombreCarrera || out.carrera || ""));
    var estado = campos().normalizeEstado(getCampo(out, "estadoMatricula", out.estadoMatricula || "ACTIVO"));
    var docId = text(out._docId || out.docId || out._firebaseId || out.id || cedula || numero || ("estudiante_" + (index + 1)));
    var divisiones = normalizeDivisiones(out.divisiones || out.division || out.Division || out.División);

    out._docId = docId;
    out.docId = docId;
    out.cedula = cedula || numero || docId;
    out.numeroIdentificacion = numero || cedula || docId;
    out.periodoId = normalizedPeriod.id || periodoId;
    out.ultimoPeriodoId = normalizedPeriod.id || periodoId;
    out.periodoLabel = normalizedPeriod.label || periodoLabel || out.periodoId;
    out.nombres = nombres;
    out.nombrecarrera = carrera;
    out.estadoMatricula = estado;
    out.divisiones = divisiones;
    if(divisiones.length){out.division = divisiones[0];}else{delete out.division;}
    out.updatedAt = text(getCampo(out, "updatedAt", out.updatedAt || "")) || now();
    out._source = out._source || options.source || "local";

    if(!out.Nombres && nombres){out.Nombres = nombres;}
    if(!out.NombreCarrera && carrera){out.NombreCarrera = carrera;}
    return out;
  }

  function normalizeStudents(rows, options){
    var list = Array.isArray(rows) ? rows : [];
    return list.map(function(row, index){return normalizeStudent(row, index, options || {});});
  }

  function indexByCedula(rows){
    var map = {};
    normalizeStudents(rows || []).forEach(function(student){
      var key = text(student.cedula || student.numeroIdentificacion);
      if(key){map[key] = student;}
    });
    return map;
  }

  window.BLNormalizador = {text:text,now:now,clone:clone,normalizeText:normalizeText,periodKey:periodKey,normalizePeriod:normalizePeriod,normalizeDivisiones:normalizeDivisiones,normalizeStudent:normalizeStudent,normalizeStudents:normalizeStudents,indexByCedula:indexByCedula};
})(window);
