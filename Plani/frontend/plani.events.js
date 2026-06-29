/* =========================================================
Nombre completo: plani.events.js
Ruta o ubicación: /Requisitos/Plani/frontend/plani.events.js
Función o funciones:
- Encapsular la conexión de eventos de la pantalla Plani.
- Leer archivo de cronograma en texto cuando el usuario lo cargue.
- Delegar acciones al controlador principal sin mezclar lógica de estado con DOM.
- Conectar acciones de exportación Word y PDF.
Con qué se conecta:
- plani.html
- plani.ui.js
- plani.app.js
========================================================= */
(function(window, document){
  "use strict";

  function ui(){return window.PlaniUI || null;}
  function el(id){return document.getElementById(id);}
  function bind(id, eventName, handler, options){
    var node = el(id);
    if(node && typeof handler === "function"){
      node.addEventListener(eventName, handler, options || false);
    }
  }

  async function readTextFile(file){
    if(!file){return "";}
    if(typeof file.text === "function"){
      return file.text();
    }
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){resolve(String(reader.result || ""));};
      reader.onerror = function(){reject(reader.error || new Error("No se pudo leer el archivo."));};
      reader.readAsText(file);
    });
  }

  function safeCall(fn){
    try{
      if(typeof fn === "function"){fn();}
    }catch(error){
      console.error("[Plani evento]", error);
      if(ui()){ui().status(error.message || String(error), "bad");}
    }
  }

  function bindEvents(app){
    app = app || {};

    bind("plani-periodo", "change", function(event){
      if(typeof app.onPeriodChange === "function"){
        app.onPeriodChange(event.target.value, event.target.options[event.target.selectedIndex] ? event.target.options[event.target.selectedIndex].textContent : "");
      }
    });

    bind("plani-document-type", "change", function(event){
      if(typeof app.onDocumentTypeChange === "function"){
        app.onDocumentTypeChange(event.target.value);
      }
    });

    bind("plani-cronograma-raw", "input", function(event){
      if(typeof app.onCronogramaInput === "function"){
        app.onCronogramaInput(event.target.value, "");
      }
    });

    bind("plani-cronograma-file", "change", async function(event){
      var file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      if(!file){return;}
      try{
        if(ui()){ui().status("Leyendo archivo de cronograma...", "warn");}
        var content = await readTextFile(file);
        var input = el("plani-cronograma-raw");
        if(input){input.value = content;}
        if(typeof app.onCronogramaInput === "function"){
          app.onCronogramaInput(content, file.name || "cronograma");
        }
      }catch(error){
        console.error("[Plani archivo cronograma]", error);
        if(ui()){ui().status(error.message || String(error), "bad");}
      }
    });

    bind("plani-process", "click", function(){
      safeCall(app.onPrepareBase);
    });

    bind("plani-export-word", "click", function(){
      safeCall(app.onExportWord);
    });

    bind("plani-export-pdf", "click", function(){
      safeCall(app.onExportPdf);
    });
  }

  window.PlaniEvents = {
    bind: bindEvents,
    readTextFile: readTextFile
  };
})(window, document);
