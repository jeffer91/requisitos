/* =========================================================
Archivo: bdl.service.ficha.js
Ruta: /BDLocal/services/bdl.service.ficha.js
Función:
- Servicio de detalle de ficha de estudiante.
- Cargar un estudiante específico por periodoId + cedula.
- Adjuntar matrícula, persona, requisitos, notas y contacto sin cargar toda la base desde pantalla.
Con qué se conecta:
- BDLocal/services/bdl.service.index.js
- BDLocal/repositories/bdl.repo.*.js
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  function text(value){ return Services.text(value); }

  function safeCall(repoName, fnName, fallback){
    var repo = Services.repo(repoName);
    if(repo && typeof repo[fnName] === "function"){
      return repo[fnName].apply(repo, Array.prototype.slice.call(arguments, 3));
    }
    return Promise.resolve(fallback);
  }

  function getDetalle(options){
    options = options || {};
    var periodoId = text(options.periodoId);
    var cedula = text(options.cedula);

    if(!periodoId || !cedula){
      return Promise.resolve({ ok: false, error: "Falta periodoId o cédula.", estudiante: null });
    }

    return Promise.all([
      safeCall("estudiantes", "getByPeriodoCedula", null, periodoId, cedula),
      safeCall("personas", "getByCedula", null, cedula),
      safeCall("matriculas", "getByPeriodoCedula", null, periodoId, cedula),
      safeCall("requisitos", "list", [], { periodoId: periodoId, cedula: cedula }),
      safeCall("notas", "getByPeriodoCedula", null, periodoId, cedula),
      safeCall("contactos", "getByCedula", null, cedula, periodoId)
    ]).then(function(result){
      return {
        ok: true,
        periodoId: periodoId,
        cedula: cedula,
        estudiante: result[0],
        persona: result[1],
        matricula: result[2],
        requisitos: result[3] || [],
        notas: result[4],
        contacto: result[5]
      };
    });
  }

  var api = { getDetalle: getDetalle };
  Services.register("ficha", api);
  window.BDLServiceFicha = api;
})(window);
