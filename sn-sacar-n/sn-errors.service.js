/* =========================================================
Nombre completo: sn-errors.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-errors.service.js
Modulo: Sacar N
Funcion o funciones:
- Registrar novedades y errores del modulo Sacar N.
- Convertir resultados de SISACAD en observaciones claras para revision manual.
- Evitar que un error pequeno detenga todo el proceso.
Con que se conecta:
- sn-models.js
- sn-state.service.js
- sn-sisacad-extractor.service.js
========================================================= */
(function(window){
  "use strict";

  var models = window.SNModels || {};
  var state = window.SNState || {};

  function registrar(tipo, estudiante, detalle, paso){
    var novedad = models.crearNovedad
      ? models.crearNovedad(tipo, estudiante, detalle, paso)
      : { tipo:tipo, detalle:detalle, paso:paso, fecha:new Date().toISOString() };
    if(state.agregarNovedad){ state.agregarNovedad(novedad); }
    return novedad;
  }

  function desdeResultado(resultado){
    resultado = resultado || {};
    var estado = String(resultado.estado || "");
    if(estado === "Procesado"){ return null; }
    return registrar(
      estado || "Revisar manualmente",
      resultado,
      resultado.observacion || "Caso para revision manual.",
      resultado.paso || "prueba_visible"
    );
  }

  window.SNErrors = {
    registrar: registrar,
    desdeResultado: desdeResultado
  };
})(window);
