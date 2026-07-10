/* =========================================================
Nombre completo: tabla.message.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.message.js
Función o funciones:
- Generar mensajes institucionales neutros desde la pantalla Tabla.
- Usar nombre, cédula, carrera y período del estudiante.
- Agregar contactos responsables según requisitos pendientes.
- Preparar mensajes para requisitos, urgencia, último aviso, notas y casos especiales.
- Mantener compatibilidad con tabla.telegram.js, tabla.mass.js y tabla.app.js.
========================================================= */
(function(window){
  "use strict";

  var CONTACTO_GENERAL = "0988402774";
  var DEFAULT_FIRMA = "Mgs. Jefferson Villarreal\nCoordinador de Titulación";

  var REQ_DEFS = [
    {key:"academico", field:"academico", label:"Académico", aliases:["academico","Académico","Academico"], contacto:"Martha Tomalá y coordinadores", correo:"mtomala@itsqmet.edu.ec"},
    {key:"documentacion", field:"documentacion", label:"Documentación académica", aliases:["documentacion","Documentación","Documentacion","documentacionacademica"], contacto:"Leidy Salinas", correo:"lsalinas@itsqmet.edu.ec"},
    {key:"financiero", field:"financiero", label:"Financiero", aliases:["financiero","Financiero","deuda","pagos"], contacto:"Paulina Araujo", correo:"paraujo@itsqmet.edu.ec"},
    {key:"titulacion", field:"titulacion", label:"Titulación", aliases:["titulacion","Titulación","Titulacion","aprobacionTitulacion"], contacto:"Jefferson Villarreal", correo:"jvillarreal@itsqmet.edu.ec"},
    {key:"practicasvinculacion", field:"practicasVinculacion", label:"Prácticas preprofesionales", aliases:["practicasvinculacion","practicasVinculacion","PrácticasVinculacion","PracticasVinculacion","practicas","practicaspreprofesionales"], contacto:"Verónica Ayala", correo:"veayala@itsqmet.edu.ec"},
    {key:"vinculacion", field:"vinculacion", label:"Vinculación con la sociedad", aliases:["vinculacion","Vinculación","Vinculacion"], contacto:"Verónica Ayala", correo:"veayala@itsqmet.edu.ec"},
    {key:"seguimientograduados", field:"seguimientoGraduados", label:"Seguimiento a graduados", aliases:["seguimientograduados","seguimientoGraduados","SeguimientoGraduados","graduados"], contacto:"Yessenia Ortega", correo:"mortegaf@itsqmet.edu.ec"},
    {key:"ingles", field:"ingles", label:"Segunda lengua / Inglés", aliases:["ingles","Inglés","Ingles","segundaLengua"], contacto:"Alejandra Hernández", correo:"mhernandez@itsqmet.edu.ec"},
    {key:"actualizaciondatos", field:"actualizacionDatos", label:"Actualización de datos", aliases:["actualizaciondatos","actualizacionDatos","ActualizaciónDatos","ActualizacionDatos","datos"], contacto:"Leidy Salinas", correo:"lsalinas@itsqmet.edu.ec"}
  ];

  var TIPO_LABELS = {
    requisitos:"Falta req.",
    falta:"Falta req.",
    urgente:"Urgente",
    ultimo:"Último aviso",
    ultimo_aviso:"Último aviso",
    regularizar:"Regularizar",
    nota_articulo:"Falta N-Art",
    nota_defensa:"Falta N-Def",
    sin_articulo:"Sin artículo",
    no_aprueba:"No aprueba",
    perdio:"Perdió",
    alerta:"Alerta",
    cronograma:"Cronograma",
    libre:"Personal"
  };

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function normalizeKey(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"").toLowerCase();}

  function pick(row, aliases, fallback){
    var item = row || {};
    var keys = Object.keys(item);
    aliases = aliases || [];
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
    if(["si","s","ok","cumple","aprobado","aprobada","1","true","x","validado","completo","completa"].indexOf(clean) >= 0){return "cumple";}
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
      estadoLabel:estadoLabel(estado),
      contacto:req.contacto,
      correo:req.correo
    };
  }

  function listarRequisitos(row){
    if(window.TablaCore && typeof window.TablaCore.missingRequirements === "function" && row && Array.isArray(row._requisitosFaltantes)){
      var known = {};
      row._requisitosFaltantes.forEach(function(req){known[normalizeKey(req.key || req.label)] = true;});
      return REQ_DEFS.map(function(req){
        var base = requisitoInfo(row || {}, req);
        if(known[normalizeKey(req.key)] || known[normalizeKey(req.label)]){
          base.estado = "no_cumple";
          base.estadoLabel = "No cumple";
        }
        return base;
      });
    }
    return REQ_DEFS.map(function(req){return requisitoInfo(row || {}, req);});
  }

  function listarRequisitosPendientes(row){
    if(window.TablaCore && typeof window.TablaCore.missingRequirements === "function"){
      try{
        var missing = window.TablaCore.missingRequirements(row || {});
        if(Array.isArray(missing) && missing.length){
          return missing.map(function(item){
            var key = normalizeKey(item.key || item.label);
            var base = REQ_DEFS.filter(function(req){return normalizeKey(req.key) === key || normalizeKey(req.label) === key;})[0] || {};
            return {
              key:item.key || base.key || key,
              label:item.label || base.label || item.key || "Requisito",
              value:text(item.value || ""),
              estado:item.estado || "no_cumple",
              estadoLabel:item.estadoLabel || "No cumple",
              contacto:base.contacto || "Área correspondiente",
              correo:base.correo || ""
            };
          });
        }
      }catch(error){}
    }
    return listarRequisitos(row).filter(function(req){return req.estado !== "cumple";});
  }

  function datosEstudiante(row){
    row = row || {};
    return {
      nombre:text(row._nombres || row.nombres || row.Nombres || row.nombre || row.estudiante) || "estudiante",
      cedula:text(row._cedula || row.cedula || row.numeroIdentificacion || row.numeroidentificacion),
      carrera:text(row._carrera || row.nombrecarrera || row.nombreCarrera || row.NombreCarrera || row.carrera),
      carreraCorta:text(row._carreraCorta || ""),
      periodo:text(row._periodo || row.periodoLabel || row.periodoId || row._bl2Periodo),
      division:text(row._division || row.division || row._bl2Division),
      correo:text(row._correo || row.correo || row.email || row.Email),
      celular:text(row._celular || row.celular || row.whatsapp || row.telefono),
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

  function tipoLabel(tipo){
    tipo = normalizeKey(tipo || "requisitos");
    return TIPO_LABELS[tipo] || TIPO_LABELS.requisitos;
  }

  function contactoKey(req){return normalizeKey((req && (req.contacto || "")) + "|" + (req && (req.correo || "")));}

  function contactosPorPendientes(pendientes){
    var map = {};
    var out = [];
    (pendientes || []).forEach(function(req){
      var key = contactoKey(req);
      if(!req || !req.correo || map[key]){return;}
      map[key] = true;
      out.push((req.label || "Área") + ":\n" + req.contacto + "\n" + req.correo);
    });
    return out;
  }

  function detallePendientes(row, tipo){
    tipo = normalizeKey(tipo || "requisitos");
    var pendientes = listarRequisitosPendientes(row || {});
    var lines = [];

    if(["notaarticulo","nota_articulo"].indexOf(tipo) >= 0){
      lines.push("Se registra una novedad relacionada con la nota de artículo académico. Debe revisar si la nota no consta registrada o si no alcanza la calificación mínima requerida.");
      return {detalle:lines, pendientes:pendientes.filter(function(req){return req.key === "titulacion";})};
    }

    if(["notadefensa","nota_defensa"].indexOf(tipo) >= 0){
      lines.push("Se registra una novedad relacionada con la nota de defensa. Debe revisar si la nota no consta registrada o si no alcanza la calificación mínima requerida.");
      return {detalle:lines, pendientes:pendientes.filter(function(req){return req.key === "titulacion";})};
    }

    if(["sinarticulo","sin_articulo"].indexOf(tipo) >= 0){
      lines.push("Se registra que no consta el cumplimiento o registro del artículo académico dentro del proceso de titulación.");
      return {detalle:lines, pendientes:pendientes.filter(function(req){return req.key === "titulacion";})};
    }

    if(["noaprueba","no_aprueba"].indexOf(tipo) >= 0){
      lines.push("Se registra que actualmente no cumple con las condiciones mínimas de aprobación del proceso de titulación. Debe revisar su situación de forma inmediata.");
      return {detalle:lines, pendientes:pendientes.filter(function(req){return req.key === "titulacion";})};
    }

    if(tipo === "perdio"){
      lines.push("Según la revisión registrada, su proceso consta como no aprobado o perdido en el período indicado. Debe comunicarse para recibir orientación sobre los siguientes pasos.");
      return {detalle:lines, pendientes:pendientes};
    }

    if(tipo === "alerta"){
      lines.push("Su caso requiere revisión especial por parte del área correspondiente.");
    }else if(tipo === "urgente"){
      lines.push("Su proceso requiere atención urgente, debido a que existen novedades que pueden afectar su continuidad.");
    }else if(tipo === "ultimo" || tipo === "ultimoaviso"){
      lines.push("Este mensaje corresponde a un último aviso de regularización de pendientes registrados en su proceso.");
    }else if(tipo === "regularizar"){
      lines.push("Debe regularizar la siguiente información para continuar con su proceso.");
    }else{
      lines.push("Se identifican novedades pendientes que deben ser regularizadas para continuar con su proceso.");
    }

    if(pendientes.length){
      lines.push("", "Detalle:");
      pendientes.forEach(function(req){
        var extra = req.value ? " — Estado registrado: " + req.value : "";
        lines.push("- " + req.label + extra);
      });
    }else{
      lines.push("", "Detalle:", "- No se identifican requisitos faltantes en la base revisada, pero se solicita validar la información registrada.");
    }

    return {detalle:lines, pendientes:pendientes};
  }

  function baseMensaje(row, tipo, detalle, pendientes, options){
    var data = datosEstudiante(row || {});
    var contactos = contactosPorPendientes(pendientes || []);
    var lines = [
      "Saludos, " + data.nombre + ".",
      "",
      "Desde el área de Titulación se informa que, al revisar su proceso correspondiente al período " + (data.periodo || "—") + ", se registra la siguiente información:",
      "",
      "Cédula: " + (data.cedula || "—"),
      "Carrera: " + (data.carrera || "—"),
      "",
      detalle.join("\n")
    ];

    if(contactos.length){
      lines.push("", "Por favor, revise la información y comuníquese con el área correspondiente:", "", contactos.join("\n\n"));
    }else{
      lines.push("", "Por favor, revise la información y comuníquese con el área correspondiente para validar su situación.");
    }

    lines.push("", "Para orientación general sobre el proceso de titulación, puede comunicarse al " + CONTACTO_GENERAL + ".", "", firma(options));
    return lines.join("\n");
  }

  function generarMensajeRequisitos(row, options){
    var info = detallePendientes(row || {}, "requisitos");
    return baseMensaje(row, "requisitos", info.detalle, info.pendientes, options);
  }

  function generarMensajeTipo(row, tipo, options){
    var info = detallePendientes(row || {}, tipo || "requisitos");
    return baseMensaje(row, tipo, info.detalle, info.pendientes, options);
  }

  function generarMensajeCronograma(row, textoCronograma, options){
    var data = datosEstudiante(row || {});
    var body = aplicarVariables(textoCronograma, row || {});
    return [
      "Saludos, " + data.nombre + ".",
      "",
      "Desde el área de Titulación se comparte información correspondiente al período " + (data.periodo || "—") + ":",
      "",
      body || "[Escriba aquí el cronograma o la información que desea comunicar.]",
      "",
      "Para orientación general sobre el proceso de titulación, puede comunicarse al " + CONTACTO_GENERAL + ".",
      "",
      firma(options)
    ].join("\n");
  }

  function generarMensajeLibre(row, textoLibre, options){
    var data = datosEstudiante(row || {});
    var body = aplicarVariables(textoLibre, row || {});
    options = options || {};
    if(options.envolver === false){return body;}
    return [
      "Saludos, " + data.nombre + ".",
      "",
      body || "[Escriba aquí el mensaje que desea enviar.]",
      "",
      "Para orientación general sobre el proceso de titulación, puede comunicarse al " + CONTACTO_GENERAL + ".",
      "",
      firma(options)
    ].join("\n");
  }

  function generarMensaje(row, tipo, payload, options){
    tipo = normalizeKey(tipo || "requisitos");
    payload = payload || {};
    if(tipo === "cronograma"){return generarMensajeCronograma(row, payload.texto || payload.mensaje || "", options);}
    if(tipo === "libre" || tipo === "personal"){return generarMensajeLibre(row, payload.texto || payload.mensaje || "", options);}
    return generarMensajeTipo(row, tipo, options);
  }

  function asunto(row, tipo){
    var data = datosEstudiante(row || {});
    var label = tipoLabel(tipo || "requisitos");
    return label + " - Proceso de titulación" + (data.periodo ? " - " + data.periodo : "");
  }

  window.TablaMessage = {
    REQ_DEFS:REQ_DEFS.slice(),
    CONTACTO_GENERAL:CONTACTO_GENERAL,
    TIPO_LABELS:Object.assign({}, TIPO_LABELS),
    datosEstudiante:datosEstudiante,
    listarRequisitos:listarRequisitos,
    listarRequisitosPendientes:listarRequisitosPendientes,
    contactosPorPendientes:contactosPorPendientes,
    generarMensajeRequisitos:generarMensajeRequisitos,
    generarMensajeTipo:generarMensajeTipo,
    generarMensajeCronograma:generarMensajeCronograma,
    generarMensajeLibre:generarMensajeLibre,
    generarMensaje:generarMensaje,
    aplicarVariables:aplicarVariables,
    asunto:asunto,
    tipoLabel:tipoLabel
  };
})(window);
