/* =========================================================
Nombre completo: defart.ui-fix.js
Ruta o ubicación: /defart/defart.ui-fix.js
Función o funciones:
- Evitar estados contradictorios entre Cargando y Listo.
- Mostrar un único estado claro durante consultas y filtros.
- Quitar completamente la acción heredada Limpiar filtros.
- Mantener la tabla estable mientras se actualiza la interfaz.
- Diferenciar período vacío de filtros sin coincidencias.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-filter-aware-empty-state";
  var installed=false;
  var originalRender=null;
  var syncTimer=null;

  function text(value){return String(value==null?"":value).trim();}
  function el(id){return document.getElementById(id);}

  function appState(){
    try{
      return window.DefartApp&&typeof window.DefartApp.getState==="function"
        ? window.DefartApp.getState()||{}
        : {};
    }catch(error){return {};}
  }

  function removeClearButton(){
    var button=el("def-btn-clear");
    if(button&&button.parentNode){button.parentNode.removeChild(button);}
  }

  function loadingMessage(state){
    var data=state.data||{};
    var diagnostics=data.diagnostics||{};
    if(diagnostics.loading===true){return "Cargando estudiantes, requisitos y notas...";}
    if(!state.data){return "Preparando Defensas...";}
    return "";
  }

  function hasDetailedFilters(state){
    return !!(
      text(state.division)||
      text(state.career)||
      text(state.status)||
      text(state.sede)||
      text(state.search)
    );
  }

  function emptyMessage(state){
    if(hasDetailedFilters(state)){
      return "No hay estudiantes que coincidan con los filtros seleccionados.";
    }
    if(text(state.periodId)){
      return "No hay estudiantes activos para el período seleccionado.";
    }
    return "No hay estudiantes activos disponibles.";
  }

  function setStatus(message,kind){
    var box=el("def-status");
    if(!box){return;}
    box.textContent=message||"";
    box.className="def-status "+(kind||"");
    box.style.display=message?"block":"none";
  }

  function setSummaryClass(node,name,enabled){
    if(node&&node.classList){node.classList.toggle(name,!!enabled);}
  }

  function syncUi(){
    removeClearButton();

    var state=appState();
    var data=state.data||{};
    var rows=Array.isArray(data.rows)?data.rows:[];
    var diagnostics=data.diagnostics||{};
    var loading=diagnostics.loading===true||!state.data;
    var error=diagnostics.ok===false;
    var pending=Object.keys(state.changes||{}).length;
    var visible=el("def-visible-count");
    var save=el("def-save-state");
    var empty=document.querySelector("#def-table-wrap .def-empty");
    var statusBox=el("def-status");
    var currentStatus=text(statusBox&&statusBox.textContent);

    setSummaryClass(visible,"is-loading",loading);
    setSummaryClass(save,"is-loading",loading);
    setSummaryClass(visible,"is-empty",!loading&&!error&&!rows.length);
    setSummaryClass(save,"is-empty",!loading&&!error&&!rows.length);

    if(loading){
      if(visible){visible.textContent="Cargando datos...";}
      if(save){save.textContent="Cargando...";}
      if(empty){empty.textContent="Cargando estudiantes...";}
      setStatus(loadingMessage(state),"is-info");
      return;
    }

    if(error){
      if(visible){visible.textContent="0 resultados";}
      if(save){save.textContent="Error de carga";}
      if(empty){empty.textContent="No se pudieron cargar los estudiantes.";}
      return;
    }

    if(!rows.length){
      var message=emptyMessage(state);
      if(visible){visible.textContent="0 resultados";}
      if(save){save.textContent="Sin coincidencias";}
      if(empty){empty.textContent=message;}

      if(!currentStatus||/cargando|conectando|preparando|no hay estudiantes/i.test(currentStatus)){
        setStatus(message,"is-empty");
      }
      return;
    }

    if(save&&!state.saving&&!pending){save.textContent="Listo";}

    if(statusBox&&/cargando|conectando|preparando|no hay estudiantes/i.test(currentStatus)){
      setStatus("","");
    }
  }

  function scheduleSync(){
    if(syncTimer){window.clearTimeout(syncTimer);}
    syncUi();
    syncTimer=window.setTimeout(function(){
      syncTimer=null;
      syncUi();
    },30);
  }

  function patchApp(){
    if(!window.DefartApp||typeof window.DefartApp.render!=="function"){return false;}
    if(window.DefartApp.__uiFixInstalled){return true;}

    originalRender=window.DefartApp.render;
    window.DefartApp.render=function(){
      var result=originalRender.apply(window.DefartApp,arguments);
      scheduleSync();
      return result;
    };

    window.DefartApp.__uiFixInstalled=true;
    return true;
  }

  function install(){
    if(installed){scheduleSync();return true;}
    removeClearButton();

    if(!patchApp()){return false;}

    installed=true;
    scheduleSync();

    window.addEventListener("defart:bootstrap-ready",scheduleSync);
    window.addEventListener("bdlocal:screen-data-updated",scheduleSync);
    window.addEventListener("bdlocal:defart-saved",scheduleSync);
    return true;
  }

  function start(){
    var attempts=0;
    if(install()){return;}

    var timer=window.setInterval(function(){
      attempts+=1;
      if(install()||attempts>=100){window.clearInterval(timer);}
    },50);
  }

  window.DefartUIFix={version:VERSION,install:install,sync:syncUi};
  start();
})(window,document);