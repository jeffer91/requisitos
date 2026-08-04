/* =========================================================
Nombre completo: ncomplex.simple-ui.js
Ruta o ubicación: /Ncomplex/ncomplex.simple-ui.js
Función o funciones:
- Mostrar u ocultar los filtros secundarios.
- Abrir y cerrar la importación de notas en una ventana modal.
- Mantener accesibilidad básica mediante aria-expanded y aria-hidden.
- Conservar la pantalla principal enfocada en la tabla de calificaciones.
========================================================= */
(function(window,document){
  "use strict";

  var initialized=false;

  function element(id){
    return document.getElementById(id);
  }

  function setExpanded(button,expanded){
    if(button){
      button.setAttribute("aria-expanded",expanded?"true":"false");
      button.textContent=expanded?"Ocultar filtros":"Más filtros";
    }
  }

  function toggleAdvanced(force){
    var panel=element("ncomplex-advanced-filters");
    var button=element("ncomplex-btn-advanced");
    if(!panel){return false;}

    var expanded=typeof force==="boolean"?force:panel.hidden;
    panel.hidden=!expanded;
    setExpanded(button,expanded);

    if(expanded){
      var first=panel.querySelector("select,input,button");
      if(first&&typeof first.focus==="function"){first.focus();}
    }

    return expanded;
  }

  function openImport(){
    var modal=element("ncomplex-import-modal");
    if(!modal){return false;}

    modal.hidden=false;
    modal.setAttribute("aria-hidden","false");
    document.body.classList.add("ncomplex-modal-open");

    window.setTimeout(function(){
      var textarea=element("ncomplex-paste-data");
      if(textarea&&typeof textarea.focus==="function"){textarea.focus();}
    },0);

    return true;
  }

  function closeImport(){
    var modal=element("ncomplex-import-modal");
    if(!modal){return false;}

    modal.hidden=true;
    modal.setAttribute("aria-hidden","true");

    var modalityModal=element("ncomplex-modality-modal");
    if(!modalityModal||modalityModal.hidden){
      document.body.classList.remove("ncomplex-modal-open");
    }

    var trigger=element("ncomplex-btn-import");
    if(trigger&&typeof trigger.focus==="function"){trigger.focus();}
    return true;
  }

  function bind(){
    if(initialized){return true;}
    initialized=true;

    var advancedButton=element("ncomplex-btn-advanced");
    if(advancedButton){
      advancedButton.addEventListener("click",function(){toggleAdvanced();});
    }

    var clearFilters=element("ncomplex-btn-clear-filters");
    if(clearFilters){
      clearFilters.addEventListener("click",function(){toggleAdvanced(false);});
    }

    var importButton=element("ncomplex-btn-import");
    if(importButton){
      importButton.addEventListener("click",openImport);
    }

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-ncomplex-import-close]"),
      function(button){button.addEventListener("click",closeImport);}
    );

    var modal=element("ncomplex-import-modal");
    if(modal){
      modal.addEventListener("click",function(event){
        if(event.target===modal){closeImport();}
      });
    }

    document.addEventListener("keydown",function(event){
      if(event.key!=="Escape"){return;}
      var importModal=element("ncomplex-import-modal");
      if(importModal&&!importModal.hidden){closeImport();return;}
      var advanced=element("ncomplex-advanced-filters");
      if(advanced&&!advanced.hidden){toggleAdvanced(false);}
    });

    return true;
  }

  window.NcomplexSimpleUI={
    version:"1.0.0-simple-layout",
    init:bind,
    toggleAdvanced:toggleAdvanced,
    openImport:openImport,
    closeImport:closeImport
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bind);
  }else{
    bind();
  }
})(window,document);
