/* =========================================================
Nombre completo: coo.mail.js
Ruta o ubicación: /Requisitos/Coordi/coo.mail.js
Función o funciones:
- Generar los tres correos institucionales de Coordi.
- Preparar destinatarios, copias, asunto y cuerpo completo.
- Abrir Outlook Web en el navegador predeterminado.
- Mantener compatibilidad con los constructores anteriores de Coordi.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "4.0.0-outlook-web-full-compose";
  var OUTLOOK_COMPOSE_URL = "https://outlook.office.com/mail/deeplink/compose";
  var MAX_OUTLOOK_URL_LENGTH = 120000;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function esc(value){
    return text(value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
  function fmt(value){ return Number(value || 0).toLocaleString("es-EC"); }
  function uniqueAddresses(values){
    var map = Object.create(null);
    var out = [];
    arr(values).forEach(function(value){
      text(value).split(/[;,]+/).forEach(function(piece){
        var address = text(piece);
        var key = address.toLowerCase();
        if(address && !map[key]){ map[key] = true; out.push(address); }
      });
    });
    return out;
  }
  function recipients(source){
    source = source || {};
    return uniqueAddresses(arr(source.correos).concat(arr(source.toList),[source.correo || source.to || ""]));
  }
  function copies(source){
    source = source || {};
    return uniqueAddresses(arr(source.copias).concat(arr(source.ccList),arr(source.cc)));
  }
  function baseStyle(){ return "font-family:Arial,sans-serif;color:#0f172a;font-size:13px;line-height:1.5;"; }
  function paragraph(value){ return '<p style="margin:0 0 12px;">'+value+'</p>'; }
  function filterValue(report,key,fallback){ return text(report && report.filters && report.filters[key]) || fallback || ""; }
  function periodLabel(report){ return filterValue(report,"periodLabel",filterValue(report,"periodId","Período no definido")); }
  function divisionLabel(report){ return filterValue(report,"division","Todas"); }
  function careerLabel(report){ return filterValue(report,"career",""); }
  function requirementLabel(report){ return filterValue(report,"requirementLabel",filterValue(report,"requirementKey","")); }

  function signatureHtml(){
    var firma = window.COOConfig && window.COOConfig.firma || {};
    return paragraph('Saludos cordiales,<br><strong>'+esc((firma.titulo ? firma.titulo + " " : "") + (firma.nombre || "Jefferson Villarreal"))+'</strong><br>'+esc(firma.cargo || "Coordinador de Titulación")+'<br>'+esc(firma.institucion || "ITSQMET"));
  }
  function signaturePlain(){
    var firma = window.COOConfig && window.COOConfig.firma || {};
    return [
      "Saludos cordiales,",
      (firma.titulo ? firma.titulo + " " : "") + (firma.nombre || "Jefferson Villarreal"),
      firma.cargo || "Coordinador de Titulación",
      firma.institucion || "ITSQMET"
    ].join("\n");
  }
  function wrapHtml(bodyHtml){ return '<div style="'+baseStyle()+'">'+bodyHtml+'</div>'; }

  function tableHtml(headers,rows){
    rows = arr(rows);
    if(!rows.length){ return paragraph('<strong>Sin datos para mostrar.</strong>'); }
    var html = '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;color:#0f172a;margin:8px 0 16px;"><thead><tr>';
    headers.forEach(function(header){
      html += '<th style="border:1px solid #94a3b8;background:#e2e8f0;text-align:left;padding:7px;font-weight:bold;">'+esc(header.label)+'</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function(row){
      html += '<tr>';
      headers.forEach(function(header){
        var value = typeof header.value === "function" ? header.value(row) : row[header.key];
        html += '<td style="border:1px solid #cbd5e1;padding:7px;vertical-align:top;">'+esc(value)+'</td>';
      });
      html += '</tr>';
    });
    return html + '</tbody></table>';
  }

  function textTable(headers,rows){
    rows = arr(rows);
    if(!rows.length){ return "Sin datos para mostrar."; }
    var lines = [
      headers.map(function(header){ return header.label; }).join(" | "),
      headers.map(function(){ return "---"; }).join(" | ")
    ];
    rows.forEach(function(row){
      lines.push(headers.map(function(header){
        var value = typeof header.value === "function" ? header.value(row) : row[header.key];
        return text(value).replace(/\s+/g," ");
      }).join(" | "));
    });
    return lines.join("\n");
  }

  function areaById(report,areaId){
    var found = null;
    arr(report && report.areas).some(function(area){
      if(area.id === areaId){ found = area; return true; }
      return false;
    });
    return found;
  }

  function processText(report){
    var type = report && report.periodType || {};
    return type.id === "PVC" || type.isPVC ? "proceso PVC" : "proceso de titulación";
  }

  function mailObject(kind,source,subject,html,plain,extra){
    source = source || {};
    var toList = recipients(source);
    var ccList = copies(source);
    return Object.assign({
      kind:kind,
      to:toList.join(", "),
      toList:toList,
      cc:ccList.join(", "),
      ccList:ccList,
      subject:subject,
      html:html,
      plain:plain
    },extra || {});
  }

  function buildGeneralCompliance(report){
    report = report || {};
    var global = report.global || {};
    var rows = arr(report.compliance || global.cumplimiento);
    var subject = "Reporte general de cumplimiento de requisitos - " + periodLabel(report);
    var headers = [
      {label:"Requisito",value:function(row){ return row.label; }},
      {label:"Total",value:function(row){ return fmt(row.total); }},
      {label:"Cumplen",value:function(row){ return fmt(row.cumplen); }},
      {label:"No cumplen",value:function(row){ return fmt(row.noCumplen); }},
      {label:"% cumplen",value:function(row){ return Number(row.porcentaje || 0).toFixed(1) + "%"; }}
    ];
    var careerLine = careerLabel(report) ? '<br><strong>Carrera:</strong> '+esc(careerLabel(report)) : "";
    var body = paragraph('<strong>'+esc(global.saludo || "Estimados coordinadores de área")+':</strong>')
      + paragraph('Reciban un cordial saludo.')
      + paragraph('Por medio del presente, remito el reporte general del estado de cumplimiento de requisitos correspondiente a los estudiantes del '+esc(processText(report))+' '+esc(periodLabel(report))+'.')
      + paragraph('Es necesario que cada área revise y gestione de manera prioritaria los casos pendientes, a fin de regularizar la situación de los estudiantes dentro del proceso de titulación.')
      + paragraph('<strong>Período:</strong> '+esc(periodLabel(report))+'<br><strong>División:</strong> '+esc(divisionLabel(report))+careerLine+'<br><strong>Total de estudiantes evaluados:</strong> '+fmt(global.totalEstudiantesRevisados))
      + paragraph('El reporte presenta el siguiente resumen por requisito:')
      + tableHtml(headers,rows)
      + paragraph('Se solicita a cada área realizar el seguimiento respectivo a los estudiantes que aún mantienen requisitos pendientes, considerando que esta información es necesaria para la continuidad y cierre adecuado del proceso de titulación.')
      + paragraph('Agradezco de antemano su colaboración y gestión oportuna.')
      + signatureHtml();

    var plain = [
      (global.saludo || "Estimados coordinadores de área") + ":","","Reciban un cordial saludo.","",
      "Por medio del presente, remito el reporte general del estado de cumplimiento de requisitos correspondiente a los estudiantes del " + processText(report) + " " + periodLabel(report) + ".","",
      "Es necesario que cada área revise y gestione de manera prioritaria los casos pendientes, a fin de regularizar la situación de los estudiantes dentro del proceso de titulación.","",
      "Período: " + periodLabel(report),
      "División: " + divisionLabel(report)
    ];
    if(careerLabel(report)){ plain.push("Carrera: " + careerLabel(report)); }
    plain = plain.concat([
      "Total de estudiantes evaluados: " + fmt(global.totalEstudiantesRevisados),"",
      "El reporte presenta el siguiente resumen por requisito:","",textTable(headers,rows),"",
      "Se solicita a cada área realizar el seguimiento respectivo a los estudiantes que aún mantienen requisitos pendientes, considerando que esta información es necesaria para la continuidad y cierre adecuado del proceso de titulación.","",
      "Agradezco de antemano su colaboración y gestión oportuna.","",signaturePlain()
    ]);
    return mailObject("general",global,subject,wrapHtml(body),plain.join("\n"));
  }

  function studentListHtml(students){
    students = arr(students);
    if(!students.length){ return paragraph('<strong>No se registran estudiantes pendientes con los filtros seleccionados.</strong>'); }
    return '<ol style="margin:8px 0 16px;padding-left:24px;">' + students.map(function(student){
      return '<li style="margin-bottom:8px;"><strong>'+esc(student.nombre)+'</strong> - C.I.: '+esc(student.cedula)+' - Carrera: '+esc(student.carrera)+'</li>';
    }).join("") + '</ol>';
  }

  function studentListPlain(students){
    students = arr(students);
    if(!students.length){ return "No se registran estudiantes pendientes con los filtros seleccionados."; }
    return students.map(function(student,index){
      return (index + 1) + ". " + student.nombre + " - C.I.: " + student.cedula + " - Carrera: " + student.carrera;
    }).join("\n");
  }

  function buildRequirementPending(report,areaId){
    var area = areaById(report,areaId);
    if(!area){ throw new Error("No se encontró el área seleccionada."); }
    var reqLabel = requirementLabel(report) || area.area;
    var subject = "Estudiantes pendientes de requisito " + reqLabel + " - " + periodLabel(report);
    var careerLine = careerLabel(report) ? '<br><strong>Carrera:</strong> '+esc(careerLabel(report)) : "";
    var body = paragraph('<strong>'+esc(area.tratamiento || ("Estimado/a " + (area.responsable || area.area)))+':</strong>')
      + paragraph('Reciba un cordial saludo.')
      + paragraph('Por medio del presente, se remite el listado de estudiantes que aún registran pendiente el cumplimiento del requisito correspondiente a su área.')
      + paragraph('<strong>Período:</strong> '+esc(periodLabel(report))+'<br><strong>División:</strong> '+esc(divisionLabel(report))+careerLine+'<br><strong>Requisito pendiente:</strong> '+esc(reqLabel)+'<br><strong>Total de estudiantes pendientes:</strong> '+fmt(area.totalEstudiantes))
      + paragraph('<strong>Detalle de estudiantes:</strong>')
      + studentListHtml(area.estudiantes)
      + paragraph('Agradezco su gentil ayuda con la revisión y gestión correspondiente, con la finalidad de que los estudiantes puedan completar sus requisitos dentro de los tiempos establecidos para el proceso de titulación.')
      + signatureHtml();

    var plain = [
      (area.tratamiento || ("Estimado/a " + (area.responsable || area.area))) + ":","","Reciba un cordial saludo.","",
      "Por medio del presente, se remite el listado de estudiantes que aún registran pendiente el cumplimiento del requisito correspondiente a su área.","",
      "Período: " + periodLabel(report),
      "División: " + divisionLabel(report)
    ];
    if(careerLabel(report)){ plain.push("Carrera: " + careerLabel(report)); }
    plain = plain.concat([
      "Requisito pendiente: " + reqLabel,
      "Total de estudiantes pendientes: " + fmt(area.totalEstudiantes),"",
      "Detalle de estudiantes:","",studentListPlain(area.estudiantes),"",
      "Agradezco su gentil ayuda con la revisión y gestión correspondiente, con la finalidad de que los estudiantes puedan completar sus requisitos dentro de los tiempos establecidos para el proceso de titulación.","",
      signaturePlain()
    ]);
    return mailObject("requirement",area,subject,wrapHtml(body),plain.join("\n"),{areaId:areaId});
  }

  function eligibilityListHtml(students){
    students = arr(students);
    if(!students.length){ return paragraph('<strong>No se registran estudiantes pendientes en esta sección.</strong>'); }
    return '<ol style="margin:8px 0 16px;padding-left:24px;">' + students.map(function(student){
      return '<li style="margin-bottom:10px;"><strong>'+esc(student.nombre)+'</strong> - C.I.: '+esc(student.cedula)+' - Carrera: '+esc(student.carrera)+'<br><span><strong>Modalidad:</strong> '+esc(student.modalidad)+'<br><strong>Requisitos pendientes:</strong> '+esc(student.requisitosTexto)+'</span></li>';
    }).join("") + '</ol>';
  }

  function eligibilityListPlain(students){
    students = arr(students);
    if(!students.length){ return "No se registran estudiantes pendientes en esta sección."; }
    return students.map(function(student,index){
      return (index + 1) + ". " + student.nombre + " - C.I.: " + student.cedula + " - Carrera: " + student.carrera
        + "\n   Modalidad: " + student.modalidad
        + "\n   Requisitos pendientes: " + student.requisitosTexto;
    }).join("\n");
  }

  function buildEligibility(report){
    report = report || {};
    var source = window.COOConfig && window.COOConfig.eligibility || report.global || {};
    var info = report.eligibility || {defensa:[],nucleos:[],totalDefensa:0,totalNucleos:0,totalEstudiantes:0};
    var subject = "Estudiantes pendientes para defensa o núcleos - " + periodLabel(report);
    var careerLine = careerLabel(report) ? '<br><strong>Carrera:</strong> '+esc(careerLabel(report)) : "";
    var body = paragraph('<strong>'+esc(source.saludo || "Estimados coordinadores de área")+':</strong>')
      + paragraph('Reciban un cordial saludo.')
      + paragraph('Por medio del presente, remito el reporte de estudiantes que aún mantienen requisitos pendientes para continuar hacia la defensa o los núcleos del proceso de titulación.')
      + paragraph('<strong>Período:</strong> '+esc(periodLabel(report))+'<br><strong>División:</strong> '+esc(divisionLabel(report))+careerLine+'<br><strong>Total de estudiantes pendientes:</strong> '+fmt(info.totalEstudiantes))
      + '<h3 style="margin:18px 0 8px;color:#1e3a8a;font-size:15px;">Pendientes para defensa ('+fmt(info.totalDefensa)+')</h3>'
      + eligibilityListHtml(info.defensa)
      + '<h3 style="margin:18px 0 8px;color:#1e3a8a;font-size:15px;">Pendientes para núcleos ('+fmt(info.totalNucleos)+')</h3>'
      + eligibilityListHtml(info.nucleos)
      + paragraph('Se solicita realizar el seguimiento correspondiente para que los estudiantes regularicen sus requisitos y puedan continuar con la siguiente etapa del proceso de titulación.')
      + paragraph('Agradezco de antemano su colaboración y gestión oportuna.')
      + signatureHtml();

    var plain = [
      (source.saludo || "Estimados coordinadores de área") + ":","","Reciban un cordial saludo.","",
      "Por medio del presente, remito el reporte de estudiantes que aún mantienen requisitos pendientes para continuar hacia la defensa o los núcleos del proceso de titulación.","",
      "Período: " + periodLabel(report),
      "División: " + divisionLabel(report)
    ];
    if(careerLabel(report)){ plain.push("Carrera: " + careerLabel(report)); }
    plain = plain.concat([
      "Total de estudiantes pendientes: " + fmt(info.totalEstudiantes),"",
      "PENDIENTES PARA DEFENSA (" + fmt(info.totalDefensa) + ")","",eligibilityListPlain(info.defensa),"",
      "PENDIENTES PARA NÚCLEOS (" + fmt(info.totalNucleos) + ")","",eligibilityListPlain(info.nucleos),"",
      "Se solicita realizar el seguimiento correspondiente para que los estudiantes regularicen sus requisitos y puedan continuar con la siguiente etapa del proceso de titulación.","",
      "Agradezco de antemano su colaboración y gestión oportuna.","",signaturePlain()
    ]);
    return mailObject("eligibility",source,subject,wrapHtml(body),plain.join("\n"));
  }

  function buildAreaSummary(report,areaId){ return buildRequirementPending(report,areaId); }
  function buildAreaDetail(report,areaId){ return buildRequirementPending(report,areaId); }
  function buildGlobal(report){ return buildGeneralCompliance(report); }

  function build(report,options){
    options = options || {};
    if(options.kind === "global" || options.kind === "general"){ return buildGeneralCompliance(report); }
    if(options.kind === "area-summary" || options.kind === "area-detail" || options.kind === "requirement"){
      return buildRequirementPending(report,options.areaId);
    }
    if(options.kind === "eligibility"){ return buildEligibility(report); }
    throw new Error("Tipo de correo no reconocido.");
  }

  function composeData(mail){
    mail = mail || {};
    var toList = uniqueAddresses(arr(mail.toList).concat([mail.to || ""]));
    var ccList = uniqueAddresses(arr(mail.ccList).concat([mail.cc || ""]));
    return {
      to:toList.join(";"),
      cc:ccList.join(";"),
      subject:text(mail.subject).replace(/[\r\n]+/g," "),
      body:text(mail.plain).replace(/\r\n/g,"\n").replace(/\r/g,"\n")
    };
  }

  function outlookWebUrl(mail){
    var data = composeData(mail);
    if(!data.to){ throw new Error("No hay destinatarios configurados para este correo."); }
    var query = ["to=" + encodeURIComponent(data.to)];
    if(data.cc){ query.push("cc=" + encodeURIComponent(data.cc)); }
    if(data.subject){ query.push("subject=" + encodeURIComponent(data.subject)); }
    query.push("body=" + encodeURIComponent(data.body));
    var url = OUTLOOK_COMPOSE_URL + "?" + query.join("&");
    if(url.length > MAX_OUTLOOK_URL_LENGTH){
      throw new Error("El correo es demasiado extenso para abrirlo automáticamente en Outlook Web.");
    }
    return url;
  }

  function openWithAnchor(url){
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(function(){
      try{ anchor.remove(); }catch(error){}
    },0);
    return {ok:true,opened:true,method:"outlook-web-anchor",urlLength:url.length};
  }

  function normalizeOpenResult(result,url){
    if(result === true){ return {ok:true,opened:true,method:"outlook-web-ipc",urlLength:url.length}; }
    if(result && typeof result === "object" && result.ok === true && result.opened !== false){
      return Object.assign({},result,{ok:true,opened:true,method:result.method || "outlook-web-ipc",urlLength:url.length});
    }
    throw new Error(text(result && (result.error || result.message)) || "No se pudo abrir Outlook Web.");
  }

  function electronApi(){
    try{
      if(window.top && window.top.electronAPI && typeof window.top.electronAPI.openExternal === "function"){
        return window.top.electronAPI;
      }
    }catch(error){}
    return window.electronAPI || null;
  }

  function open(mail){
    var url;
    try{ url = outlookWebUrl(mail); }
    catch(error){ return Promise.reject(error); }

    var api = electronApi();
    if(api && typeof api.openExternal === "function"){
      return Promise.resolve(api.openExternal(url)).then(function(result){
        return normalizeOpenResult(result,url);
      }).catch(function(error){
        console.warn("[COOMail] La apertura IPC no estuvo disponible; se usará el enlace externo.",error);
        return openWithAnchor(url);
      });
    }

    return Promise.resolve(openWithAnchor(url));
  }

  window.COOMail = {
    version:VERSION,
    build:build,
    buildGlobal:buildGlobal,
    buildGeneralCompliance:buildGeneralCompliance,
    buildAreaSummary:buildAreaSummary,
    buildAreaDetail:buildAreaDetail,
    buildRequirementPending:buildRequirementPending,
    buildEligibility:buildEligibility,
    open:open,
    outlookWebUrl:outlookWebUrl,
    helpers:{
      esc:esc,
      fmt:fmt,
      tableHtml:tableHtml,
      textTable:textTable,
      composeData:composeData,
      recipients:recipients,
      copies:copies
    }
  };
})(window,document);
