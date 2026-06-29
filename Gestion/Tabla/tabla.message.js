/* =========================================================
Nombre completo: tabla.message.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.message.js
Función o funciones:
- Generar mensajes formales para estudiantes desde la pantalla Tabla.
- Listar requisitos pendientes o no cumplidos sin modificar la base de datos.
- Preparar mensajes de requisitos faltantes, cronograma manual y mensaje libre.
- Reutilizar datos normalizados por TablaCore y alias tolerantes de Base Local.
Con qué se conecta:
- tabla.core.js
- tabla.telegram.js
- tabla.mass.js
- tabla.app.js
========================================================= */
(function(window){
  "use strict";

  var DEFAULT_FIRMA = "Msc. Jefferson Villarreal\nCoordinador de Titulación";

  var REQ_DEFS = [
    {key:"academico", field:"academico", label:"Académico", aliases:["academico","Académico","Academico"]},
    {key:"documentacion", field:"documentacion", label:"Documentación", aliases:["documentacion","Documentación","Documentacion"]},
    {key:"financiero", field:"financiero", label:"Financiero", aliases:["financiero","Financiero"]},
    {key:"titulacion", field:"titulacion", label:"Titulación", aliases:["titulacion","Titulación","Titulacion"]},
    {key:"practicasvinculacion", field:"practicasVinculacion", label:"Prácticas", aliases:["practicasvinculacion","practicasVinculacion","prácticasVinculacion","PrácticasVinculacion","PracticasVinculacion","Prácticas/Vinculación","Practicas/Vinculacion","practicas/vinculacion"]},
    {key:"vinculacion", field:"vinculacion", label:"Vinculación", aliases:["vinculacion","Vinculación","Vinculacion"]},
    {key:"seguimientograduados", field:"seguimientoGraduados", label:"Seguimiento graduados", aliases:["seguimientograduados","seguimientoGraduados","SeguimientoGraduados"]},
    {key:"ingles", field:"ingles", label:"Inglés", aliases:["ingles","Inglés","Ingles"]},
    {key:"actualizaciondatos", field:"actualizacionDatos", label:"Actualización de datos", aliases:["actualizaciondatos","actualizacionDatos","actualizaciónDatos","ActualizaciónDatos","ActualizacionDatos"]},
    {key:"aprobaciontitulacion", field:"aprobacionTitulacion", label:"Aprobación titulación", aliases:["aprobaciontitulacion","aprobacionTitulacion","AprobacionTitulacion","AprobaciónTitulacion"]},
    {key:"aprobacioncomplexivoproyecto", field:"aprobacionComplexivoProyecto", label:"Aprobación complexivo/proyecto", aliases:["aprobacioncomplexivoproyecto","aprobacionComplexivoProyecto","AprobacionComplexivoProyecto","AprobaciónComplexivoProyecto"]}
  ];

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function normalizeKey(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"").toLowerCase();}

  function pick(row, aliases, fallback){
    var item = row || {};
    var keys = Object.keys(item);
    for(var i = 0; i < aliases.length; i += 1){
      var wanted = normalizeKey(aliases[i]);
      for(var j = 0; j < keys.length; j += 1){
        if(normalizeKey(keys[j]) === wanted){
          var value = item[keys[j]];
          if(value != null && text(value) !== ""){return value;}
        }
      }
    }
    return fallback;
  }

  function labelFor(req){
    try{
      if(window.BLCampos && typeof window.BLCampos.requirementLabel === "function"){
        return window.BLCampos.requirementLabel(req.key, req.label);
      }
    }catch(error){}
    return req.label || req.key;
  }

  function valueFor(row, req){
    try{
      if(window.BLCampos && typeof window.BLCampos.getValue === "function"){
        var value = window.BLCampos.getValue(row, req.field || req.key, "");
        if(value != null && text(value) !== ""){return value;}
      }
    }catch(error){}
    return pick(row, req.aliases || [req.key], "");
  }

  function estadoCelda(value){
    var clean = norm(value);
    if(!clean){return "pendiente";}
    if(["si","s","ok","cumple","aprobado","aprobada","1","true","x","validado","completo"].indexOf(clean) >= 0){return "cumple";}
    if(clean.indexOf("no cumple") >= 0 || ["no","n","reprobado","reprobada","0","false","falta","incompleto"].indexOf(clean) >= 0){return "no_cumple";}
    return "pendiente";
  }

  function estadoLabel(estado){
    if(estado === "no_cumple"){return "No cumple";}
    if(estado === "pendiente"){return "Pendiente";}
    return "Cumple";
  }

  function requisitoInfo(row, req){
    var raw = valueFor(row, req);
    var estado = estadoCelda(raw);
    return {
      key:req.key,
      field:req.field,
      label:labelFor(req),
      value:text(raw),
      estado:estado,
      estadoLabel:estadoLabel(estado)
    };
  }

  function listarRequisitos(row){
    return REQ_DEFS.map(function(req){return requisitoInfo(row || {}, req);});
  }

  function listarRequisitosPendientes(row){
    return listarRequisitos(row).filter(function(req){return req.estado !== "cumple";});
  }

  function datosEstudiante(row){
    row = row || {};
    return {
      nombre:text(row._nombres || row.nombres || row.Nombres || row.nombre || row.estudiante) || "estudiante",
      cedula:text(row._cedula || row.cedula || row.numeroIdentificacion || row.numeroidentificacion),
      carrera:text(row._carrera || row.nombrecarrera || row.nombreCarrera || row.NombreCarrera || row.carrera),
      periodo:text(row._periodo || row.periodoLabel || row.periodoId || row._bl2Periodo),
      division:text(row._division || row.division || row._bl2Division),
      telegram:text(row._telegramChatId || row._telegramUser || row.telegramChatId || row.telegramUser || row.telegram || row.chatId)
    };
  }

  function aplicarVariables(template, row){
    var data = datosEstudiante(row || {});
    return text(template)
      .replace(/{{\s*NOMBRE\s*}}/gi, data.nombre)
      .replace(/{{\s*CEDULA\s*}}/gi, data.cedula || "—")
      .replace(/{{\s*CARRERA\s*}}/gi, data.carrera || "—")
      .replace(/{{\s*PERIODO\s*}}/gi, data.periodo || "—")
      .replace(/{{\s*DIVISION\s*}}/gi, data.division || "—")
      .replace(/{{\s*TELEGRAM\s*}}/gi, data.telegram || "—");
  }

  function firma(options){
    options = options || {};
    return text(options.firma) || DEFAULT_FIRMA;
  }

  function generarMensajeRequisitos(row, options){
    options = options || {};
    var data = datosEstudiante(row || {});
    var pendientes = listarRequisitosPendientes(row || {});
    var lines = [
      "Estimado/a " + data.nombre + ", reciba un cordial saludo.",
      "",
      "Desde el área de Titulación se le informa que, dentro de la revisión de requisitos" + (data.periodo ? " correspondiente al período " + data.periodo : "") + ", se registra la siguiente información:",
      ""
    ];

    if(pendientes.length){
      lines.push("Requisitos pendientes o por regularizar:");
      pendientes.forEach(function(req, index){
        var detalle = req.value ? " — Estado registrado: " + req.value : "";
        lines.push((index + 1) + ". " + req.label + detalle);
      });
      lines.push("", "Por favor, revise su caso y remita la información o evidencia correspondiente para continuar con el proceso de titulación.");
    }else{
      lines.push("Actualmente no registra requisitos pendientes en la base revisada.");
    }

    lines.push("", "Atentamente,", firma(options));
    return lines.join("\n");
  }

  function generarMensajeCronograma(row, textoCronograma, options){
    options = options || {};
    var data = datosEstudiante(row || {});
    var body = aplicarVariables(textoCronograma, row || {});
    var lines = [
      "Estimado/a " + data.nombre + ", reciba un cordial saludo.",
      "",
      "Desde el área de Titulación se comparte la siguiente información de cronograma" + (data.periodo ? " correspondiente al período " + data.periodo : "") + ":",
      "",
      body || "[Escriba aquí el cronograma o la información que desea comunicar.]",
      "",
      "Atentamente,",
      firma(options)
    ];
    return lines.join("\n");
  }

  function generarMensajeLibre(row, textoLibre, options){
    options = options || {};
    var data = datosEstudiante(row || {});
    var body = aplicarVariables(textoLibre, row || {});
    if(options.envolver === false){return body;}
    return [
      "Estimado/a " + data.nombre + ", reciba un cordial saludo.",
      "",
      body || "[Escriba aquí el mensaje que desea enviar.]",
      "",
      "Atentamente,",
      firma(options)
    ].join("\n");
  }

  function generarMensaje(row, tipo, payload, options){
    tipo = text(tipo || "requisitos").toLowerCase();
    payload = payload || {};
    if(tipo === "cronograma"){return generarMensajeCronograma(row, payload.texto || payload.mensaje || "", options);}
    if(tipo === "libre"){return generarMensajeLibre(row, payload.texto || payload.mensaje || "", options);}
    return generarMensajeRequisitos(row, options);
  }

  window.TablaMessage = {
    REQ_DEFS:REQ_DEFS.slice(),
    datosEstudiante:datosEstudiante,
    listarRequisitos:listarRequisitos,
    listarRequisitosPendientes:listarRequisitosPendientes,
    generarMensajeRequisitos:generarMensajeRequisitos,
    generarMensajeCronograma:generarMensajeCronograma,
    generarMensajeLibre:generarMensajeLibre,
    generarMensaje:generarMensaje,
    aplicarVariables:aplicarVariables
  };
})(window);
