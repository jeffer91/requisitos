/* =========================================================
Nombre completo: carga.ui.connector.js
Ruta o ubicación: /Carga/carga.ui.connector.js
Función o funciones:
- Controlar los campos y botones de Carga.
- Crear períodos, consultar resúmenes, analizar, guardar y borrar mediante CargaApp y ConCarga.
- Abrir el popup de divisiones conectado.
Con qué se conecta:
- carga.app.connector.js
- carga.state.js
- carga.divisiones.popup.js
- ../BDLocal/conexiones/cone.carga.js
========================================================= */
(function(window,document){
  "use strict";

  var MONTHS=[["01","Enero"],["02","Febrero"],["03","Marzo"],["04","Abril"],["05","Mayo"],["06","Junio"],["07","Julio"],["08","Agosto"],["09","Septiembre"],["10","Octubre"],["11","Noviembre"],["12","Diciembre"]];
  var LS_PERIODOS="carga.periodos.local";
  var LS_PERIODO="carga.periodoSeleccionado";
  var LS_LABEL="carga.periodoSeleccionadoLabel";
  var LS_DIV_PERIOD="carga.divisiones.periodoSeleccionado";
  var els={};
  var periods=[];
  var selectedFile=null;
  var analyzedPeriodId="";
  var busy=false;

  function text(value){return String(value==null?"":value).trim();}
  function byId(id){return document.getElementById(id);}
  function num(value){value=Number(value||0);return Number.isFinite(value)?value:0;}
  function canon(value){return text(value).replace(/_+/g,"__");}
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function storageGet(key,fallback){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(error){return fallback;}}
  function storageSet(key,value){try{localStorage.setItem(key,typeof value==="string"?value:JSON.stringify(value));return true;}catch(error){return false;}}
  function show(node){if(node){node.classList.remove("carga-hidden");}}
  function hide(node){if(node){node.classList.add("carga-hidden");}}
  function setText(id,value){var node=byId(id);if(node){node.textContent=text(value);}}
  function monthName(id){var found=MONTHS.filter(function(item){return item[0]===text(id);})[0];return found?found[1]:text(id);}
  function normalizePeriod(period){
    period=period||{};var id=canon(period.periodoCanonicoId||period.periodoId||period.id||period.value||"");
    if(!id){return null;}
    var label=text(period.periodoCanonicoLabel||period.periodoLabel||period.label||period.nombre||id);
    return Object.assign({},period,{id:id,value:id,periodoId:id,periodoCanonicoId:id,label:label,nombre:label,periodoLabel:label,periodoCanonicoLabel:label,divisiones:Array.isArray(period.divisiones)?period.divisiones:[],carrerasDetectadas:Array.isArray(period.carrerasDetectadas)?period.carrerasDetectadas:[]});
  }
  function mergePeriods(list){
    var map={};
    (storageGet(LS_PERIODOS,[])||[]).concat(Array.isArray(list)?list:[]).forEach(function(item){item=normalizePeriod(item);if(item){map[item.id]=Object.assign({},map[item.id]||{},item);}});
    periods=Object.keys(map).map(function(id){return map[id];}).sort(function(a,b){return b.id.localeCompare(a.id);});
    storageSet(LS_PERIODOS,periods);return periods;
  }
  function periodById(id){id=canon(id);return periods.filter(function(item){return item.id===id;})[0]||null;}
  function selectedLoad(){return periodById(els.periodo&&els.periodo.value);}
  function selectedDiv(){return periodById(els.divPeriodo&&els.divPeriodo.value);}
  function selectedDelete(){return periodById(els.deletePeriodo&&els.deletePeriodo.value);}
  function ensureConnector(){
    var con=connector();
    if(!con){return Promise.reject(new Error("ConCarga no está cargado."));}
    return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(result){if(result&&result.ok===false){throw new Error(result.error||"ConCarga no está listo.");}return con;});
  }
  function showMessage(type,message){
    var node=els.toast||els.message;if(!node){return;}
    node.className=(node===els.toast?"carga-toast ":"carga-message ")+"is-"+(type||"success");node.textContent=message||"";show(node);
    clearTimeout(node.__timer);node.__timer=setTimeout(function(){hide(node);},5000);
  }
  function setBusy(value,message){
    busy=!!value;
    [els.create,els.analyze,els.save,els.clear,els.divButton,els.deleteStudents,els.deletePeriod].forEach(function(button){if(button){button.disabled=busy;}});
    if(message){setText("cargaEstadoPill",message);}updateControls();
  }
  function renderSelectors(){
    var option='<option value="">Seleccione un período...</option>'+periods.map(function(item){return '<option value="'+item.id+'">'+item.label+'</option>';}).join("");
    var loadCurrent=text(els.periodo&&els.periodo.value||storageGet(LS_PERIODO,""));
    var divCurrent=text(els.divPeriodo&&els.divPeriodo.value||storageGet(LS_DIV_PERIOD,""));
    var delCurrent=text(els.deletePeriodo&&els.deletePeriodo.value);
    [els.periodo,els.divPeriodo,els.deletePeriodo].forEach(function(select){if(select){select.innerHTML=option;}});
    if(els.periodo&&periodById(loadCurrent)){els.periodo.value=canon(loadCurrent);}
    if(els.divPeriodo&&periodById(divCurrent)){els.divPeriodo.value=canon(divCurrent);}
    if(els.deletePeriodo&&periodById(delCurrent)){els.deletePeriodo.value=canon(delCurrent);}
    setText("cargaPeriodosCount",periods.length+" período"+(periods.length===1?"":"s"));
    setText("cargaDivisionesCount",selectedDiv()?(selectedDiv().divisiones||[]).length+" divisiones":"0 divisiones");
    updateControls();
  }
  function refreshPeriods(){
    return ensureConnector().then(function(con){return typeof con.getPeriods==="function"?con.getPeriods():typeof con.listPeriods==="function"?con.listPeriods():[];}).then(function(rows){mergePeriods(rows);renderSelectors();return periods;});
  }
  function createPeriod(){
    var fm=text(els.fromMonth.value),fy=Number(els.fromYear.value),tm=text(els.toMonth.value),ty=Number(els.toYear.value);
    if(!/^\d{4}$/.test(String(fy))||!/^\d{4}$/.test(String(ty))){showMessage("warning","Escribe años válidos de cuatro dígitos.");return;}
    if((ty*12+Number(tm))<(fy*12+Number(fm))){showMessage("warning","La fecha final no puede ser anterior a la inicial.");return;}
    var id=fy+"-"+fm+"__"+ty+"-"+tm;var label=monthName(fm)+" "+fy+" a "+monthName(tm)+" "+ty;
    if(periodById(id)){showMessage("warning","Ese período ya existe.");return;}
    var period=normalizePeriod({id:id,label:label,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),divisiones:[],carrerasDetectadas:[]});
    setBusy(true,"Guardando período");
    ensureConnector().then(function(con){return typeof con.savePeriod==="function"?con.savePeriod(period):con.guardarPeriodo(period);})
      .then(function(){mergePeriods([period]);renderSelectors();els.periodo.value=id;onPeriodChange();showMessage("success","Período creado: "+label+".");emit("carga:periods-local-updated",{source:"ConCarga",total:periods.length,period:period});})
      .catch(function(error){showMessage("error",error.message||String(error));})
      .finally(function(){setBusy(false);});
  }
  function renderList(node,items,empty,kind){
    if(!node){return;}items=Array.isArray(items)?items:[];
    node.innerHTML=items.length?items.slice(0,60).map(function(item){return '<div class="carga-list-item '+kind+'">'+text(item.mensaje||item.message||item.tipo||item)+'</div>';}).join(""):'<div class="carga-empty">'+empty+'</div>';
  }
  function renderValidation(){var current=window.CargaState&&window.CargaState.get?window.CargaState.get():{};renderList(els.warnings,current.warnings||[],"Sin alertas.","warning");renderList(els.errors,current.errors||[],"Sin errores.","error");}
  function renderGuard(guard){
    if(!guard){hide(els.guard);return;}show(els.guard);els.guard.className="carga-guard "+(guard.ok?"is-ok":"is-blocked");
    setText("cargaGuardTitle",guard.ok?"Archivo aprobado":"Carga bloqueada");setText("cargaGuardMessage",guard.message||"");setText("cargaGuardChip",guard.ok?"Permitido":"Bloqueado");
    if(els.guardChip){els.guardChip.className="carga-chip "+(guard.ok?"is-ok":"is-danger");}
    setText("cargaGuardExisting",num(guard.existing));setText("cargaGuardFile",num(guard.inFile));setText("cargaGuardCommon",num(guard.common));setText("cargaGuardDifferent",num(guard.different));setText("cargaGuardPercent",num(guard.percent).toFixed(2)+"%");
    analyzedPeriodId=guard.periodoId||"";updateControls();
  }
  function invalidate(){analyzedPeriodId="";hide(els.guard);if(window.CargaApp&&typeof window.CargaApp.invalidateAnalysis==="function"){window.CargaApp.invalidateAnalysis();}setText("cargaEstadoPill","Sin analizar");if(els.statusPill){els.statusPill.className="carga-chip is-warn";}updateControls();}
  function handleFile(file){selectedFile=file||null;setText("cargaFileInfo",file?file.name+" · "+Math.max(1,Math.round((file.size||0)/1024))+" KB":"Ninguno seleccionado");invalidate();}
  function analyze(){
    var period=selectedLoad();if(!period||!selectedFile){showMessage("warning","Selecciona un período y un archivo.");return;}
    if(!window.CargaApp){showMessage("error","CargaApp no está disponible.");return;}
    setBusy(true,"Analizando");
    window.CargaApp.readFile(selectedFile,{periodoId:period.id,periodoLabel:period.label,periodoCanonicoId:period.id,periodoCanonicoLabel:period.label,localOnly:true,sync:false})
      .then(function(){renderValidation();return window.CargaApp.compareWithPeriod(period);})
      .then(function(guard){renderGuard(guard);setText("cargaEstadoPill",guard.ok?"Listo para guardar":"Bloqueado");if(els.statusPill){els.statusPill.className="carga-chip "+(guard.ok?"is-ok":"is-danger");}})
      .catch(function(error){showMessage("error",error.message||String(error));invalidate();})
      .finally(function(){setBusy(false);});
  }
  function save(){
    var period=selectedLoad();if(!period||!window.CargaApp){return;}setBusy(true,"Guardando");
    window.CargaApp.save({periodoId:period.id,periodoLabel:period.label,periodoCanonicoId:period.id,periodoCanonicoLabel:period.label,localOnly:true,sync:false,markRetired:true})
      .then(function(result){if(!result||result.ok===false){throw new Error(result&&result.message||"La carga no fue guardada.");}showMessage("success","Carga guardada. Nuevos: "+num(result.saved)+". Actualizados: "+num(result.updated)+".");return refreshPeriods();})
      .then(function(){return loadSummary(period);}).then(function(){handleFile(null);if(els.file){els.file.value="";}})
      .catch(function(error){showMessage("error",error.message||String(error));})
      .finally(function(){setBusy(false);});
  }
  function loadSummary(period){
    if(!period){setText("cargaStatStudents","0");setText("cargaStatCareers","0");setText("cargaStatDivisions","0");setText("cargaStatLastLoad","—");return Promise.resolve([]);}
    setText("cargaResumenPeriodo",period.label);
    return ensureConnector().then(function(con){return Promise.all([con.listStudents({periodoId:period.id,matricula:""}),typeof con.listCareers==="function"?con.listCareers(period.id):[],typeof con.listDivisions==="function"?con.listDivisions(period.id):[]]);})
      .then(function(values){var students=Array.isArray(values[0])?values[0]:[];var careers=Array.isArray(values[1])?values[1]:[];var divisions=Array.isArray(values[2])?values[2]:[];setText("cargaStatStudents",students.length);setText("cargaStatCareers",careers.length);setText("cargaStatDivisions",divisions.length);setText("cargaDivisionesCount",divisions.length+" divisiones");setText("cargaStatLastLoad",period.updatedAt?new Date(period.updatedAt).toLocaleDateString("es-EC"):"—");return students;});
  }
  function loadDeleteSummary(period){
    if(!period){setText("cargaBorrarResumen","Seleccione un período para revisar lo que se borrará.");return Promise.resolve([]);}
    return ensureConnector().then(function(con){return con.listStudents({periodoId:period.id,matricula:""});}).then(function(rows){rows=Array.isArray(rows)?rows:[];setText("cargaBorrarResumen",period.label+": "+rows.length+" estudiantes registrados.");return rows;}).catch(function(){setText("cargaBorrarResumen",period.label+": no se pudo consultar la cantidad de estudiantes.");return [];});
  }
  function onPeriodChange(){
    var period=selectedLoad();if(period){storageSet(LS_PERIODO,period.id);storageSet(LS_LABEL,period.label);}else{try{localStorage.removeItem(LS_PERIODO);localStorage.removeItem(LS_LABEL);}catch(error){}}
    invalidate();loadSummary(period);emit("bl2:period-change",period?{periodoId:period.id,periodoLabel:period.label,source:"CargaUI-ConCarga"}:{});
  }
  function deleteStudents(){
    var period=selectedDelete();if(!period||!confirm("¿Borrar todos los estudiantes de "+period.label+"?")){return;}
    setBusy(true,"Borrando estudiantes");window.CargaApp.deleteStudentsByPeriod(period).then(function(result){showMessage("success","Estudiantes borrados: "+num(result&&result.deleted)+".");return loadDeleteSummary(period);}).then(function(){return loadSummary(period);}).catch(function(error){showMessage("error",error.message||String(error));}).finally(function(){setBusy(false);});
  }
  function deletePeriod(){
    var period=selectedDelete();if(!period||!confirm("¿Borrar completamente el período "+period.label+"?")){return;}
    setBusy(true,"Borrando período");window.CargaApp.deletePeriod(period).then(function(){periods=periods.filter(function(item){return item.id!==period.id;});storageSet(LS_PERIODOS,periods);renderSelectors();showMessage("success","Período borrado completamente.");}).catch(function(error){showMessage("error",error.message||String(error));}).finally(function(){setBusy(false);});
  }
  function updateControls(){
    var load=selectedLoad(),division=selectedDiv(),del=selectedDelete();
    if(els.analyze){els.analyze.disabled=busy||!load||!selectedFile;}
    if(els.save){els.save.disabled=busy||!load||analyzedPeriodId!==load.id||!(window.CargaApp&&window.CargaApp.canSave&&window.CargaApp.canSave(load));}
    if(els.divButton){els.divButton.disabled=busy||!division;}
    if(els.deleteStudents){els.deleteStudents.disabled=busy||!del;}
    if(els.deletePeriod){els.deletePeriod.disabled=busy||!del;}
  }
  function mapElements(){
    els.fromMonth=byId("cargaPeriodoDesdeMes");els.fromYear=byId("cargaPeriodoDesdeAnio");els.toMonth=byId("cargaPeriodoHastaMes");els.toYear=byId("cargaPeriodoHastaAnio");els.create=byId("cargaBtnPeriodoCrear");
    els.periodo=byId("cargaPeriodoSelect");els.file=byId("cargaArchivoInput");els.drop=byId("cargaDropzone");els.analyze=byId("cargaBtnAnalizar");els.save=byId("cargaBtnGuardar");els.clear=byId("cargaBtnLimpiar");els.statusPill=byId("cargaEstadoPill");
    els.guard=byId("cargaGuardBox");els.guardChip=byId("cargaGuardChip");els.warnings=byId("cargaWarnings");els.errors=byId("cargaErrors");
    els.divPeriodo=byId("cargaDivisionesPeriodoSelect");els.divButton=byId("cargaBtnDivisionesPeriodo");els.deletePeriodo=byId("cargaBorrarPeriodoSelect");els.deleteStudents=byId("cargaBtnBorrarEstudiantes");els.deletePeriod=byId("cargaBtnBorrarPeriodoCompleto");els.message=byId("cargaMessageBox");els.toast=byId("cargaToast");
  }
  function bind(){
    if(els.create){els.create.addEventListener("click",createPeriod);}if(els.periodo){els.periodo.addEventListener("change",onPeriodChange);}if(els.file){els.file.addEventListener("change",function(){handleFile(this.files&&this.files[0]);});}
    if(els.drop){els.drop.addEventListener("dragover",function(event){event.preventDefault();});els.drop.addEventListener("drop",function(event){event.preventDefault();var file=event.dataTransfer&&event.dataTransfer.files&&event.dataTransfer.files[0];if(file){handleFile(file);}});}
    if(els.analyze){els.analyze.addEventListener("click",analyze);}if(els.save){els.save.addEventListener("click",save);}if(els.clear){els.clear.addEventListener("click",function(){if(els.file){els.file.value="";}handleFile(null);if(window.CargaState){window.CargaState.reset();}renderValidation();});}
    if(els.divPeriodo){els.divPeriodo.addEventListener("change",function(){var period=selectedDiv();storageSet(LS_DIV_PERIOD,period?period.id:"");setText("cargaDivisionesCount",period?(period.divisiones||[]).length+" divisiones":"0 divisiones");updateControls();});}
    if(els.divButton){els.divButton.addEventListener("click",function(){var period=selectedDiv();if(period&&window.CargaDivisionesPopup){window.CargaDivisionesPopup.open(period);}});}
    if(els.deletePeriodo){els.deletePeriodo.addEventListener("change",function(){loadDeleteSummary(selectedDelete());updateControls();});}
    if(els.deleteStudents){els.deleteStudents.addEventListener("click",deleteStudents);}if(els.deletePeriod){els.deletePeriod.addEventListener("click",deletePeriod);}
    window.addEventListener("carga:periods-refreshed",function(event){mergePeriods(event&&event.detail&&event.detail.periods||[]);renderSelectors();});
    window.addEventListener("carga:divisions-saved",function(){refreshPeriods().then(function(){return loadSummary(selectedLoad());});});
  }
  function boot(){
    mapElements();
    var year=new Date().getFullYear();
    if(els.fromMonth){els.fromMonth.innerHTML=MONTHS.map(function(item){return '<option value="'+item[0]+'">'+item[1]+'</option>';}).join("");els.fromMonth.value="04";}
    if(els.toMonth){els.toMonth.innerHTML=MONTHS.map(function(item){return '<option value="'+item[0]+'">'+item[1]+'</option>';}).join("");els.toMonth.value="09";}
    if(els.fromYear){els.fromYear.value=year;}if(els.toYear){els.toYear.value=year;}
    mergePeriods([]);renderSelectors();bind();renderValidation();
    var wait=window.CargaConnectionIndex&&typeof window.CargaConnectionIndex.ensureConnector==="function"?window.CargaConnectionIndex.ensureConnector():ensureConnector();
    Promise.resolve(wait).then(refreshPeriods).then(function(){var selected=text(storageGet(LS_PERIODO,""));if(els.periodo&&periodById(selected)){els.periodo.value=selected;onPeriodChange();}return loadDeleteSummary(selectedDelete());}).then(function(){showMessage("success","Carga conectada mediante ConCarga.");}).catch(function(error){showMessage("error",error.message||String(error));});
  }
  window.CargaUI={version:"3.0.0-concarga-only",refreshPeriods:refreshPeriods,updateControls:updateControls};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);