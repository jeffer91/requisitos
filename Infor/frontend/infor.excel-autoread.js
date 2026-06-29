/* =========================================================
Nombre completo: infor.excel-autoread.js
Ruta o ubicación: /Requisitos/Infor/frontend/infor.excel-autoread.js
Función o funciones:
- Refuerzo de lectura de Excel para Infor cuando el archivo aparece seleccionado pero el estado sigue sin filas.
- Reintentar lectura al cambiar, seleccionar o presionar Procesar.
- Evitar que el usuario tenga que volver a cargar el archivo si el evento change no se ejecutó correctamente.
Con qué se conecta:
- titulacion.html
- titulacion.app.js
- ../core/infor.excel.js
- ../core/infor.match.js
- ../core/infor.state.js
========================================================= */
(function(window, document){
  "use strict";

  var busy = false;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value == null ? "" : value).trim();}
  function status(message, cls){var box = el("infor-status");if(box){box.textContent = message;box.className = "infor-status " + (cls || "");}}
  function selectedFile(){var input = el("infor-excel-file");return input && input.files && input.files[0] ? input.files[0] : null;}
  function hasExcelRows(){
    try{
      var snapshot = window.InforState && window.InforState.getState ? window.InforState.getState() : {};
      return !!(snapshot.excelData && Array.isArray(snapshot.excelData.rows) && snapshot.excelData.rows.length);
    }catch(error){return false;}
  }

  async function readSelected(reason){
    if(busy){return false;}
    var file = selectedFile();
    if(!file || hasExcelRows()){return false;}
    if(!(window.InforExcel && typeof window.InforExcel.readFile === "function")){status("No se pudo leer el Excel: InforExcel no está disponible.", "bad");return false;}
    if(!(window.InforState && typeof window.InforState.setExcelAnalysis === "function")){status("No se pudo leer el Excel: InforState no está disponible.", "bad");return false;}

    busy = true;
    try{
      status("Leyendo Excel seleccionado desde Infor...", "warn");
      var analysis = await window.InforExcel.readFile(file);
      window.InforState.setExcelAnalysis(analysis);
      if(window.InforApp && typeof window.InforApp.runMatch === "function"){window.InforApp.runMatch();}
      if(window.InforApp && typeof window.InforApp.render === "function"){
        window.InforApp.render(
          analysis.totalRows ?
            ("Excel leído: " + (analysis.usefulSheets || 0) + " hojas útiles, " + (analysis.totalRows || 0) + " filas detectadas.") :
            "Excel leído, pero no se detectaron filas de estudiantes. Revisa encabezados u hojas.",
          analysis.totalRows ? "ok" : "warn"
        );
      }
      return analysis.totalRows > 0;
    }catch(error){
      console.error("[Infor Excel autoread]", error);
      if(window.InforState && typeof window.InforState.setExcelInfo === "function"){
        window.InforState.setExcelInfo({fileName:file.name,size:file.size,type:file.type || "",loaded:false,sheetCount:0,ignoredSheets:0,usefulSheets:0,totalRows:0,error:error.message || String(error)});
      }
      if(window.InforApp && typeof window.InforApp.render === "function"){window.InforApp.render("No se pudo leer el Excel: " + (error.message || String(error)), "bad");}
      else{status("No se pudo leer el Excel: " + (error.message || String(error)), "bad");}
      return false;
    }finally{
      busy = false;
    }
  }

  function bind(){
    var input = el("infor-excel-file");
    if(input){
      input.addEventListener("change", function(){readSelected("change");});
      input.addEventListener("input", function(){readSelected("input");});
    }

    var process = el("infor-process");
    if(process){
      process.addEventListener("click", async function(event){
        if(hasExcelRows()){return;}
        if(!selectedFile()){return;}
        event.preventDefault();
        event.stopImmediatePropagation();
        var ok = await readSelected("process");
        if(ok && window.InforApp && typeof window.InforApp.process === "function"){
          window.InforApp.process();
        }
      }, true);
    }
  }

  function boot(){setTimeout(bind, 0);}
  if(document.readyState === "loading"){document.addEventListener("DOMContentLoaded", boot);}else{boot();}

  window.InforExcelAutoRead = {readSelected:readSelected, hasExcelRows:hasExcelRows};
})(window, document);
