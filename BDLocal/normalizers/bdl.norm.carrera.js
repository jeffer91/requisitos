/* =========================================================
Nombre completo: bdl.norm.carrera.js
Ruta o ubicación: /Requisitos/BDLocal/normalizers/bdl.norm.carrera.js
Función o funciones:
- Limpiar nombres de carrera sin cambiar la carrera original a otro catálogo.
- Corregir caracteres dañados como ADMINISTRACI�N, DISE�O, PEDAGOG�A.
- Mantener la carrera bien escrita para filtros, tablas, fichas y reportes.
- Mantener compatibilidad con normalize(), normalizeRow(), clean() y key().
Con qué se conecta:
- bdl.norm.text.js
- bdl.norm.estudiante.js
- carga.normalizer.js
- bdl.repo.estudiantes.js
- Tabla, Ficha, Stats, Coordi y Reportes
========================================================= */
(function(window){
  "use strict";

  var T = window.BDLNormText || null;

  if(!T){
    throw new Error("BDLNormText debe cargarse antes de BDLNormCarrera.");
  }

  function text(value){
    if(T && typeof T.text === "function"){
      return T.text(value);
    }
    return String(value == null ? "" : value).trim();
  }

  function cleanSpaces(value){
    if(T && typeof T.cleanSpaces === "function"){
      return T.cleanSpaces(value);
    }
    return text(value).replace(/\s+/g, " ").trim();
  }

  function key(value){
    if(T && typeof T.key === "function"){
      return T.key(value);
    }
    return cleanSpaces(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  function first(row, fields){
    row = row || {};
    fields = fields || [];
    if(T && typeof T.first === "function"){
      return T.first(row, fields);
    }
    for(var i = 0; i < fields.length; i++){
      if(row[fields[i]] != null && text(row[fields[i]]) !== ""){
        return row[fields[i]];
      }
    }
    return "";
  }

  function tryDecodeMojibake(value){
    var raw = text(value);
    if(!raw){ return ""; }

    try{
      if(/[ÃÂ]/.test(raw)){
        return decodeURIComponent(escape(raw));
      }
    }catch(error){}

    return raw;
  }

  function replaceCommonBrokenWords(value){
    var out = text(value);

    var replacements = [
      [/ADMINISTRACI�N/gi, "ADMINISTRACIÓN"],
      [/ADMINISTRACION/gi, "ADMINISTRACIÓN"],
      [/CONTABILIDAD/gi, "CONTABILIDAD"],
      [/DESARROLLO DE SOFTWARE/gi, "DESARROLLO DE SOFTWARE"],
      [/DISE�O/gi, "DISEÑO"],
      [/DISENO/gi, "DISEÑO"],
      [/EDUCACI�N/gi, "EDUCACIÓN"],
      [/EDUCACION/gi, "EDUCACIÓN"],
      [/ENFERMER�A/gi, "ENFERMERÍA"],
      [/ENFERMERIA/gi, "ENFERMERÍA"],
      [/EST�TICA/gi, "ESTÉTICA"],
      [/ESTETICA/gi, "ESTÉTICA"],
      [/GASTRONOM�A/gi, "GASTRONOMÍA"],
      [/GASTRONOMIA/gi, "GASTRONOMÍA"],
      [/MARKETING/gi, "MARKETING"],
      [/MEC�NICA/gi, "MECÁNICA"],
      [/MECANICA/gi, "MECÁNICA"],
      [/PEDAGOG�A/gi, "PEDAGOGÍA"],
      [/PEDAGOGIA/gi, "PEDAGOGÍA"],
      [/PSICOLOG�A/gi, "PSICOLOGÍA"],
      [/PSICOLOGIA/gi, "PSICOLOGÍA"],
      [/P�BLICO/gi, "PÚBLICO"],
      [/PUBLICO/gi, "PÚBLICO"],
      [/TELECOMUNICACIONES/gi, "TELECOMUNICACIONES"],
      [/TECNOLOG�A/gi, "TECNOLOGÍA"],
      [/TECNOLOGIA/gi, "TECNOLOGÍA"],
      [/TURISMO/gi, "TURISMO"],
      [/VETERINARIA/gi, "VETERINARIA"],
      [/TITULACI�N/gi, "TITULACIÓN"],
      [/TITULACION/gi, "TITULACIÓN"]
    ];

    replacements.forEach(function(pair){
      out = out.replace(pair[0], pair[1]);
    });

    return out;
  }

  function removeDangerousReplacementChars(value){
    var out = text(value);

    out = out.replace(/�/g, "");
    out = out.replace(/\s+/g, " ");

    return out;
  }

  function normalizeCase(value){
    var raw = cleanSpaces(value);
    if(!raw){ return ""; }

    return raw.toLocaleUpperCase("es-EC");
  }

  function clean(value){
    var raw = text(value);
    if(!raw){ return ""; }

    var out = tryDecodeMojibake(raw);
    out = replaceCommonBrokenWords(out);
    out = removeDangerousReplacementChars(out);
    out = cleanSpaces(out);
    out = normalizeCase(out);

    if(!out){
      return "";
    }

    return out;
  }

  function detectModalidad(nombre){
    var k = key(nombre);

    if(k.indexOf("online") >= 0 || k.indexOf("en_linea") >= 0 || k.indexOf("enlinea") >= 0){
      return "ONLINE";
    }

    if(k.indexOf("distancia") >= 0){
      return "DISTANCIA";
    }

    if(k.indexOf("dual") >= 0){
      return "DUAL";
    }

    return "";
  }

  function normalize(value, codigo){
    var nombre = clean(value);
    var codigoCarrera = cleanSpaces(codigo);

    return {
      codigo: codigoCarrera,
      codigoCarrera: codigoCarrera,
      nombre: nombre || "SIN CARRERA",
      label: nombre || "SIN CARRERA",
      key: key(nombre || "SIN CARRERA"),
      modalidad: detectModalidad(nombre),
      original: text(value),
      oficial: false,
      source: "texto_limpio"
    };
  }

  function normalizeRow(row){
    row = Object.assign({}, row || {});

    var rawCarrera = first(row, [
      "nombreCarrera",
      "NombreCarrera",
      "carrera",
      "Carrera",
      "programa",
      "Programa",
      "nombrecarrera"
    ]);

    var rawCodigo = first(row, [
      "codigoCarrera",
      "CodigoCarrera",
      "códigoCarrera",
      "CódigoCarrera",
      "codCarrera",
      "CodCarrera"
    ]);

    var n = normalize(rawCarrera, rawCodigo);

    row.nombreCarrera = n.nombre;
    row.NombreCarrera = n.nombre;
    row.carrera = n.nombre;
    row.Carrera = n.nombre;
    row.nombreCarreraKey = n.key;
    row.carreraKey = n.key;
    row.modalidadCarrera = n.modalidad;
    row.codigoCarrera = n.codigo || row.codigoCarrera || row.CodigoCarrera || "";
    row.CodigoCarrera = row.codigoCarrera;
    row.carreraNormalizada = n;

    return row;
  }

  function same(a, b){
    return key(clean(a)) === key(clean(b));
  }

  window.BDLNormCarrera = {
    oficiales: [],
    clean: clean,
    normalize: normalize,
    normalizar: normalize,
    normalizeRow: normalizeRow,
    normalizarFila: normalizeRow,
    same: same,
    key: function(value){ return normalize(value).key; },
    label: function(value){ return normalize(value).nombre; }
  };
})(window);