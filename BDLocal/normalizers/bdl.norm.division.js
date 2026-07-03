/* =========================================================
Nombre completo: bdl.norm.division.js
Ruta o ubicación: /Requisitos/BDLocal/normalizers/bdl.norm.division.js
Función o funciones:
- Normalizar división/modalidad de estudiantes.
- Unificar variantes como Univer, Universitaria, Superiores, Superior.
- Mantener "Sin división" solo cuando no venga dato real.
- Generar registros de divisiones por estudiante para Base Local.
Con qué se conecta:
- bdl.norm.text.js
- bdl.norm.estudiante.js
- bdl.repo.divisiones.js
- bdl.repo.estudiantes.js
- Tabla, Ficha, Stats, Coordi y Reportes
========================================================= */
(function(window){
  "use strict";

  var T = window.BDLNormText || null;

  if(!T){
    throw new Error("BDLNormText debe cargarse antes de BDLNormDivision.");
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

  function cleanValue(value){
    var raw = cleanSpaces(value);

    try{
      if(/[ÃÂ]/.test(raw)){
        raw = decodeURIComponent(escape(raw));
      }
    }catch(error){}

    raw = raw.replace(/�/g, "");
    raw = cleanSpaces(raw);

    return raw;
  }

  function compact(value){
    return key(cleanValue(value)).replace(/_/g, "");
  }

  function normalizeValue(value){
    var raw = cleanValue(value);

    if(!raw){
      return "Sin división";
    }

    var k = compact(raw);

    if(
      k === "sin" ||
      k === "sindivision" ||
      k === "sindivisin" ||
      k === "sinmodalidad" ||
      k === "ninguna" ||
      k === "noaplica" ||
      k === "na"
    ){
      return "Sin división";
    }

    if(
      k === "univer" ||
      k === "universitaria" ||
      k === "universitario" ||
      k === "universidad" ||
      k === "univ"
    ){
      return "Universitario";
    }

    if(
      k === "superior" ||
      k === "superiores" ||
      k === "sup" ||
      k === "tecnologico" ||
      k === "tecnologica" ||
      k === "tecnologicos" ||
      k === "tecnologicas"
    ){
      return "Superior";
    }

    if(
      k === "online" ||
      k === "enlinea" ||
      k === "linea" ||
      k === "virtual"
    ){
      return "Online";
    }

    if(k === "presencial"){
      return "Presencial";
    }

    if(k === "semipresencial" || k === "semi"){
      return "Semipresencial";
    }

    return raw.charAt(0).toLocaleUpperCase("es-EC") + raw.slice(1);
  }

  function parse(value){
    var values;

    if(Array.isArray(value)){
      values = value;
    }else{
      values = text(value).split(/[;,|]/);
    }

    var out = [];
    var seen = {};

    values.forEach(function(item){
      var normalized = normalizeValue(item);
      var k = key(normalized);
      if(!k || seen[k]){ return; }
      seen[k] = true;
      out.push(normalized);
    });

    return out;
  }

  function principal(row){
    row = row || {};

    var value = first(row, [
      "divisionPrincipal",
      "division",
      "Division",
      "división",
      "División",
      "modalidad",
      "Modalidad",
      "tipoModalidad",
      "TipoModalidad"
    ]);

    return normalizeValue(value);
  }

  function registros(row, idEstudiantePeriodo, periodoId, numeroIdentificacion){
    row = row || {};

    var main = principal(row);
    var values = parse(first(row, ["divisiones", "Divisiones"]));

    if(main && values.indexOf(main) < 0){
      values.unshift(main);
    }

    if(!values.length){
      values = ["Sin división"];
    }

    if(!main && values.length){
      main = values[0];
    }

    return values.map(function(value, index){
      return {
        id: idEstudiantePeriodo + "__" + key(value),
        idEstudiantePeriodo: idEstudiantePeriodo,
        periodoId: periodoId,
        numeroIdentificacion: numeroIdentificacion,
        division: value,
        divisionKey: key(value),
        esPrincipal: index === 0 || value === main,
        actualizadaEn: new Date().toISOString()
      };
    });
  }

  function normalizeRow(row){
    row = Object.assign({}, row || {});
    var main = principal(row);

    row.divisionPrincipal = main;
    row.division = main;
    row.Division = main;
    row.divisionKey = key(main);

    return row;
  }

  window.BDLNormDivision = {
    parse: parse,
    principal: principal,
    normalizeValue: normalizeValue,
    normalizarValor: normalizeValue,
    normalizeRow: normalizeRow,
    registros: registros,
    key: function(value){ return key(normalizeValue(value)); }
  };
})(window);