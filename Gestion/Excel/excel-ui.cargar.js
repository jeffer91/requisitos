/* =========================================================
Nombre completo: excel-ui.cargar.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-ui.cargar.js
Función o funciones:
- Controlar selección de archivo Excel.
- Separar el flujo en dos pasos dentro del mismo botón: Analizar y Guardar.
- En Analizar leer, validar, comparar cédulas y bloquear cambios mayores al 10%.
- En Guardar persistir el resultado ya validado en BaseLocal para BL, Tabla, Ficha y Stats.
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
  var pending=null;
  var mode="analyze";
  var CHANGE_LIMIT=10;

  function id(x){return document.getElementById(x);} 
  function text(value){return String(value==null?"":value).trim();}
  function key(value){return text(value).replace(/\s+/g,"");}
  function selectedPeriod(){var s=id("excel-cargar-period-select");if(!s)return {id:"",label:""};var opt=s.options[s.selectedIndex];return {id:s.value,label:opt?opt.textContent:s.value};}
  function samePeriod(a,b){try{if(window.BLPeriodosCanon&&typeof window.BLPeriodosCanon.samePeriod==="function")return window.BLPeriodosCanon.samePeriod(a,b);}catch(error){}return text(a)===text(b);}
  function cedulaOf(row){
    row=row||{};
    try{if(window.BLMatriculaService&&typeof window.BLMatriculaService.getCedula==="function"){var v=window.BLMatriculaService.getCedula(row);if(text(v))return key(v);}}catch(error){}
    return key(row.cedula||row.Cedula||row.CEDULA||row.numeroIdentificacion||row.numeroidentificacion||row.NumeroIdentificacion||row.identificacion||row.Identificacion||row.docId||row._docId||row._bl2Id);
  }
  function uniqueCedulas(rows){
    var map={};
    (Array.isArray(rows)?rows:[]).forEach(function(row){var c=cedulaOf(row);if(c){map[c]=true;}});
    return Object.keys(map);
  }
  function existingCedulas(periodId){
    var rows=[];
    try{
      if(window.ExcelLocalRepo&&typeof window.ExcelLocalRepo.listStudentsByPeriod==="function"){
        rows=window.ExcelLocalRepo.listStudentsByPeriod(periodId,{})||[];
      }else if(window.ExcelLocalRepo&&typeof window.ExcelLocalRepo.getSnapshot==="function"){
        rows=(window.ExcelLocalRepo.getSnapshot().students||[]).filter(function(student){return samePeriod(student.periodoId,periodId);});
      }
    }catch(error){console.warn("[ExcelUICargar] No se pudo leer estudiantes actuales",error);rows=[];}
    return uniqueCedulas(rows);
  }
  function difference(listA,listB){
    var b={};listB.forEach(function(x){b[x]=true;});
    return listA.filter(function(x){return !b[x];});
  }
  function round2(value){return Math.round((Number(value)||0)*100)/100;}
  function compareCedulas(rows,periodId){
    var incoming=uniqueCedulas(rows);
    var existing=existingCedulas(periodId);
    var added=difference(incoming,existing);
    var removed=difference(existing,incoming);
    var isInitial=existing.length===0;
    var changed=added.length+removed.length;
    var percent=isInitial?0:round2((changed*100)/existing.length);
    return {ok:isInitial||percent<=CHANGE_LIMIT,cargaInicial:isInitial,existentes:existing.length,entrantes:incoming.length,agregadas:added.length,retiradas:removed.length,cambios:changed,porcentajeCambio:percent,limitePorcentaje:CHANGE_LIMIT};
  }
  function buildSecurity(result,period){
    var schema=result&&result.schema?result.schema:{};
    var analisis=result&&result.analisis?result.analisis:{};
    var comparacion=compareCedulas(result&&result.rows,period.id);
    var bloqueos=[];
    var alertas=[];

    if(!schema.ok){bloqueos.push("Faltan columnas críticas: "+((schema.criticalMissing||[]).join(", ")||"sin detalle"));}
    if(!analisis.validas){bloqueos.push("No hay estudiantes válidos con cédula para guardar.");}
    if((analisis.duplicados||0)>0){bloqueos.push("El archivo tiene "+analisis.duplicados+" cédula(s) duplicada(s). Corrige antes de guardar.");}
    if((analisis.sinId||0)>0){bloqueos.push("El archivo tiene "+analisis.sinId+" fila(s) sin cédula. Corrige antes de guardar.");}
    if(!comparacion.ok){bloqueos.push("La comparación por cédulas cambió "+comparacion.porcentajeCambio+"%. El máximo permitido es "+CHANGE_LIMIT+"%.");}

    if(comparacion.cargaInicial){alertas.push("Carga inicial del período: no hay cédulas previas, se permite iniciar desde cero.");}
    if(schema.missing&&schema.missing.length&&!schema.criticalMissing.length){alertas.push("Hay columnas esperadas ausentes, pero no son críticas: "+schema.missing.join(", ")+".");}
    if(schema.extra&&schema.extra.length){alertas.push("Hay columnas extra. Se conservan en la fila, pero no bloquean la carga: "+schema.extra.join(", ")+".");}
    if(comparacion.ok&&!comparacion.cargaInicial){alertas.push("Comparación aceptada: el cambio por cédulas está dentro del 10% permitido.");}

    return {ok:bloqueos.length===0,limitePorcentaje:CHANGE_LIMIT,comparacion:comparacion,bloqueos:bloqueos,alertas:alertas,createdAt:new Date().toISOString()};
  }
  function securityMessage(security){
    if(!security)return "Paso 1: Analizar revisa seguridad, esquema y comparación de cédulas. Paso 2: Guardar actualiza Base Local.";
    var c=security.comparacion||{};
    if(security.ok){return "Análisis correcto. Cambio por cédulas: "+(c.porcentajeCambio||0)+"%. Presiona Guardar para actualizar Base Local.";}
    return "Carga bloqueada. Corrige el archivo y vuelve a analizar. Cambio por cédulas: "+(c.porcentajeCambio||0)+"%.";
  }
  function setStatus(message,kind){
    var box=id("excel-load-status");
    if(box){box.textContent=message;box.className="muted excel-load-status "+(kind||"");}
  }
  function setMode(next){
    mode=next==="save"?"save":"analyze";
    var b=id("excel-analyze-save-btn");
    if(b){b.textContent=mode==="save"?"Guardar":"Analizar";}
  }
  function setBusy(on,msg){
    var b=id("excel-analyze-save-btn");
    if(b){b.disabled=!!on;if(on)b.textContent=msg||"Procesando...";else b.textContent=mode==="save"?"Guardar":"Analizar";}
  }
  function clearPending(reason){
    pending=null;
    setMode("analyze");
    if(reason){setStatus(reason,"warn");}
  }
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
  async function analyzeOnly(){
    var input=id("excel-file-input");
    var file=input&&input.files?input.files[0]:null;
    if(!file)throw new Error("Selecciona un archivo Excel.");
    var period=selectedPeriod();
    if(!period.id)throw new Error("Selecciona un período antes de analizar.");

    setBusy(true,"Analizando...");
    var perf=window.ExcelPerformance?window.ExcelPerformance.start("analizar-excel"):null;
    try{
      var read=await window.ExcelReader.readFile(file);
      var result=window.ExcelLogic.procesar(read);
      var security=buildSecurity(result,period);
      var payload={periodoId:period.id,periodoLabel:period.label,fileName:read.fileName,rows:result.rows,schema:result.schema,analisis:result.analisis,consolidado:result.consolidado,seguridad:security};

      window.ExcelState.set({periodoId:period.id,periodoLabel:period.label,fileName:read.fileName,headers:result.headers,rows:result.rows,schema:result.schema,analisis:result.analisis,consolidado:result.consolidado,seguridad:security,saveStatus:null,lastAction:"analizar",lastError:null},"excel:analizado");
      try{localStorage.setItem("REQ_EXCEL_LAST_ANALYSIS",JSON.stringify({periodoId:period.id,periodoLabel:period.label,fileName:read.fileName,schema:result.schema,analisis:result.analisis,consolidado:result.consolidado,seguridad:security,saveStatus:null,updatedAt:new Date().toISOString()}));}catch(e){}
      if(window.ExcelMonitor)window.ExcelMonitor.log("excel-ui.cargar","Análisis ejecutado con seguridades",{rows:result.rows.length,periodoId:period.id,seguridad:security.ok});
      refreshOtherUi();
      if(perf)perf.end({rows:result.rows.length,seguridad:security.ok});

      if(security.ok){
        pending=payload;
        setMode("save");
        setStatus(securityMessage(security),"ok");
        alert("Análisis correcto. Revisa el resumen y presiona Guardar para actualizar Base Local.");
      }else{
        pending=null;
        setMode("analyze");
        setStatus(securityMessage(security),"bad");
        alert("No se puede guardar todavía. Revisa los bloqueos en el resumen, corrige el archivo y vuelve a analizar.");
      }
      return result;
    }catch(e){window.ExcelState.set({lastError:e.message||String(e),seguridad:null,saveStatus:null},"excel:error");throw e;}finally{setBusy(false);}
  }
  async function savePending(){
    if(!pending||!pending.seguridad||!pending.seguridad.ok){throw new Error("Primero analiza un archivo válido antes de guardar.");}
    setBusy(true,"Guardando...");
    try{
      var saved=await saveWithBL2Import(pending);
      var saveStatus={ok:true,createdAt:new Date().toISOString(),result:saved&&saved.ok!==false};
      window.ExcelState.set({saveStatus:saveStatus,lastAction:"guardar",lastError:null},"excel:guardado");
      try{localStorage.setItem("REQ_EXCEL_LAST_ANALYSIS",JSON.stringify({periodoId:pending.periodoId,periodoLabel:pending.periodoLabel,fileName:pending.fileName,schema:pending.schema,analisis:pending.analisis,consolidado:pending.consolidado,seguridad:pending.seguridad,saveStatus:saveStatus,updatedAt:new Date().toISOString()}));}catch(e){}
      if(window.ExcelMonitor)window.ExcelMonitor.log("excel-ui.cargar","Carga guardada en BaseLocal y BL2 en segundo plano",{rows:pending.rows.length,periodoId:pending.periodoId});
      pending=null;
      setMode("analyze");
      setStatus("Guardado correcto en Base Local. Para una nueva carga, selecciona archivo y presiona Analizar.","ok");
      refreshOtherUi();
      alert("Excel guardado en Base Local. BL2 se actualiza en segundo plano.");
      return saved;
    }catch(e){window.ExcelState.set({lastError:e.message||String(e),saveStatus:{ok:false,error:e.message||String(e),createdAt:new Date().toISOString()}},"excel:error");throw e;}finally{setBusy(false);}
  }
  function boot(){
    if(booted)return;
    booted=true;
    var btn=id("excel-analyze-save-btn");
    var file=id("excel-file-input");
    var period=id("excel-cargar-period-select");
    if(btn)btn.addEventListener("click",function(){(mode==="save"?savePending():analyzeOnly()).catch(function(e){setStatus(e.message||String(e),"bad");alert(e.message||e);});});
    if(file)file.addEventListener("change",function(){clearPending("Archivo cambiado. Presiona Analizar para ejecutar seguridades antes de guardar.");});
    if(period)period.addEventListener("change",function(){clearPending("Período cambiado. Presiona Analizar para comparar cédulas antes de guardar.");});
    setMode("analyze");
  }
  window.ExcelUICargar={boot:boot,analyze:analyzeOnly,save:savePending,ensureBL2ImportService:ensureBL2ImportService,buildSecurity:buildSecurity,compareCedulas:compareCedulas};
})(window,document);
