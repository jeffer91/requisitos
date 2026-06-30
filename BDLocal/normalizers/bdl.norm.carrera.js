/* =========================================================
Nombre completo: bdl.norm.carrera.js
Ruta: /BDLocal/normalizers/bdl.norm.carrera.js
Función:
- Normalizar nombres de carreras que llegan mal escritos desde Excel/HTML viejo.
- Conservar nombre original y entregar nombre limpio para filtros, stats y divisiones.
========================================================= */
(function(window){
  "use strict";

  var T = window.BDLNormText;
  if(!T){ throw new Error("BDLNormText debe cargarse antes de BDLNormCarrera."); }

  var OFICIALES = [
    "ESTÉTICA INTEGRAL",
    "MECÁNICA AUTOMOTRIZ",
    "PROCESAMIENTO EN ALIMENTOS",
    "SEGURIDAD CIUDADANA Y ORDEN PÚBLICO ONLINE",
    "UNIVERSITARIA EN ADMINISTRACIÓN DE EMPRESAS",
    "UNIVERSITARIA EN ADMINISTRACIÓN DE TALENTO HUMANO",
    "UNIVERSITARIA EN CONTABILIDAD Y TRIBUTARIA",
    "UNIVERSITARIA EN EDUCACIÓN INICIAL ONLINE",
    "UNIVERSITARIA EN REDES Y TELECOMUNICACIONES ONLINE",
    "VENTAS ONLINE"
  ];

  var DIRECT = {
    "UNIVERSITARIA EN EDUACION INICIAL ONLINE":"UNIVERSITARIA EN EDUCACIÓN INICIAL ONLINE",
    "UNIVERSITARIA EN EDUACIÓN INICIAL ONLINE":"UNIVERSITARIA EN EDUCACIÓN INICIAL ONLINE",
    "EDUACION INICIAL ONLINE":"UNIVERSITARIA EN EDUCACIÓN INICIAL ONLINE",
    "EDUACIÓN INICIAL ONLINE":"UNIVERSITARIA EN EDUCACIÓN INICIAL ONLINE",
    "ADMINISTRACION DE EMPRESAS":"UNIVERSITARIA EN ADMINISTRACIÓN DE EMPRESAS",
    "UNIVERSITARIA EN ADMINISTRACION DE EMPRESAS":"UNIVERSITARIA EN ADMINISTRACIÓN DE EMPRESAS",
    "ADMINISTRACION DE TALENTO HUMANO":"UNIVERSITARIA EN ADMINISTRACIÓN DE TALENTO HUMANO",
    "UNIVERSITARIA EN ADMINISTRACION DE TALENTO HUMANO":"UNIVERSITARIA EN ADMINISTRACIÓN DE TALENTO HUMANO",
    "CONTABILIDAD Y TRIBUTARIA":"UNIVERSITARIA EN CONTABILIDAD Y TRIBUTARIA",
    "UNIVERSITARIA EN CONTABILIDAD Y TRIBUTARIA":"UNIVERSITARIA EN CONTABILIDAD Y TRIBUTARIA",
    "REDES Y TELECOMUNICACIONES ONLINE":"UNIVERSITARIA EN REDES Y TELECOMUNICACIONES ONLINE",
    "UNIVERSITARIA EN REDES Y TELECOMUNICACIONES ONLINE":"UNIVERSITARIA EN REDES Y TELECOMUNICACIONES ONLINE",
    "SEGURIDAD CIUDADANA Y ORDEN PUBLICO ONLINE":"SEGURIDAD CIUDADANA Y ORDEN PÚBLICO ONLINE",
    "SEGURIDAD CIUDADANA Y ORDEN PÚBLICO ONLINE":"SEGURIDAD CIUDADANA Y ORDEN PÚBLICO ONLINE",
    "PROCESAMIENTO EN ALIMENTOS":"PROCESAMIENTO EN ALIMENTOS",
    "PROCESAMIENTO EN ALIMENTO":"PROCESAMIENTO EN ALIMENTOS",
    "ESTETICA INTEGRAL":"ESTÉTICA INTEGRAL",
    "ESTÉTICA INTEGRAL":"ESTÉTICA INTEGRAL",
    "MECANICA AUTOMOTRIZ":"MECÁNICA AUTOMOTRIZ",
    "MECÁNICA AUTOMOTRIZ":"MECÁNICA AUTOMOTRIZ",
    "VENTAS ONLINE":"VENTAS ONLINE"
  };

  function clean(value){
    var out = T.upper(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    out = out.replace(/EDUACI[ÓO]N/g, "EDUCACIÓN");
    out = out.replace(/ADMINISTRACION/g, "ADMINISTRACIÓN");
    out = out.replace(/MECANICA/g, "MECÁNICA");
    out = out.replace(/ESTETICA/g, "ESTÉTICA");
    out = out.replace(/PUBLICO/g, "PÚBLICO");
    out = out.replace(/TELECOMUNICACIONES\s+ON\s+LINE/g, "TELECOMUNICACIONES ONLINE");
    out = out.replace(/\bON LINE\b/g, "ONLINE");
    return out;
  }

  function compact(value){ return T.noAccents(clean(value)).replace(/[^A-Z0-9]+/g, "").toUpperCase(); }

  function nearest(value){
    var c = compact(value);
    var best = "";
    OFICIALES.forEach(function(name){
      var k = compact(name);
      if(c === k){ best = name; }
      else if(!best && (c.indexOf(k) >= 0 || k.indexOf(c) >= 0)){ best = name; }
    });
    return best;
  }

  function modalidad(nombre){
    return clean(nombre).indexOf("ONLINE") >= 0 ? "ONLINE" : "PRESENCIAL";
  }

  function normalize(value, codigo){
    var original = T.cleanSpaces(value || "");
    var cleaned = clean(original);
    var direct = DIRECT[cleaned] || DIRECT[T.noAccents(cleaned).toUpperCase()];
    var oficial = direct || nearest(cleaned) || cleaned || "SIN CARRERA";
    return {
      original: original,
      nombre: oficial,
      codigo: T.upper(codigo || ""),
      key: T.key(oficial),
      modalidad: modalidad(oficial),
      corregido: !!(original && clean(original) !== oficial)
    };
  }

  function normalizeRow(row){
    row = Object.assign({}, row || {});
    var raw = T.first(row, ["nombreCarrera", "NombreCarrera", "nombrecarrera", "carrera", "Carrera", "programa", "Programa"]);
    var code = T.first(row, ["codigoCarrera", "CodigoCarrera", "CódigoCarrera", "codCarrera", "CodCarrera"]);
    var n = normalize(raw, code);
    row.nombreCarreraOriginal = raw || row.nombreCarreraOriginal || "";
    row.NombreCarreraOriginal = row.nombreCarreraOriginal;
    row.nombreCarrera = n.nombre;
    row.NombreCarrera = n.nombre;
    row.carrera = n.nombre;
    row.Carrera = n.nombre;
    row.nombreCarreraKey = n.key;
    row.modalidadCarrera = n.modalidad;
    row.codigoCarrera = n.codigo || row.codigoCarrera || row.CodigoCarrera || "";
    row.CodigoCarrera = row.codigoCarrera;
    row.carreraNormalizada = n;
    return row;
  }

  window.BDLNormCarrera = {
    oficiales: OFICIALES.slice(),
    normalize: normalize,
    normalizeRow: normalizeRow,
    clean: clean,
    key: function(value){ return normalize(value).key; }
  };
})(window);