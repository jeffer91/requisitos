/* =========================================================
Nombre completo: sn-config.js
Ruta o ubicacion: /Requisitos/sn-sacar-n/sn-config.js
Modulo: Sacar N
Funcion o funciones:
- Definir la configuracion base del modulo Sacar N.
- Centralizar URL de SISACAD, estados, tiempos y textos clave.
- Mantener el modulo preparado para Electron + Playwright sin ejecutar automatizaciones todavia.
Con que se conecta:
- sn-sacar-n.js
- sn-models.js
- sn-state.service.js
========================================================= */
(function(window){
  "use strict";

  var SNConfig = {
    moduloId: "sacar_n",
    moduloNombre: "Sacar N",
    moduloTitulo: "Sacar N",
    version: "0.1.0",
    fase: "base",
    sisacadUrl: "https://sisacad.itsqmet.edu.ec/",
    pruebaVisibleCantidad: 3,
    tiempos: {
      esperaCortaMs: 700,
      esperaMediaMs: 1500,
      esperaLargaMs: 4000,
      pausaEntreEstudiantesMs: 1200,
      reintentosPorEstudiante: 2
    },
    storageKeys: {
      estado: "REQ_SN_ESTADO_V1",
      resultados: "REQ_SN_RESULTADOS_V1",
      novedades: "REQ_SN_NOVEDADES_V1",
      ultimaExtraccion: "REQ_SN_ULTIMA_EXTRACCION_V1"
    },
    estadosModulo: {
      sinIniciar: "sin_iniciar",
      cargandoEstudiantes: "cargando_estudiantes",
      listo: "listo",
      pruebaVisible: "prueba_visible",
      extrayendo: "extrayendo",
      pausado: "pausado",
      finalizado: "finalizado",
      errorCritico: "error_critico"
    },
    estadosEstudiante: {
      pendiente: "Pendiente",
      procesando: "Procesando",
      procesado: "Procesado",
      noEncontrado: "No encontrado",
      sinNotas: "Sin notas",
      errorCarga: "Error de carga",
      sesionExpirada: "Sesion expirada",
      revisarManualmente: "Revisar manualmente"
    },
    notasObjetivo: {
      promedioTrabajoEscrito: "PROMEDIO TRABAJO ESCRITO",
      promedioDefensaOral: "PROMEDIO DEFENSA ORAL DEL PROYECTO DE TITULACION",
      calificacionFinalProyecto: "CALIFICACION FINAL DEL PROYECTO DE TITULACION"
    },
    seguridad: {
      soloLectura: true,
      guardarContrasenas: false,
      modificarSisacad: false,
      procesarConConfirmacion: true
    }
  };

  window.SNConfig = SNConfig;
})(window);
