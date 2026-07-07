/* =========================================================
Archivo: bdl.rules.notas.js
Ruta: /BDLocal/rules/bdl.rules.notas.js
Función:
- Normalizar notas de titulación/defensas.
- Calcular nota final institucional: 70% artículo + 30% defensa.
- Preparar la futura tabla notas_titulacion.
Con qué se conecta:
- BDLocal/rules/bdl.rules.index.js
- defart/defart.core.js
========================================================= */
(function(window){
  "use strict";

  var Rules = window.BDLRules;
  if(!Rules){ return; }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function parseNota(value){
    var raw = text(value).replace(",", ".");
    if(!raw){ return null; }
    var number = Number(raw);
    if(!isFinite(number)){ return null; }
    if(number < 0){ return 0; }
    if(number > 10){ return 10; }
    return Math.round(number * 100) / 100;
  }

  function first(row, names){
    row = row || {};
    names = Array.isArray(names) ? names : [];
    for(var i = 0; i < names.length; i++){
      if(text(row[names[i]]) !== ""){ return row[names[i]]; }
    }
    return "";
  }

  function finalNota(notart, notdef){
    notart = parseNota(notart);
    notdef = parseNota(notdef);
    if(notart == null || notdef == null){ return null; }
    return Math.round(((notart * 0.70) + (notdef * 0.30)) * 100) / 100;
  }

  function estadoNota(notart, notdef, notafinal){
    if(notart == null){ return "SIN_ARTICULO"; }
    if(notart < 7){ return "ARTICULO_NO_APROBADO"; }
    if(notdef == null){ return "PENDIENTE_DEFENSA"; }
    if(notafinal == null){ return "PENDIENTE_FINAL"; }
    return notafinal >= 7 ? "APROBADO" : "NO_APROBADO";
  }

  function build(row, context){
    row = row || {};
    context = context || {};

    var periodoId = text(row.periodoId || context.periodoId || "");
    var cedula = text(row.cedula || "");
    var idEstudiantePeriodo = text(row.idEstudiantePeriodo || (periodoId && cedula ? periodoId + "__" + cedula : ""));

    var notart = parseNota(first(row, ["Notart", "Nart", "nart", "notart", "notaArticulo", "nota_articulo"]));
    var notdef = parseNota(first(row, ["Notdef", "Ndef", "ndef", "notdef", "notaDefensa", "nota_defensa"]));
    var explicitFinal = parseNota(first(row, ["Notafinal", "Nfinal", "nfin", "notafinal", "notaFinal", "nota_final"]));
    var notafinal = explicitFinal != null ? explicitFinal : finalNota(notart, notdef);

    return {
      idEstudiantePeriodo: idEstudiantePeriodo,
      periodoId: periodoId,
      cedula: cedula,
      notart: notart,
      notdef: notdef,
      notafinal: notafinal,
      estadoNota: estadoNota(notart, notdef, notafinal),
      updatedAt: text(row.updatedAt || "") || new Date().toISOString(),
      _bdlNotasValid: !!idEstudiantePeriodo,
      _bdlNotasError: idEstudiantePeriodo ? "" : "No se pudo crear registro de notas porque falta período o cédula."
    };
  }

  function apply(payload, context){
    if(Array.isArray(payload)){
      return payload.map(function(row){
        var copy = Object.assign({}, row || {});
        copy._bdlNotas = build(copy, context || {});
        return copy;
      });
    }

    var copy = Object.assign({}, payload || {});
    copy._bdlNotas = build(copy, context || {});
    return copy;
  }

  Rules.register("notas.normalize", apply);

  window.BDLRulesNotas = {
    parseNota: parseNota,
    finalNota: finalNota,
    estadoNota: estadoNota,
    build: build,
    apply: apply
  };
})(window);
