/* =========================================================
Nombre completo: excel-ui.cargar.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-ui.cargar.js
Función o funciones:
- Controlar selección de archivo Excel.
- Leer, validar y consolidar datos del archivo cargado.
- Guardar el resultado en BaseLocal para BL, Tabla, Ficha y Stats.
- Cargar BL2 Import bajo demanda para copiar datos al motor nuevo en segundo plano.
Con qué se conecta:
- excel-reader.js
- excel-logic.js
- excel-state.js
- excel-local.repo.js
- ../../BaseLocal2/services/bl2-import-excel.service.js
========================================================= */
(function(window,document){
  "use strict";
  var booted=false;
  function id(x){return document.getElementById(x);} 
  function selectedPeriod(){var s=id("excel-cargar-period-select");if(!s)return {id:"",label:""};var opt=s.options[s.selectedIndex];return {id:s.value,label:opt?opt.textContent:s.value};}
  function setBusy(on,msg){var b=id("excel-analyze-save-btn");if(b){b.disabled=!!on;b.textContent=on?(msg||"Analizando..."):"Analizar";}}
  function refreshOtherUi(){try{if(window.ExcelUIResumen)window.ExcelUIResumen.render();if(window.ExcelUIHistorial)window.ExcelUIHistorial.boot();if(window.ExcelUIPeriodo)window.ExcelUIPeriodo.refresh();}catch(e){console.warn("[ExcelUICargar] refresh UI",e);}}
  function loadScriptOnce(src,globalName){
    return new Promise(function(resolve){
      if(globalName&&window[globalName]){resolve(true);return;}
      var existing=document.querySelector('script[data-bl2-import-src="'+src+'"]');
      if(existing){existing.addEventListener("load",function(){resolve(true);});existing.addEventListener("error",function(){resolve(false);});return;}
      var script=document.createElement("script");script.src=src;script.async=false;script.dataset.bl2ImportSrc=src;script.onload=function(){resolve(true);};script.onerror=function(){console.warn("[ExcelUICargar] No se pudo cargar",src);resolve(false);};document.head.appendChild(script);
    });
  }
  async function ensureBL2ImportService(){
    if(window.BL2ImportExcelService&&typeof window.BL2ImportExcelService.importAnalysis==="function")return true;
    var base="../../BaseLocal2/";
    await loadScriptOnce(base+"bl2-config.js","BL2Config");
    await loadScriptOnce(base+"bl2-detect-runtime.js","BL2Runtime");
    await loadScriptOnce(base+"db/bl2-schema.js","BL2Schema");
    await loadScriptOnce(base+"db/bl2-migrations.js","BL2Migrations");
    await loadScriptOnce(base+"db/bl2-indexeddb-adapter.js","BL2IndexedDBAdapter");
    await loadScriptOnce(base+"db/bl2-sqlite-adapter.js","BL2SQLiteAdapter");
    await loadScriptOnce(base+"db/bl2-storage.js","BL2Storage");
    await loadScriptOnce(base+"bl2-legacy-adapter.js","BL2LegacyAdapter");
    await loadScriptOnce(base+"bl2-api.js","BL2");
    await loadScriptOnce(base+"services/bl2-matricula.service.js","BL2MatriculaService");
    await loadScriptOnce(base+"services/bl2-import-excel.service.js","BL2ImportExcelService");
    return !!(window.BL2ImportExcelService&&typeof window.BL2ImportExcelService.importAnalysis==="function");
  }
  async function saveWithBL2Import(payload){
    var ready=await ensureBL2ImportService();
    if(ready){return window.BL2ImportExcelService.importAnalysis(payload,{saveLegacy:true});}
    if(window.ExcelLocalRepo&&typeof window.ExcelLocalRepo.saveAnalysis==="function")return {ok:true,saved:window.ExcelLocalRepo.saveAnalysis(payload),fallback:true};
    throw new Error("ExcelLocalRepo.saveAnalysis no disponible.");
  }
  async function analyze(){
    var input=id("excel-file-input");var file=input&&input.files?input.files[0]:null;if(!file)throw new Error("Selecciona un archivo Excel.");
    var period=selectedPeriod();if(!period.id)throw new Error("Selecciona un período antes de analizar.");
    setBusy(true,"Analizando...");var perf=window.ExcelPerformance?window.ExcelPerformance.start("analizar-excel"):null;
    try{
      var read=await window.ExcelReader.readFile(file);var result=window.ExcelLogic.procesar(read);
      window.ExcelState.set({periodoId:period.id,periodoLabel:period.label,fileName:read.fileName,headers:result.headers,rows:result.rows,schema:result.schema,analisis:result.analisis,consolidado:result.consolidado,lastAction:"analizar",lastError:null},"excel:analizado");
      setBusy(true,"Guardando...");
      await saveWithBL2Import({periodoId:period.id,periodoLabel:period.label,fileName:read.fileName,rows:result.rows,schema:result.schema,analisis:result.analisis,consolidado:result.consolidado});
      try{localStorage.setItem("REQ_EXCEL_LAST_ANALYSIS",JSON.stringify({periodoId:period.id,periodoLabel:period.label,fileName:read.fileName,schema:result.schema,analisis:result.analisis,consolidado:result.consolidado,updatedAt:new Date().toISOString()}));}catch(e){}
      if(window.ExcelMonitor)window.ExcelMonitor.log("excel-ui.cargar","Análisis guardado en BaseLocal y copiado a BL2 en segundo plano",{rows:result.rows.length,periodoId:period.id});
      refreshOtherUi();
      if(perf)perf.end({rows:result.rows.length});
      return result;
    }catch(e){window.ExcelState.set({lastError:e.message||String(e)},"excel:error");throw e;}finally{setBusy(false);}
  }
  function boot(){if(booted)return;booted=true;var btn=id("excel-analyze-save-btn");if(btn)btn.addEventListener("click",function(){analyze().then(function(){alert("Excel analizado y guardado en BaseLocal. BL2 se actualiza en segundo plano.");}).catch(function(e){alert(e.message||e);});});}
  window.ExcelUICargar={boot:boot,analyze:analyze,ensureBL2ImportService:ensureBL2ImportService};
})(window,document);
