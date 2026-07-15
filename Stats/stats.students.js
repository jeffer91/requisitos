/* =========================================================
Nombre completo: stats.students.js
Ruta o ubicación: /Requisitos/Stats/stats.students.js
Función o funciones:
- Renderizar estudiantes con numeración y controles visibles.
- Filtrar todos, completos o faltantes.
- Ordenar por nombre, carrera o cantidad de faltantes.
- Mostrar WhatsApp cuando se filtra Telegram y el estudiante no lo tiene.
========================================================= */
(function(window,document){
  "use strict";

  var DEFAULT_LIMIT=150;
  var SEARCH_LIMIT=250;
  var state={mode:"all",order:"name-asc",data:null,targetId:"stats-estudiantes",options:{}};

  function text(value){return String(value==null?"":value).trim();}
  function el(id){return document.getElementById(id);}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function lower(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es");}
  function empty(message){return '<div class="empty">'+esc(message||"Sin estudiantes para mostrar.")+'</div>';}
  function studentName(row){return text(row&&row._nombres)||text(row&&row._bl2Nombre)||text(row&&row.nombres)||text(row&&row.Nombres)||text(row&&row.nombre)||text(row&&row.Nombre)||text(row&&row.estudiante)||text(row&&row.Estudiante)||"Sin nombre";}
  function studentId(row){return text(row&&row._cedula)||text(row&&row._bl2Id)||text(row&&row.cedula)||text(row&&row.Cedula)||text(row&&row.numeroIdentificacion)||text(row&&row.numeroidentificacion)||text(row&&row.identificacion)||"";}
  function studentCareer(row){return text(row&&row._carrera)||text(row&&row._bl2Carrera)||text(row&&row.nombrecarrera)||text(row&&row.nombreCarrera)||text(row&&row.NombreCarrera)||text(row&&row.carrera)||"SIN CARRERA";}
  function phoneOf(row){return text(row&&row._celular)||text(row&&row.celular)||text(row&&row.Celular)||text(row&&row.telefono)||text(row&&row.Telefono)||text(row&&row.whatsapp)||"";}
  function hasTelegram(row){
    if(row&&typeof row._hasTelegram==="boolean"){return row._hasTelegram;}
    return !!text(row&&row._telegramUser||row&&row.telegramUser||row&&row.usuarioTelegram||row&&row.telegram||row&&row._telegramChatId||row&&row.telegramChatId||row&&row.chatIdTelegram||row&&row.chatId);
  }
  function selectedIsTelegram(data){return lower(data&&data.selectedRequirement&&data.selectedRequirement.key)==="telegram";}
  function requirementLabels(list){return (list||[]).map(function(item){return {key:text(item&&item.key),label:text(item&&item.label)||text(item&&item.key)};}).filter(function(item){return !!item.label;});}
  function missingFromRow(row){
    if(row&&row._selectedRequirementStatus){return row._selectedRequirementStatus.cumple||row._selectedRequirementStatus.status==="no_aplica"?[]:[{key:row._selectedRequirementStatus.key,label:row._selectedRequirementStatus.label||"No cumple"}];}
    if(row&&row._estado&&Array.isArray(row._estado.missingRequirements)){return requirementLabels(row._estado.missingRequirements);}
    if(row&&row._approval&&Array.isArray(row._approval.missingRequirements)){return requirementLabels(row._approval.missingRequirements);}
    if(window.StatsRules&&typeof window.StatsRules.missingRequirements==="function"){return requirementLabels(window.StatsRules.missingRequirements(row));}
    return [];
  }
  function isComplete(row,data){
    if(selectedIsTelegram(data)){return hasTelegram(row);}
    if(row&&row._selectedRequirementStatus){return !!row._selectedRequirementStatus.cumple;}
    return !!(row&&row._estado&&row._estado.id==="cumple");
  }
  function statusHtml(row,data){
    if(selectedIsTelegram(data)){
      return hasTelegram(row)?'<span class="student-status-ok">Con Telegram</span>':'<span class="student-status-bad">Sin Telegram</span>';
    }
    var selected=row&&row._selectedRequirementStatus;
    if(selected){
      if(selected.status==="no_aplica"){return '<span class="student-status-na">'+esc(selected.labelStatus||"No aplica")+'</span>';}
      if(selected.cumple){return '<span class="student-status-ok">Cumple</span>';}
      return '<span class="student-status-bad">'+esc(selected.label||"No cumple")+'</span>';
    }
    if(isComplete(row,data)){return '<span class="student-status-ok">Aprobado</span>';}
    var missing=missingFromRow(row);
    if(!missing.length){return '<span class="student-status-bad">No cumple</span>';}
    return '<div class="student-missing-list">'+missing.map(function(item){return '<span class="student-missing" data-key="'+esc(item.key)+'">'+esc(item.label)+'</span>';}).join(" ")+'</div>';
  }
  function statusSortValue(row,data){
    if(selectedIsTelegram(data)){return hasTelegram(row)?"1-con-telegram":"0-sin-telegram";}
    if(row&&row._selectedRequirementStatus){return row._selectedRequirementStatus.cumple?"1-cumple":"0-no-cumple";}
    var missing=missingFromRow(row).length;
    if(isComplete(row,data)){return "999-aprobado";}
    return String(missing).padStart(3,"0")+"-faltantes";
  }
  function normalizeRows(data){
    if(!data){return [];}
    if(data.selectedRequirement&&Array.isArray(data.selectedRequirement.rows)){return data.selectedRequirement.rows;}
    if(Array.isArray(data.estudiantes)){return data.estudiantes;}
    if(Array.isArray(data.rows)){return data.rows;}
    return [];
  }
  function filterSearch(rows,search){
    search=lower(search);
    if(!search){return rows||[];}
    return (rows||[]).filter(function(row){return lower(studentName(row)).indexOf(search)>=0||lower(studentId(row)).indexOf(search)>=0||lower(studentCareer(row)).indexOf(search)>=0;});
  }
  function filterMode(rows,data){
    if(state.mode==="complete"){return rows.filter(function(row){return isComplete(row,data);});}
    if(state.mode==="missing"){return rows.filter(function(row){return !isComplete(row,data);});}
    return rows;
  }
  function sortRows(rows,data){
    var output=rows.slice();
    output.sort(function(a,b){
      if(state.order==="career-asc"){return studentCareer(a).localeCompare(studentCareer(b),"es")||studentName(a).localeCompare(studentName(b),"es");}
      if(state.order==="missing-desc"){return missingFromRow(b).length-missingFromRow(a).length||studentName(a).localeCompare(studentName(b),"es");}
      if(state.order==="missing-asc"){return missingFromRow(a).length-missingFromRow(b).length||studentName(a).localeCompare(studentName(b),"es");}
      if(state.order==="status"){return statusSortValue(a,data).localeCompare(statusSortValue(b,data),"es")||studentName(a).localeCompare(studentName(b),"es");}
      return studentName(a).localeCompare(studentName(b),"es");
    });
    return output;
  }
  function whatsappNumber(value){
    var digits=text(value).replace(/\D/g,"");
    if(!digits){return "";}
    if(digits.indexOf("593")===0){return digits;}
    if(digits.charAt(0)==="0"){return "593"+digits.slice(1);}
    return digits;
  }
  function whatsappHtml(row,data){
    if(!selectedIsTelegram(data)||hasTelegram(row)){return "";}
    var number=whatsappNumber(phoneOf(row));
    if(!number){return '<span class="student-status-na">Sin celular</span>';}
    var message="Estimado/a "+studentName(row)+", por favor ingrese a la plataforma de titulación y vincule su usuario o Chat ID de Telegram para completar su información.";
    return '<a class="stats-whatsapp-link" href="https://wa.me/'+encodeURIComponent(number)+'?text='+encodeURIComponent(message)+'" target="_blank" rel="noopener noreferrer">WhatsApp</a>';
  }
  function controlsHtml(data){
    var telegram=selectedIsTelegram(data);
    var completeLabel=telegram?"Con Telegram":"Completos";
    var missingLabel=telegram?"Sin Telegram":"Con faltantes";
    return '<div class="stats-student-controls">'
      + '<div class="stats-student-mode">'
      + '<button type="button" data-student-mode="all" class="'+(state.mode==="all"?"is-active":"")+'">Todos</button>'
      + '<button type="button" data-student-mode="complete" class="'+(state.mode==="complete"?"is-active":"")+'">'+esc(completeLabel)+'</button>'
      + '<button type="button" data-student-mode="missing" class="'+(state.mode==="missing"?"is-active":"")+'">'+esc(missingLabel)+'</button>'
      + '</div>'
      + '<label class="stats-student-order">Ordenar<select data-student-order>'
      + '<option value="name-asc" '+(state.order==="name-asc"?"selected":"")+'>Nombre A-Z</option>'
      + '<option value="career-asc" '+(state.order==="career-asc"?"selected":"")+'>Carrera A-Z</option>'
      + '<option value="status" '+(state.order==="status"?"selected":"")+'>Estado</option>'
      + '<option value="missing-desc" '+(state.order==="missing-desc"?"selected":"")+'>Más faltantes primero</option>'
      + '<option value="missing-asc" '+(state.order==="missing-asc"?"selected":"")+'>Menos faltantes primero</option>'
      + '</select></label>'
      + '</div>';
  }
  function rowHtml(row,index,data){
    var name=studentName(row),id=studentId(row),career=studentCareer(row);
    var action=whatsappHtml(row,data);
    return '<tr>'
      + '<td data-sort="'+(index+1)+'">'+(index+1)+'</td>'
      + '<td data-sort="'+esc(lower(name))+'"><strong>'+esc(name)+'</strong></td>'
      + '<td data-sort="'+esc(id)+'">'+esc(id)+'</td>'
      + '<td data-sort="'+esc(lower(career))+'">'+esc(career)+'</td>'
      + '<td data-sort="'+esc(statusSortValue(row,data))+'">'+statusHtml(row,data)+'</td>'
      + (selectedIsTelegram(data)?'<td>'+action+'</td>':'')
      + '</tr>';
  }
  function tableHtml(rows,data){
    if(!rows.length){return empty("Sin estudiantes para los filtros seleccionados.");}
    return '<div class="stats-table-wrap"><table class="stats-sortable-table stats-students-table" data-sortable="true">'
      + '<thead><tr><th data-sort-type="number">#</th><th data-sort-type="text">Nombre</th><th data-sort-type="text">Cédula</th><th data-sort-type="text">Carrera</th><th data-sort-type="text">Estado</th>'
      + (selectedIsTelegram(data)?'<th>Acción</th>':'')
      + '</tr></thead>'
      + '<tbody>'+rows.map(function(row,index){return rowHtml(row,index,data);}).join("")+'</tbody>'
      + '</table></div>';
  }
  function bindControls(target){
    target.querySelectorAll("[data-student-mode]").forEach(function(button){
      button.addEventListener("click",function(){state.mode=button.getAttribute("data-student-mode")||"all";render(state.data,state.targetId,state.options);});
    });
    var order=target.querySelector("[data-student-order]");
    if(order){order.addEventListener("change",function(){state.order=order.value||"name-asc";render(state.data,state.targetId,state.options);});}
  }
  function render(data,targetId,options){
    var target=el(targetId||"stats-estudiantes");
    var meta=el("stats-estudiantes-meta");
    if(!target){return;}
    options=options||{};
    state.data=data;
    state.targetId=targetId||"stats-estudiantes";
    state.options=Object.assign({},options);

    if(data&&data._requiresPeriod){target.innerHTML=empty("Selecciona un período para cargar la tabla de estudiantes.");if(meta){meta.textContent="0 estudiantes";}return;}

    var allRows=normalizeRows(data);
    var search=options.search!==undefined?options.search:(data&&data.studentSearch);
    var filtered=filterSearch(allRows,search);
    filtered=filterMode(filtered,data);
    filtered=sortRows(filtered,data);
    var limit=Number(options.limit||data&&data.studentDisplayLimit||DEFAULT_LIMIT)||DEFAULT_LIMIT;
    if(search){limit=Math.max(limit,SEARCH_LIMIT);}
    var visible=filtered.slice(0,limit);
    target.innerHTML=controlsHtml(data)+tableHtml(visible,data);
    bindControls(target);

    if(meta){
      if(search){meta.textContent="Mostrando "+visible.length+" de "+filtered.length+" coincidencias · Total filtrado: "+allRows.length;}
      else if(filtered.length>visible.length){meta.textContent="Mostrando "+visible.length+" de "+filtered.length+" estudiantes";}
      else{meta.textContent=filtered.length+" estudiantes";}
    }
    if(window.StatsTables&&typeof window.StatsTables.bindAll==="function"){window.StatsTables.bindAll(target);}
  }

  window.StatsStudents={render:render,tableHtml:tableHtml,normalizeRows:normalizeRows,filterRows:filterSearch,helpers:{studentName:studentName,studentId:studentId,studentCareer:studentCareer,missingFromRow:missingFromRow,statusHtml:statusHtml,hasTelegram:hasTelegram}};
})(window,document);
