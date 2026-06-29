/* =========================================================
Nombre completo: bl-notas-defensa.service.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-notas-defensa.service.js
Función o funciones:
- Centralizar lectura, normalización, cálculo y guardado de notas de defensa.
- Calcular N-FIN con fórmula institucional: (N-ART * 0.70) + (N-DEF * 0.30).
- Mantener alias compatibles con Firebase, BaseLocal, Ficha, Defensas y exportaciones.
Con qué se conecta:
- defart.core.js
- ficha.core.js
- bl2-requisitos.repo.js
========================================================= */
(function(window){
  "use strict";

  var ALIASES = {
    nart:["Notart","notart","Nart","nart","N_ART","N-ART","NotaArt","notaArt","notaArticulo","nota_articulo"],
    ndef:["Notdef","notdef","Ndef","ndef","N_DEF","N-DEF","NotaDef","notaDef","notaDefensa","nota_defensa"],
    nfin:["Notafinal","notafinal","NotaFinal","notaFinal","Nfin","nfin","N_FIN","N-FIN","Nota final","nota final"]
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normKey(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s_-]+/g, "")
      .toLowerCase();
  }

  function findValue(row, aliases){
    row = row || {};
    var keys = Object.keys(row);
    for(var i = 0; i < aliases.length; i += 1){
      var wanted = normKey(aliases[i]);
      for(var j = 0; j < keys.length; j += 1){
        if(normKey(keys[j]) === wanted){
          var value = row[keys[j]];
          if(value !== null && value !== undefined && text(value) !== ""){
            return value;
          }
        }
      }
    }
    return "";
  }

  function normalizarNota(value){
    if(value === null || value === undefined || text(value) === ""){
      return null;
    }
    var raw = text(value).replace(",", ".");
    var num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  function redondear2(value){
    return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : null;
  }

  function validarNota(value){
    if(text(value) === ""){
      return true;
    }
    var n = normalizarNota(value);
    if(n === null || n < 0 || n > 10){
      return false;
    }
    var raw = text(value).replace(",", ".");
    return /^(\d|10)(\.\d{0,2})?$/.test(raw);
  }

  function calcularNfin(nart, ndef){
    var art = normalizarNota(nart);
    var def = normalizarNota(ndef);
    if(art === null || def === null){
      return null;
    }
    if(art < 7){
      return null;
    }
    return redondear2((art * 0.70) + (def * 0.30));
  }

  function formatearNota(value){
    var n = normalizarNota(value);
    if(n === null){
      return "";
    }
    return String(redondear2(n));
  }

  function extraerNotas(row){
    var nart = normalizarNota(findValue(row, ALIASES.nart));
    var ndef = normalizarNota(findValue(row, ALIASES.ndef));
    var storedNfin = normalizarNota(findValue(row, ALIASES.nfin));
    var calculatedNfin = calcularNfin(nart, ndef);
    var nfin = calculatedNfin !== null ? calculatedNfin : storedNfin;

    return {
      nart:nart,
      ndef:ndef,
      nfin:nfin,
      nfinCalculado:calculatedNfin,
      nfinGuardado:storedNfin,
      completo:nart !== null && ndef !== null && calculatedNfin !== null
    };
  }

  function aplicarNotas(row, nart, ndef, options){
    options = options || {};
    var out = Object.assign({}, row || {});
    var art = normalizarNota(nart);
    var def = normalizarNota(ndef);
    var fin = calcularNfin(art, def);
    var updatedAt = options.updatedAt || new Date().toISOString();

    out.Notart = art;
    out.Notdef = def;
    out.Notafinal = fin;

    out.Nart = art;
    out.Ndef = def;
    out.Nfin = fin;

    out.nart = art;
    out.ndef = def;
    out.nfin = fin;

    out.notaArticulo = art;
    out.notaDefensa = def;
    out.notaFinal = fin;

    out.ultimaEdicionLocal = updatedAt;
    out.updatedAt = updatedAt;
    out.notasDefensaActualizadasEn = updatedAt;
    out.notasDefensaOrigen = options.origen || "defensas";

    return out;
  }

  window.BLNotasDefensa = {
    version:"1.0.0",
    aliases:ALIASES,
    text:text,
    normalizarNota:normalizarNota,
    numberValue:normalizarNota,
    redondear2:redondear2,
    validarNota:validarNota,
    calcularNfin:calcularNfin,
    calculateFinal:calcularNfin,
    formatearNota:formatearNota,
    extraerNotas:extraerNotas,
    aplicarNotas:aplicarNotas
  };
})(window);
