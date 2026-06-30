/* =========================================================
Nombre completo: sn-models.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-models.js
Modulo: Sacar N
Funcion o funciones:
- Definir modelos simples para estudiantes, resultados y novedades.
- Normalizar cedulas, nombres, carreras, periodos y estados.
- Evitar estructuras improvisadas en los siguientes bloques.
Con que se conecta:
- sn-config.js
- sn-state.service.js
- sn-sacar-n.js
========================================================= */
(function(window){
  "use strict";

  var cfg = window.SNConfig || {};
  var estados = cfg.estadosEstudiante || {};

  function texto(valor){
    return String(valor == null ? "" : valor).replace(/\s+/g, " ").trim();
  }

  function limpiarCedula(valor){
    return texto(valor).replace(/[^0-9]/g, "");
  }

  function ahora(){
    return new Date().toISOString();
  }

  function crearEstudiante(raw, index){
    raw = raw || {};
    var cedula = limpiarCedula(raw.cedula || raw.Cedula || raw.numeroIdentificacion || raw.identificacion || "");
    var nombres = texto(raw.nombres || raw.Nombres || raw.estudiante || raw.Estudiante || raw.nombreCompleto || "");
    var carrera = texto(raw.carrera || raw.Carrera || raw.nombreCarrera || raw.NombreCarrera || "");
    var periodo = texto(raw.periodo || raw.Periodo || raw.periodoLabel || raw.periodoId || "");
    var modalidad = texto(raw.modalidad || raw.Modalidad || raw.division || raw.Division || "");

    return {
      id: texto(raw.id || raw.idEstudiantePeriodo || cedula || ("sn-estudiante-" + (index || 0))),
      orden: Number(index || 0) + 1,
      cedula: cedula,
      nombres: nombres,
      carrera: carrera,
      periodo: periodo,
      modalidad: modalidad,
      promedioTrabajoEscrito: "",
      promedioDefensaOral: "",
      calificacionFinalProyecto: "",
      estado: estados.pendiente || "Pendiente",
      observacion: "",
      fuente: "SISACAD",
      fechaExtraccion: "",
      raw: raw
    };
  }

  function crearResultado(estudiante, notas, estado, observacion){
    estudiante = estudiante || {};
    notas = notas || {};
    return {
      id: texto(estudiante.id || estudiante.cedula || ("sn-resultado-" + Date.now())),
      cedula: limpiarCedula(estudiante.cedula),
      nombres: texto(estudiante.nombres),
      carrera: texto(estudiante.carrera),
      periodo: texto(estudiante.periodo),
      modalidad: texto(estudiante.modalidad),
      promedioTrabajoEscrito: texto(notas.promedioTrabajoEscrito),
      promedioDefensaOral: texto(notas.promedioDefensaOral),
      calificacionFinalProyecto: texto(notas.calificacionFinalProyecto),
      estado: texto(estado || estados.procesado || "Procesado"),
      observacion: texto(observacion),
      fuente: "SISACAD",
      fechaExtraccion: ahora()
    };
  }

  function crearNovedad(tipo, estudiante, detalle, paso){
    estudiante = estudiante || {};
    return {
      id: "sn-novedad-" + Date.now() + "-" + Math.random().toString(16).slice(2),
      tipo: texto(tipo || "Novedad"),
      cedula: limpiarCedula(estudiante.cedula),
      nombres: texto(estudiante.nombres),
      carrera: texto(estudiante.carrera),
      periodo: texto(estudiante.periodo),
      detalle: texto(detalle),
      paso: texto(paso),
      fecha: ahora(),
      accionRecomendada: "Revisar manualmente"
    };
  }

  window.SNModels = {
    texto: texto,
    limpiarCedula: limpiarCedula,
    ahora: ahora,
    crearEstudiante: crearEstudiante,
    crearResultado: crearResultado,
    crearNovedad: crearNovedad
  };
})(window);
