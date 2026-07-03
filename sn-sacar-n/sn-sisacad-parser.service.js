/* =========================================================
Nombre completo: sn-sisacad-parser.service.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-sisacad-parser.service.js
Modulo: Sacar N
Funcion o funciones:
- Normalizar resultados recibidos desde Electron/SISACAD.
- Convertir notas leidas en campos del estudiante.
- Mantener separado el parseo visual de la logica de extraccion.
Con que se conecta:
- sn-models.js
- sn-sisacad-extractor.service.js
========================================================= */
(function(window){
  "use strict";

  var models = window.SNModels || {};

  function texto(valor){
    return models.texto ? models.texto(valor) : String(valor == null ? "" : valor).replace(/\s+/g, " ").trim();
  }

  function normalizarResultado(resultado){
    resultado = resultado || {};
    var notas = resultado.notas || {};
    return {
      id: texto(resultado.id || resultado.cedula),
      cedula: texto(resultado.cedula),
      nombres: texto(resultado.nombres),
      carrera: texto(resultado.carrera),
      periodo: texto(resultado.periodo),
      promedioTrabajoEscrito: texto(notas.promedioTrabajoEscrito),
      promedioDefensaOral: texto(notas.promedioDefensaOral),
      calificacionFinalProyecto: texto(notas.calificacionFinalProyecto),
      estado: texto(resultado.estado || "Revisar manualmente"),
      observacion: texto(resultado.observacion),
      fuente: "SISACAD",
      fechaExtraccion: models.ahora ? models.ahora() : new Date().toISOString(),
      raw: resultado
    };
  }

  function cambiosParaEstudiante(resultadoNormalizado){
    resultadoNormalizado = resultadoNormalizado || {};
    return {
      promedioTrabajoEscrito: texto(resultadoNormalizado.promedioTrabajoEscrito),
      promedioDefensaOral: texto(resultadoNormalizado.promedioDefensaOral),
      calificacionFinalProyecto: texto(resultadoNormalizado.calificacionFinalProyecto),
      estado: texto(resultadoNormalizado.estado),
      observacion: texto(resultadoNormalizado.observacion),
      fechaExtraccion: texto(resultadoNormalizado.fechaExtraccion),
      fuente: "SISACAD"
    };
  }

  window.SNSisacadParser = {
    normalizarResultado: normalizarResultado,
    cambiosParaEstudiante: cambiosParaEstudiante
  };
})(window);
