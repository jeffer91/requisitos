/* =========================================================
Nombre completo: bl2-search.service.js
Ruta o ubicación: /Requisitos/BaseLocal2/services/bl2-search.service.js
Función o funciones:
- Normalizar textos de búsqueda para BL2.
- Construir texto de búsqueda por estudiante sin modificar los datos originales.
- Evitar repetir lógica de búsqueda en Ficha, Tabla y futuros módulos.
Con qué se conecta:
- repositories/bl2-estudiantes.repo.js
- Ficha/ficha.core.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function normalize(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function key(value){return normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");}

  function pick(row, names, fallback){
    row = row || {};
    var keys = Object.keys(row);
    for(var i = 0; i < names.length; i += 1){
      var wanted = normalize(names[i]);
      for(var j = 0; j < keys.length; j += 1){
        if(normalize(keys[j]) === wanted){
          var value = row[keys[j]];
          if(value != null && text(value) !== ""){return value;}
        }
      }
    }
    return fallback || "";
  }

  function studentText(row){
    row = row || {};
    return normalize([
      pick(row, ["cedula", "numeroIdentificacion", "identificacion", "_bl2Id"], ""),
      pick(row, ["nombres", "nombre", "estudiante", "_bl2Nombre"], ""),
      pick(row, ["nombreCarrera", "nombrecarrera", "carrera", "_bl2Carrera"], ""),
      pick(row, ["periodoId", "periodoLabel", "periodo", "_bl2Periodo"], ""),
      pick(row, ["division", "división", "_bl2Division"], ""),
      pick(row, ["correoPersonal", "correoInstitucional", "email", "correo"], ""),
      pick(row, ["celular", "telefono", "whatsapp"], ""),
      pick(row, ["estadoMatricula", "_bl2EstadoMatricula"], "")
    ].join(" "));
  }

  function matches(row, query){
    var q = normalize(query || "");
    if(!q){return true;}
    return studentText(row).indexOf(q) >= 0;
  }

  window.BL2SearchService = {version:"2.0.0-alpha.1",text:text,normalize:normalize,key:key,pick:pick,studentText:studentText,matches:matches};
})(window);
