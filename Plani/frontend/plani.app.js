/* =========================================================
Nombre completo: plani.app.js
Ruta o ubicación: /Requisitos/Plani/frontend/plani.app.js
Función o funciones:
- Orquestar la pantalla Plani con estado interno robusto.
- Conectar período, tipo de documento, almacenamiento, validación, QA, cronograma, recursos, motor documental y exportación.
- Construir el modelo interno para vista previa documental.
- Exportar Word y PDF desde una sola fuente HTML institucional.
- Mantener Plani separado de Infor y del menú principal hasta la integración final.
========================================================= */
(function(window, document){
  "use strict";

  var currentModel = null;

  function ui(){return window.PlaniUI || null;}
  function ev(){return window.PlaniEvents || null;}
  function st(){return window.PlaniState || null;}
  function periodo(){return window.PlaniPeriodo || null;}
  function validator(){return window.PlaniValidator || null;}
  function qa(){return window.PlaniQA || null;}
  function assetsUI(){return window.PlaniAssetsUI || null;}
  function previewUI(){return window.PlaniPreviewUI || null;}
  function builder(){return window.PlaniBuilder || null;}
  function gateway(){return window.PlaniExportGateway || null;}
  function parser(){return window.PlaniCronogramaParser || null;}
  function mapper(){return window.PlaniCronogramaMapper || null;}
  function charts(){return window.PlaniCharts || null;}
  function sectionAssets(){return window.PlaniSectionAssets || null;}
  function text(value){return String(value == null ? "" : value).trim();}
  function el(id){return document.getElementById(id);}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  function option(value, label, selected){
    return '<option value="' + esc(value) + '" ' + (selected ? 'selected' : '') + '>' + esc(label) + '</option>';
  }

  function setExportEnabled(enabled){
    var word = el("plani-export-word");
    var pdf = el("plani-export-pdf");
    if(word){word.disabled = !enabled;}
    if(pdf){pdf.disabled = !enabled;}
  }

  function fillPeriods(current){
    var select = el("plani-periodo");
    if(!select){return;}
    var list = periodo() && typeof periodo().list === "function" ? periodo().list() : [];
    select.innerHTML = option("", "Selecciona un período", !current) + list.map(function(item){
      return option(item.id, item.label, current === item.id);
    }).join("");
  }

  function enrichCronograma(snapshot){
    if(!snapshot || !text(snapshot.cronogramaRaw) || !parser()){return snapshot;}
    var parsed = parser().parse(snapshot.cronogramaRaw);
    var mapped = mapper() ? mapper().mapRows(parsed, snapshot.documentType) : null;
    snapshot.cronogramaParsed = parsed;
    snapshot.cronogramaMapped = mapped;
    if(mapped && charts() && sectionAssets()){
      var chart = charts().chartAsset(charts().fromCronogramaGroups(mapped), "cronograma");
      var map = snapshot.sectionAssets || {};
      snapshot.sectionAssets = sectionAssets().addAsset(map, "cronograma", chart);
    }
    return snapshot;
  }

  function renderAssets(snapshot){
    if(assetsUI()){
      assetsUI().renderSummary((snapshot && snapshot.sectionAssets) || {});
    }
  }

  function renderPreview(model){
    if(previewUI()){
      previewUI().render(model || currentModel);
    }
  }

  function render(message, cls){
    var snapshot = st() ? st().getState() : {};
    snapshot = enrichCronograma(snapshot);
    if(ui()){ui().renderAll(snapshot, message, cls);}
    renderAssets(snapshot);
    if(currentModel){renderPreview(currentModel);}
    setExportEnabled(!!(currentModel && currentModel.ready));
    if(qa()){qa().render(qa().run());}
  }

  function syncReadiness(){
    var node = el("plani-readiness");
    var snapshot = st() ? st().getState() : {};
    var result = validator() ? validator().validate(snapshot) : {ok:false,message:"Validador no disponible."};
    if(node){
      node.textContent = result.message;
      node.className = "plani-muted " + (result.ok ? "ok" : "warn");
    }
    return result;
  }

  function resetModel(){
    currentModel = null;
    setExportEnabled(false);
    if(previewUI()){previewUI().render(null);}
  }

  function onPeriodChange(periodId, periodLabel){
    resetModel();
    if(st()){st().setPeriod(periodId, periodLabel);}
    var snapshot = st() ? st().getState() : {};
    var selectDoc = el("plani-document-type");
    if(selectDoc && snapshot.documentType){selectDoc.value = snapshot.documentType;}
    syncReadiness();
    render(snapshot.periodLabel ? "Período registrado para Plani." : "Selecciona un período para continuar.", snapshot.periodLabel ? "ok" : "warn");
  }

  function onDocumentTypeChange(documentType){
    resetModel();
    if(st()){st().setDocumentType(documentType);}
    syncReadiness();
    render(documentType ? "Tipo de planificación seleccionado." : "Selecciona el tipo de planificación.", documentType ? "ok" : "warn");
  }

  function onCronogramaInput(value, fileName){
    resetModel();
    if(st()){st().setCronograma(value, fileName);}
    syncReadiness();
    render(text(value) ? "Cronograma interpretado en Plani." : "Cronograma vacío.", text(value) ? "ok" : "warn");
  }

  function onPrepareBase(){
    var snapshot = st() ? st().getState() : {};
    var result = validator() ? validator().validate(snapshot) : {ok:false,message:"Validador no disponible."};
    if(st()){st().pushDiagnostic("validacion", result.message);st().save();}
    if(result.ok && builder()){
      currentModel = builder().build(enrichCronograma(snapshot));
      renderPreview(currentModel);
    }
    syncReadiness();
    render(result.ok ? "Documento interno construido correctamente. Exportación habilitada." : result.message, result.ok ? "ok" : "warn");
  }

  function ensureModel(){
    if(!currentModel && builder()){
      currentModel = builder().build(enrichCronograma(st() ? st().getState() : {}));
    }
    if(!currentModel || !currentModel.ok){throw new Error("Primero construye el documento Plani.");}
    return currentModel;
  }

  function onExportWord(){
    var model = ensureModel();
    if(gateway()){gateway().word(model);}
    if(ui()){ui().status("Word generado desde Plani.", "ok");}
  }

  function onExportPdf(){
    var model = ensureModel();
    if(gateway()){gateway().pdf(model);}
    if(ui()){ui().status("Vista PDF abierta para imprimir/guardar.", "ok");}
  }

  function boot(){
    try{
      if(st()){st().init();}
      var snapshot = st() ? st().getState() : {};
      fillPeriods(snapshot.periodId);
      if(ui()){ui().fillDocumentTypes(snapshot.documentType);}
      if(ev()){
        ev().bind({
          onPeriodChange:onPeriodChange,
          onDocumentTypeChange:onDocumentTypeChange,
          onCronogramaInput:onCronogramaInput,
          onPrepareBase:onPrepareBase,
          onExportWord:onExportWord,
          onExportPdf:onExportPdf
        });
      }
      syncReadiness();
      setExportEnabled(false);
      render("Plani listo. Bloque 6 cargado correctamente.", "ok");
    }catch(error){
      console.error("[Plani boot]", error);
      if(ui()){ui().status(error.message || String(error), "bad");}
    }
  }

  function getState(){return st() ? st().getState() : {};}
  function getCurrentModel(){return currentModel;}
  function getModel(){return currentModel;}

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.PlaniApp = {
    getState:getState,
    getCurrentModel:getCurrentModel,
    getModel:getModel,
    render:render,
    onPeriodChange:onPeriodChange,
    onDocumentTypeChange:onDocumentTypeChange,
    onCronogramaInput:onCronogramaInput,
    onPrepareBase:onPrepareBase,
    onExportWord:onExportWord,
    onExportPdf:onExportPdf
  };
})(window, document);
