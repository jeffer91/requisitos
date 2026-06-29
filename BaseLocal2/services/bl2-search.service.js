/* =========================================================
Nombre completo: bl2-search.service.js
Ruta o ubicación: /Requisitos/BaseLocal2/services/bl2-search.service.js
Función o funciones:
- Normalizar textos de búsqueda para BL2.
- Construir texto de búsqueda por estudiante sin modificar los datos originales.
- Aplicar búsqueda por tokens para evitar recorrer campos repetidamente en cada pantalla.
- Evitar repetir lógica de búsqueda en Ficha, Tabla, Base Local y futuros módulos.
Con qué se conecta:
- repositories/bl2-estudiantes.repo.js
- core/bl2-data-engine.js
- BaseLocal/baselocal.app.js
- Ficha/ficha.core.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-search-fast.1";
  var cache = {row:null, text:"", key:""};

  function text(value){return String(value == null ? "" : value).trim();}

  function normalize(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function key(value){
    return normalize(value)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function compact(value){return normalize(value).replace(/[^a-z0-9]+/g, "");}

  function tokens(value){
    var clean = normalize(value);
    if(!clean){return [];}
    var seen = Object.create(null);
    return clean.split(" ").map(function(part){return part.trim();}).filter(function(part){
      if(!part || seen[part]){return false;}
      seen[part] = true;
      return true;
    });
  }

  function pick(row, names, fallback){
    row = row || {};
    names = names || [];
    var keys = Object.keys(row);
    var wanted = names.map(compact);

    for(var i = 0; i < names.length; i += 1){
      if(Object.prototype.hasOwnProperty.call(row, names[i]) && text(row[names[i]]) !== ""){
        return row[names[i]];
      }
    }

    for(var j = 0; j < keys.length; j += 1){
      if(wanted.indexOf(compact(keys[j])) >= 0){
        var value = row[keys[j]];
        if(value != null && text(value) !== ""){return value;}
      }
    }

    return fallback || "";
  }

  function valuesForStudent(row){
    row = row || {};
    return [
      row.searchText,
      row._bl2Search,
      pick(row, ["cedula", "Cedula", "Cédula", "numeroIdentificacion", "identificacion", "_bl2Id"], ""),
      pick(row, ["nombres", "Nombres", "nombre", "Nombre", "estudiante", "_bl2Nombre"], ""),
      pick(row, ["nombreCarrera", "nombrecarrera", "NombreCarrera", "carrera", "Carrera", "_bl2Carrera"], ""),
      pick(row, ["CodigoCarrera", "codigoCarrera", "codigocarrera"], ""),
      pick(row, ["periodoId", "periodoLabel", "periodo", "Periodo", "_bl2Periodo", "_bl2PeriodoId"], ""),
      pick(row, ["division", "división", "Division", "División", "_bl2Division"], ""),
      pick(row, ["Sede", "sede"], ""),
      pick(row, ["jornada", "Jornada", "HorarioComplexivo", "horarioComplexivo"], ""),
      pick(row, ["CorreoPersonal", "correoPersonal", "CorreoInstitucional", "correoInstitucional", "email", "correo"], ""),
      pick(row, ["Celular", "celular", "Telefono", "telefono", "whatsapp"], ""),
      pick(row, ["estadoMatricula", "EstadoMatricula", "_bl2EstadoMatricula"], ""),
      pick(row, ["Academico", "Documentacion", "Financiero", "Titulacion", "PrácticasVinculacion", "PracticasVinculacion", "Vinculacion", "SeguimientoGraduados", "Ingles", "ActualizaciónDatos", "ActualizacionDatos", "AprobacionTitulacion", "AprobacionComplexivoProyecto"], "")
    ];
  }

  function rowSignature(row){
    row = row || {};
    return [
      row.cedula || row.numeroIdentificacion || row._bl2Id || row.id || "",
      row.periodoId || row._bl2PeriodoId || row.periodoLabel || "",
      row.updatedAt || row.actualizadoEn || row.forceUploadedAt || ""
    ].join("|");
  }

  function studentText(row){
    var signature = rowSignature(row);
    if(cache.row === row && cache.key === signature){return cache.text;}
    var value = normalize(valuesForStudent(row).join(" "));
    cache = {row:row, key:signature, text:value};
    return value;
  }

  function matches(row, query){
    var parts = tokens(query || "");
    if(!parts.length){return true;}
    var haystack = studentText(row);
    for(var i = 0; i < parts.length; i += 1){
      if(haystack.indexOf(parts[i]) < 0){return false;}
    }
    return true;
  }

  function filterRows(rows, query){
    rows = Array.isArray(rows) ? rows : [];
    if(!normalize(query)){return rows.slice();}
    return rows.filter(function(row){return matches(row, query);});
  }

  function buildIndex(rows){
    var out = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function(row, index){
      var cedula = text(pick(row, ["cedula", "numeroIdentificacion", "_bl2Id", "id"], ""));
      if(cedula){out[cedula] = index;}
    });
    return out;
  }

  function search(rows, query, options){
    options = options || {};
    var result = filterRows(rows, query);
    var total = result.length;
    var offset = Math.max(0, Number(options.offset || 0) || 0);
    var limit = Math.max(0, Number(options.limit || 0) || 0);
    if(limit){result = result.slice(offset, offset + limit);}
    return {rows:result, total:total, offset:offset, limit:limit || total, source:"BL2SearchService"};
  }

  window.BL2SearchService = {
    version:VERSION,
    text:text,
    normalize:normalize,
    key:key,
    compact:compact,
    tokens:tokens,
    pick:pick,
    valuesForStudent:valuesForStudent,
    studentText:studentText,
    matches:matches,
    filterRows:filterRows,
    buildIndex:buildIndex,
    search:search
  };
})(window);
