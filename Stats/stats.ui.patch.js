/* =========================================================
Nombre completo: stats.ui.patch.js
Ruta: /Stats/stats.ui.patch.js
Función:
- Crear la sección Telegram con cobertura, carreras y estudiantes pendientes.
- Mostrar gráficos en Aprobación final.
- Separar Telegram dentro del selector de requisitos.
- Ocultar automáticamente los avisos verdes de éxito.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-telegram-final-status";
  var scheduled=false;
  var statusTimer=null;

  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function pct(value,total){return total?Math.round((Number(value||0)*10000)/Number(total||0))/100:0;}
  function el(id){return document.getElementById(id);}
  function rowsOf(data){
    if(data&&data.selectedRequirement&&Array.isArray(data.selectedRequirement.rows)){return data.selectedRequirement.rows;}
    if(data&&Array.isArray(data.rows)){return data.rows;}
    if(data&&Array.isArray(data.estudiantes)){return data.estudiantes;}
    return [];
  }
  function nameOf(row){return text(row&&row._nombres)||text(row&&row.Nombres)||text(row&&row.nombres)||"Sin nombre";}
  function idOf(row){return text(row&&row._cedula)||text(row&&row.cedula)||text(row&&row.numeroIdentificacion)||"";}
  function careerOf(row){return text(row&&row._carrera)||text(row&&row.NombreCarrera)||text(row&&row.carrera)||"SIN CARRERA";}
  function phoneOf(row){return text(row&&row._celular)||text(row&&row.celular)||text(row&&row.Celular)||text(row&&row.telefono)||text(row&&row.whatsapp)||"";}
  function hasTelegram(row){
    if(row&&typeof row._hasTelegram==="boolean"){return row._hasTelegram;}
    return !!text(row&&row._telegramUser||row&&row.telegramUser||row&&row.usuarioTelegram||row&&row.telegram||row&&row._telegramChatId||row&&row.telegramChatId||row&&row.chatIdTelegram||row&&row.chatId);
  }
  function whatsappNumber(value){
    var digits=text(value).replace(/\D/g,"");
    if(!digits){return "";}
    if(digits.indexOf("593")===0){return digits;}
    if(digits.charAt(0)==="0"){return "593"+digits.slice(1);}
    return digits;
  }
  function whatsapp(row){
    var number=whatsappNumber(phoneOf(row));
    if(!number){return '<span class="student-status-na">Sin celular</span>';}
    var message="Estimado/a "+nameOf(row)+", por favor ingrese a la plataforma de titulación y vincule su usuario o Chat ID de Telegram para completar su información.";
    return '<a class="stats-whatsapp-link" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+encodeURIComponent(number)+'?text='+encodeURIComponent(message)+'">WhatsApp</a>';
  }

  function patchTelegramOption(){
    var core=window.StatsCore;
    if(!core||typeof core.resumen!=="function"||core.__telegramOptionPatched){return false;}
    var original=core.resumen;
    core.resumen=function(){
      var data=original.apply(core,arguments)||{};
      data.requisitosFiltro=data.requisitosFiltro||{};
      var finals=Array.isArray(data.requisitosFiltro.finales)?data.requisitosFiltro.finales.slice():[];
      if(!finals.some(function(item){return text(item&&item.key)==="telegram";})){
        finals.push({key:"telegram",label:"Telegram",group:"telegram"});
      }
      data.requisitosFiltro.finales=finals;
      return data;
    };
    core.__telegramOptionPatched=true;
    return true;
  }

  function organizeRequirementSelect(){
    var select=el("stats-requisito");
    if(!select){return;}
    var telegramOption=Array.prototype.slice.call(select.querySelectorAll("option")).find(function(option){return option.value==="telegram";});
    if(!telegramOption){return;}
    var group=select.querySelector('optgroup[label="Telegram"]');
    if(!group){
      group=document.createElement("optgroup");
      group.label="Telegram";
      select.appendChild(group);
    }
    group.appendChild(telegramOption);
  }

  function currentData(){
    if(!window.StatsApp||typeof window.StatsApp.getState!=="function"){return null;}
    var state=window.StatsApp.getState()||{};
    return state.data||null;
  }
  function buildTelegram(rows){
    var byCareer=Object.create(null);
    var withTelegram=[];
    var withoutTelegram=[];
    rows.forEach(function(row){
      var career=careerOf(row);
      if(!byCareer[career]){byCareer[career]={carrera:career,total:0,con:0,sin:0,cobertura:0};}
      byCareer[career].total+=1;
      if(hasTelegram(row)){byCareer[career].con+=1;withTelegram.push(row);}
      else{byCareer[career].sin+=1;withoutTelegram.push(row);}
    });
    var careers=Object.keys(byCareer).map(function(key){var item=byCareer[key];item.cobertura=pct(item.con,item.total);return item;}).sort(function(a,b){return b.total-a.total||a.carrera.localeCompare(b.carrera,"es");});
    return {total:rows.length,con:withTelegram.length,sin:withoutTelegram.length,cobertura:pct(withTelegram.length,rows.length),careers:careers,missing:withoutTelegram};
  }
  function telegramCareerTable(rows){
    if(!rows.length){return '<div class="empty">Sin carreras para mostrar.</div>';}
    return '<div class="stats-table-wrap"><table><thead><tr><th>Carrera</th><th>Total</th><th>Con Telegram</th><th>Sin Telegram</th><th>Cobertura</th></tr></thead><tbody>'
      + rows.map(function(row){return '<tr><td><strong>'+esc(row.carrera)+'</strong></td><td>'+row.total+'</td><td><span class="pill pill-ok">'+row.con+'</span></td><td><span class="pill pill-bad">'+row.sin+'</span></td><td>'+row.cobertura+'%</td></tr>';}).join("")
      + '</tbody></table></div>';
  }
  function telegramMissingTable(rows){
    if(!rows.length){return '<div class="empty">Todos los estudiantes filtrados tienen Telegram.</div>';}
    return '<div class="stats-table-wrap"><table><thead><tr><th>#</th><th>Estudiante</th><th>Cédula</th><th>Carrera</th><th>Acción</th></tr></thead><tbody>'
      + rows.map(function(row,index){return '<tr><td>'+(index+1)+'</td><td><strong>'+esc(nameOf(row))+'</strong></td><td>'+esc(idOf(row))+'</td><td>'+esc(careerOf(row))+'</td><td>'+whatsapp(row)+'</td></tr>';}).join("")
      + '</tbody></table></div>';
  }
  function renderTelegram(data){
    var target=el("stats-telegram");
    if(!target){return;}
    if(!data||data._requiresPeriod){target.innerHTML='<div class="empty">Selecciona un período para revisar Telegram.</div>';return;}
    var result=buildTelegram(rowsOf(data));
    var okWidth=result.total?pct(result.con,result.total):0;
    var badWidth=result.total?pct(result.sin,result.total):0;
    target.innerHTML='<section class="stats-telegram-dashboard">'
      + '<div class="stats-telegram-kpis">'
      + '<article><span>Total</span><strong>'+result.total+'</strong></article>'
      + '<article class="is-ok"><span>Con Telegram</span><strong>'+result.con+'</strong></article>'
      + '<article class="is-bad"><span>Sin Telegram</span><strong>'+result.sin+'</strong></article>'
      + '<article><span>Cobertura</span><strong>'+result.cobertura+'%</strong></article>'
      + '</div>'
      + '<article class="stats-telegram-panel"><h3>Cobertura de Telegram</h3><div class="stats-telegram-progress"><span class="ok" style="width:'+okWidth+'%"></span><span class="bad" style="width:'+badWidth+'%"></span></div><div class="stats-chart-legend"><span><i class="ok"></i>Con Telegram '+okWidth+'%</span><span><i class="bad"></i>Sin Telegram '+badWidth+'%</span></div></article>'
      + '<div class="stats-telegram-grid">'
      + '<article class="stats-telegram-panel"><h3>Telegram por carrera</h3>'+telegramCareerTable(result.careers)+'</article>'
      + '<article class="stats-telegram-panel"><h3>Estudiantes sin Telegram</h3>'+telegramMissingTable(result.missing)+'</article>'
      + '</div>'
      + '</section>';
  }
  function renderFinal(data){
    if(window.StatsCharts&&typeof window.StatsCharts.renderFinal==="function"){
      window.StatsCharts.renderFinal(data||{},"stats-final-charts");
    }
  }
  function autoHideStatus(){
    var node=el("stats-status");
    if(!node){return;}
    node.classList.remove("is-auto-hidden");
    if(statusTimer){clearTimeout(statusTimer);statusTimer=null;}
    if(node.classList.contains("ok")){
      statusTimer=setTimeout(function(){node.classList.add("is-auto-hidden");},3200);
    }
  }
  function renderAll(){
    organizeRequirementSelect();
    var data=currentData();
    if(data){renderTelegram(data);renderFinal(data);}
    autoHideStatus();
  }
  function schedule(){
    if(scheduled){return;}
    scheduled=true;
    setTimeout(function(){scheduled=false;renderAll();},0);
  }
  function bind(){
    patchTelegramOption();
    var status=el("stats-status");
    if(status&&typeof MutationObserver==="function"){
      new MutationObserver(schedule).observe(status,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["class"]});
    }
    var select=el("stats-requisito");
    if(select&&typeof MutationObserver==="function"){
      new MutationObserver(schedule).observe(select,{childList:true,subtree:true});
    }
    ["stats-periodo","stats-division","stats-matricula","stats-carrera","stats-estado","stats-requisito"].forEach(function(id){var node=el(id);if(node){node.addEventListener("change",schedule);}});
    window.addEventListener("stats:cache-invalidated",schedule);
    window.addEventListener("stats:data-ready",schedule);
    window.addEventListener("stats:data-updated",function(){
      if(window.StatsApp&&typeof window.StatsApp.refreshFromBDLocal==="function"){window.StatsApp.refreshFromBDLocal("stats:data-updated");}
      schedule();
    });
    window.addEventListener("bdlocal:conexiones-cache-updated",schedule);
    schedule();
  }

  window.StatsUIPatch={version:VERSION,render:renderAll,renderTelegram:renderTelegram,patchTelegramOption:patchTelegramOption};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind);}else{bind();}
})(window,document);
