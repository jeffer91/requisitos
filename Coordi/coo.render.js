/* =========================================================
Nombre completo: coo.render.js
Ruta o ubicación: /Requisitos/Coordi/coo.render.js
Función o funciones:
- Mantener la pantalla compacta actual de Coordi.
- Mostrar correo general, correo por requisito o correo de defensa/núcleos.
- Mostrar WhatsApp únicamente para un requisito específico.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "4.0.0-three-communication-modes";

  function el(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function fmt(value){ return Number(value || 0).toLocaleString("es-EC"); }
  function setText(id,value){ var node = el(id); if(node){ node.textContent = text(value); } }
  function setHTML(id,value){ var node = el(id); if(node){ node.innerHTML = value || ""; } }
  function setHidden(id,hidden){ var node = el(id); if(node){ node.hidden = !!hidden; } }
  function eligibilityKey(report){ return text(report && report.specialKeys && report.specialKeys.eligibility) || text(window.COOConfig && window.COOConfig.specials && window.COOConfig.specials.eligibilityKey); }
  function isEligibility(report,key){ return !!key && text(key) === eligibilityKey(report); }

  function option(value,label,selected){ return '<option value="'+esc(value)+'" '+(selected ? 'selected' : '')+'>'+esc(label || value)+'</option>'; }
  function fillSelect(id,emptyLabel,list,current,valueFn,labelFn){
    var node = el(id);
    if(!node){ return; }
    node.innerHTML = option("",emptyLabel,!current) + arr(list).map(function(item){
      var value = valueFn ? valueFn(item) : item;
      var label = labelFn ? labelFn(item) : item;
      return option(value,label,text(current) === text(value));
    }).join("");
    node.value = current || "";
  }

  function fillFilters(report,state){
    fillSelect("coordi-periodo","Seleccione período",report.periodList,state.periodId,function(period){ return period.id || period.value || period.label; },function(period){ return period.label || period.periodoLabel || period.id; });
    fillSelect("coordi-division","Todas",report.divisionList,state.division);
    fillSelect("coordi-carrera","Todas",report.careerList,state.career);
    fillSelect("coordi-requisito","Todos los requisitos",report.requirementList,state.requirementKey,function(item){ return item.key || item.value || item.label; },function(item){ return item.label || item.key; });
  }

  function totalCareers(report){
    var map = Object.create(null);
    arr(report && report.areasConPendientes).forEach(function(area){ arr(area.carreras).forEach(function(career){ map[career] = true; }); });
    return Object.keys(map).length;
  }

  function renderKpis(report,state){
    var global = report.global || {};
    var visible = !!state.periodId;
    setHidden("coordi-summary",!visible);
    if(!visible){ return; }
    if(isEligibility(report,state.requirementKey)){
      var eligibility = report.eligibility || {};
      setText("coordi-total",fmt(global.totalEstudiantesRevisados));
      setText("coordi-alta",fmt(eligibility.totalEstudiantes));
      setText("coordi-media",fmt((eligibility.totalDefensa ? 1 : 0) + (eligibility.totalNucleos ? 1 : 0)));
      setText("coordi-baja",fmt(eligibility.totalPendientes));
      setText("coordi-carreras-total",fmt(totalCareers(report)));
      return;
    }
    setText("coordi-total",fmt(global.totalEstudiantesRevisados));
    setText("coordi-alta",fmt(global.totalEstudiantesPendientes));
    setText("coordi-media",fmt(global.totalAreasConPendientes));
    setText("coordi-baja",fmt(global.totalPendientes));
    setText("coordi-carreras-total",fmt(totalCareers(report)));
  }

  function areaById(report,areaId){
    var found = null;
    arr(report && report.areas).some(function(area){ if(area.id === areaId){ found = area; return true; } return false; });
    return found;
  }

  function areaForRequirement(report,requirementKey){
    if(isEligibility(report,requirementKey)){ return null; }
    var areaId = "";
    try{
      if(window.COOConfig && window.COOConfig.helpers && typeof window.COOConfig.helpers.areaIdForRequirement === "function"){
        areaId = window.COOConfig.helpers.areaIdForRequirement(requirementKey) || "";
      }
    }catch(error){}
    return areaById(report,areaId);
  }

  function buildCommunication(report,state){
    var result = {mail:null,whatsapp:null,area:null,mode:"none"};
    if(!state.periodId){ return result; }
    if(isEligibility(report,state.requirementKey)){
      result.mode = "eligibility";
      if(window.COOMail){ result.mail = window.COOMail.build(report,{kind:"eligibility"}); }
      return result;
    }
    if(state.requirementKey){
      result.area = areaForRequirement(report,state.requirementKey);
      result.mode = "requirement";
      if(result.area && window.COOMail){ result.mail = window.COOMail.build(report,{kind:"requirement",areaId:result.area.id}); }
      if(result.area && window.COOWhatsApp){ result.whatsapp = window.COOWhatsApp.build(report,{kind:"area",areaId:result.area.id}); }
      return result;
    }
    result.mode = "general";
    if(window.COOMail){ result.mail = window.COOMail.build(report,{kind:"general"}); }
    return result;
  }

  function recipientContact(mail,fallback){
    var parts = [];
    if(mail && mail.to){ parts.push(mail.to); }
    if(mail && mail.cc){ parts.push("CC: " + mail.cc); }
    return parts.join(" · ") || fallback || "";
  }

  function renderCommunication(report,state){
    var communication = buildCommunication(report,state);
    state.currentMail = communication.mail;
    state.currentWhatsApp = communication.whatsapp;
    setHidden("coordi-empty",!!state.periodId);
    setHidden("coordi-communication",!state.periodId);
    if(!state.periodId){ return; }

    var mailButton = el("coordi-open-mail");
    var whatsappButton = el("coordi-open-whatsapp");
    var previewGrid = document.querySelector(".coordi-preview-grid");
    var mail = communication.mail;
    var whatsapp = communication.whatsapp;

    if(communication.mode === "general"){
      setText("coordi-communication-title","Correo general de cumplimiento");
      setText("coordi-communication-subtitle","Resumen de cumplimiento de todos los requisitos del corte seleccionado.");
      setText("coordi-recipient-name",report.global && report.global.responsable || "Coordinadores de área");
      setText("coordi-recipient-contact",recipientContact(mail,report.global && report.global.correo));
      setHidden("coordi-whatsapp-wrap",true);
      if(previewGrid){ previewGrid.classList.remove("with-whatsapp"); }
    }else if(communication.mode === "eligibility"){
      setText("coordi-communication-title","Pendientes para defensa o núcleos");
      setText("coordi-communication-subtitle","Estudiantes que todavía no pueden continuar a la siguiente etapa.");
      setText("coordi-recipient-name",window.COOConfig && window.COOConfig.eligibility && window.COOConfig.eligibility.responsable || "Coordinadores de área");
      setText("coordi-recipient-contact",recipientContact(mail,""));
      setHidden("coordi-whatsapp-wrap",true);
      if(previewGrid){ previewGrid.classList.remove("with-whatsapp"); }
    }else if(communication.area){
      setText("coordi-communication-title","Pendientes · " + communication.area.area);
      setText("coordi-communication-subtitle","Correo y WhatsApp preparados para el requisito seleccionado.");
      setText("coordi-recipient-name",communication.area.responsable || communication.area.area);
      setText("coordi-recipient-contact",recipientContact(mail,[communication.area.correo,communication.area.whatsapp].filter(Boolean).join(" · ")));
      setHidden("coordi-whatsapp-wrap",false);
      if(previewGrid){ previewGrid.classList.add("with-whatsapp"); }
      setText("coordi-whatsapp-preview",whatsapp && whatsapp.text || "No hay mensaje de WhatsApp disponible.");
    }else{
      setText("coordi-communication-title","Comunicación no disponible");
      setText("coordi-communication-subtitle","No se encontró un responsable para el requisito seleccionado.");
      setText("coordi-recipient-name","");
      setText("coordi-recipient-contact","");
      setHidden("coordi-whatsapp-wrap",true);
      if(previewGrid){ previewGrid.classList.remove("with-whatsapp"); }
    }

    setText("coordi-mail-subject",mail && mail.subject || "Correo no disponible");
    setHTML("coordi-email-preview",mail && mail.html || '<div class="coordi-empty-mail">No existe un correo preparado para este filtro.</div>');
    if(mailButton){ mailButton.hidden = !mail; mailButton.disabled = !mail || !mail.to; }
    if(whatsappButton){ whatsappButton.hidden = communication.mode !== "requirement"; whatsappButton.disabled = !whatsapp || !whatsapp.to; }
  }

  function renderAll(report,state){
    state = state || {};
    fillFilters(report,state);
    renderKpis(report,state);
    renderCommunication(report,state);
  }

  window.COORender = {
    version:VERSION,
    renderAll:renderAll,
    renderCommunication:renderCommunication,
    buildCommunication:buildCommunication,
    areaById:areaById,
    areaForRequirement:areaForRequirement,
    helpers:{esc:esc,fmt:fmt,isEligibility:isEligibility}
  };
})(window,document);
