/* =========================================================
Nombre completo: carga.divisiones.popup.js
Ruta o ubicación: /Carga/carga.divisiones.popup.js
Función o funciones:
- Administrar divisiones y carreras desde un popup.
- Leer estudiantes, carreras y divisiones exclusivamente mediante ConCarga.
- Guardar período y asignaciones exclusivamente mediante ConCarga.saveDivisions.
Con qué se conecta:
- ../BDLocal/conexiones/cone.carga.js
- ../BDLocal/conexiones/cone.carga.ops.js
========================================================= */
(function(window,document){
  "use strict";

  var LS_PERIODOS="carga.periodos.local";
  var LS_DIVISIONES="carga.periodos.divisiones";
  var state={period:null,periods:[],careers:[],divisions:[],selectedDivisionId:"",draggedCareerId:"",dirty:false,busy:false};

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").toLowerCase();}
  function key(value){return norm(value).replace(/[^a-z0-9]+/g,"");}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function storageGet(name,fallback){try{var raw=localStorage.getItem(name);return raw?JSON.parse(raw):fallback;}catch(error){return fallback;}}
  function storageSet(name,value){try{localStorage.setItem(name,JSON.stringify(value));return true;}catch(error){return false;}}
  function canon(value){
    value=text(value);var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function ensure(){
    var con=connector();
    if(!con){return Promise.reject(new Error("ConCarga no está cargado."));}
    return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(result){
      if(result&&result.ok===false){throw new Error(result.error||"ConCarga no está listo.");}
      if(typeof con.listStudents!=="function"||typeof con.saveDivisions!=="function"){throw new Error("ConCarga no tiene activa la API de divisiones.");}
      return con;
    });
  }
  function normalizePeriod(period){
    period=period||{};var id=canon(period.periodoCanonicoId||period.periodoId||period.id||period.value||"");
    if(!id){return null;}
    var label=text(period.periodoCanonicoLabel||period.periodoLabel||period.label||period.nombre||id);
    return Object.assign({},period,{id:id,periodoId:id,periodoCanonicoId:id,label:label,periodoLabel:label,periodoCanonicoLabel:label,divisiones:Array.isArray(period.divisiones)?period.divisiones:[],carrerasDetectadas:Array.isArray(period.carrerasDetectadas)?period.carrerasDetectadas:[]});
  }
  function normalizeCareer(item){
    if(!item){return null;}
    if(typeof item==="string"){item={nombre:item};}
    var name=text(item.nombre||item.nombreCarrera||item.NombreCarrera||item.carrera||item.Carrera||item.label||"");
    var code=text(item.codigo||item.codigoCarrera||item.CodigoCarrera||"");
    var id=text(item.id||code||key(name));
    if(!id&&!name){return null;}
    return {id:id||key(name),codigo:code,nombre:name||code||id,total:Number(item.total||item.estudiantes||0)||0};
  }
  function uniqueCareers(list){
    var map={};
    (Array.isArray(list)?list:[]).forEach(function(item){
      var career=normalizeCareer(item);if(!career||!career.id){return;}
      map[career.id]=Object.assign({},map[career.id]||{},career,{total:Math.max(Number(map[career.id]&&map[career.id].total||0),career.total||0)});
    });
    return Object.keys(map).map(function(id){return map[id];}).sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es");});
  }
  function normalizeDivision(item){
    if(typeof item==="string"){item={nombre:item};}item=item||{};
    var name=text(item.nombre||item.label||item.name||item.id||"");var id=text(item.id||key(name));
    if(!id&&!name){return null;}
    return {id:id||key(name),nombre:name||id,carreras:uniqueCareers(item.carreras||[]),createdAt:item.createdAt||now(),updatedAt:item.updatedAt||now()};
  }
  function mergeDivisions(){
    var map={};
    Array.prototype.slice.call(arguments).forEach(function(list){
      (Array.isArray(list)?list:[]).forEach(function(item){
        var division=normalizeDivision(item);if(!division){return;}
        map[division.id]=Object.assign({},map[division.id]||{},division,{carreras:uniqueCareers([].concat(map[division.id]&&map[division.id].carreras||[],division.carreras||[]))});
      });
    });
    return Object.keys(map).map(function(id){return map[id];}).sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es");});
  }
  function localPeriods(){return (storageGet(LS_PERIODOS,[])||[]).map(normalizePeriod).filter(Boolean);}
  function selectedDivision(){return state.divisions.filter(function(item){return item.id===state.selectedDivisionId;})[0]||null;}
  function assignedMap(){var map={};state.divisions.forEach(function(d){(d.carreras||[]).forEach(function(c){map[c.id]=d.id;});});return map;}
  function showMessage(type,message){
    var box=document.getElementById("cargaMessageBox");if(!box){return;}
    box.className="carga-message is-"+(type||"success");box.textContent=message||"";box.classList.remove("carga-hidden");
    clearTimeout(box.__timer);box.__timer=setTimeout(function(){box.classList.add("carga-hidden");},5000);
  }
  function ensurePopup(){
    var node=document.getElementById("cargaDivisionesPopupV3");if(node){return node;}
    node=document.createElement("div");node.id="cargaDivisionesPopupV3";node.className="cdp-overlay";
    node.innerHTML='<section class="cdp-dialog" role="dialog" aria-modal="true" aria-labelledby="cdpTitle"><header class="cdp-head"><div><h2 id="cdpTitle">Divisiones</h2><small id="cdpSubtitle">Selecciona un período.</small></div><button type="button" class="cdp-close" data-cdp-exit>×</button></header><div class="cdp-body"><div class="cdp-toolbar"><label><span>Período</span><select id="cdpPeriod"></select></label><label><span>División seleccionada</span><select id="cdpDivision"></select></label><label><span>Nombre</span><input id="cdpDivisionName" maxlength="80" placeholder="Nombre de división"></label><button type="button" class="carga-btn carga-btn-primary" id="cdpCreate">Crear</button><button type="button" class="carga-btn" id="cdpRename">Editar</button><button type="button" class="carga-btn carga-btn-danger-soft" id="cdpDelete">Borrar</button></div><div class="cdp-grid"><section class="cdp-panel" id="cdpAvailablePanel"><h3>Carreras disponibles</h3><small>Solo aparecen carreras que todavía no tienen división.</small><div class="cdp-list" id="cdpAvailable"></div></section><section class="cdp-panel" id="cdpAssignedPanel"><h3 id="cdpAssignedTitle">Carreras de la división</h3><small>Arrastra aquí, retira o mueve una carrera directamente.</small><div class="cdp-list" id="cdpAssigned"></div></section></div></div><footer class="cdp-foot"><button type="button" class="carga-btn" data-cdp-exit>Salir</button><button type="button" class="carga-btn carga-btn-primary" id="cdpSave">Guardar cambios</button></footer></section>';
    document.body.appendChild(node);bindEvents(node);return node;
  }
  function renderPeriodSelect(){
    var select=document.getElementById("cdpPeriod");if(!select){return;}
    select.innerHTML='<option value="">Seleccione...</option>'+state.periods.map(function(period){return '<option value="'+esc(period.id)+'">'+esc(period.label)+'</option>';}).join("");
    select.value=state.period?state.period.id:"";
  }
  function renderDivisionSelect(){
    var select=document.getElementById("cdpDivision");if(!select){return;}
    select.innerHTML='<option value="">Seleccione...</option>'+state.divisions.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.nombre)+'</option>';}).join("");
    select.value=state.selectedDivisionId;var selected=selectedDivision();
    document.getElementById("cdpDivisionName").value=selected?selected.nombre:"";
    document.getElementById("cdpAssignedTitle").textContent=selected?"Carreras de "+selected.nombre:"Carreras de la división";
  }
  function careerHtml(career,assigned){
    var options='<option value="">Mover a...</option>'+state.divisions.filter(function(d){return d.id!==state.selectedDivisionId;}).map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.nombre)+'</option>';}).join("");
    return '<article class="cdp-career" draggable="true" data-career-id="'+esc(career.id)+'"><div><strong>'+esc(career.nombre)+'</strong><small>'+(career.total?career.total+' estudiantes':esc(career.codigo||""))+'</small></div>'+(assigned?'<div class="cdp-career-actions"><select data-move-career="'+esc(career.id)+'">'+options+'</select><button type="button" data-remove-career="'+esc(career.id)+'">Retirar</button></div>':'<span class="carga-chip">Arrastrar</span>')+'</article>';
  }
  function renderCareers(){
    var assigned=assignedMap();var selected=selectedDivision();var available=state.careers.filter(function(c){return !assigned[c.id];});
    var availableBox=document.getElementById("cdpAvailable");var assignedBox=document.getElementById("cdpAssigned");
    availableBox.innerHTML=available.length?available.map(function(c){return careerHtml(c,false);}).join(""):'<div class="cdp-empty">Todas las carreras ya tienen división.</div>';
    assignedBox.innerHTML=selected&&selected.carreras.length?selected.carreras.map(function(c){return careerHtml(c,true);}).join(""):'<div class="cdp-empty">Selecciona una división o arrastra carreras aquí.</div>';
  }
  function render(){renderPeriodSelect();renderDivisionSelect();renderCareers();var subtitle=document.getElementById("cdpSubtitle");if(subtitle){subtitle.textContent=state.period?state.period.label:"Selecciona un período.";}}
  function loadPeriods(){
    return ensure().then(function(con){return typeof con.getPeriods==="function"?con.getPeriods():[];}).then(function(rows){
      var map={};localPeriods().concat(Array.isArray(rows)?rows:[]).forEach(function(item){item=normalizePeriod(item);if(item){map[item.id]=Object.assign({},map[item.id]||{},item);}});
      state.periods=Object.keys(map).map(function(id){return map[id];});return state.periods;
    });
  }
  function loadPeriod(period){
    period=normalizePeriod(period);if(!period){return Promise.reject(new Error("Selecciona un período."));}
    state.busy=true;state.period=period;state.selectedDivisionId="";
    return ensure().then(function(con){return Promise.all([con.listStudents({periodoId:period.id,matricula:""}),con.listDivisions(period.id),con.listCareers(period.id)]);})
      .then(function(values){
        var students=Array.isArray(values[0])?values[0]:[];var counts={};var fromStudents=[];
        students.forEach(function(row){var c=normalizeCareer(row);if(!c){return;}counts[c.id]=(counts[c.id]||0)+1;fromStudents.push(c);});
        fromStudents=uniqueCareers(fromStudents).map(function(c){c.total=counts[c.id]||0;return c;});
        state.divisions=mergeDivisions(period.divisiones||[],values[1]||[]);
        state.careers=uniqueCareers([].concat(period.carrerasDetectadas||[],values[2]||[],fromStudents,state.divisions.reduce(function(all,d){return all.concat(d.carreras||[]);},[])));
        state.selectedDivisionId=state.divisions[0]?state.divisions[0].id:"";state.dirty=false;state.busy=false;render();return period;
      }).catch(function(error){state.busy=false;throw error;});
  }
  function uniqueDivisionId(name){var base=key(name)||"division";var id=base;var index=2;while(state.divisions.some(function(d){return d.id===id;})){id=base+"_"+index;index+=1;}return id;}
  function createDivision(){var input=document.getElementById("cdpDivisionName");var name=text(input.value);if(!name){showMessage("warning","Escribe el nombre de la división.");return;}var d={id:uniqueDivisionId(name),nombre:name,carreras:[],createdAt:now(),updatedAt:now()};state.divisions.push(d);state.selectedDivisionId=d.id;state.dirty=true;render();}
  function renameDivision(){var d=selectedDivision();var name=text(document.getElementById("cdpDivisionName").value);if(!d){showMessage("warning","Selecciona una división.");return;}if(!name){showMessage("warning","Escribe un nombre.");return;}d.nombre=name;d.updatedAt=now();state.dirty=true;render();}
  function deleteDivision(){var d=selectedDivision();if(!d){showMessage("warning","Selecciona una división.");return;}if(!confirm('¿Borrar la división "'+d.nombre+'"?')){return;}state.divisions=state.divisions.filter(function(item){return item.id!==d.id;});state.selectedDivisionId=state.divisions[0]?state.divisions[0].id:"";state.dirty=true;render();}
  function findCareer(id){return state.careers.filter(function(c){return c.id===id;})[0]||null;}
  function removeEverywhere(id){state.divisions.forEach(function(d){d.carreras=(d.carreras||[]).filter(function(c){return c.id!==id;});});}
  function assign(id,divisionId){var career=findCareer(id);var division=state.divisions.filter(function(d){return d.id===divisionId;})[0];if(!career||!division){return;}removeEverywhere(id);division.carreras=uniqueCareers([].concat(division.carreras||[],[career]));division.updatedAt=now();state.dirty=true;render();}
  function remove(id){removeEverywhere(id);state.dirty=true;render();}
  function saveLocal(period){
    var store=storageGet(LS_DIVISIONES,{});store[period.id]={periodoId:period.id,divisiones:state.divisions,updatedAt:now()};storageSet(LS_DIVISIONES,store);
    var periods=localPeriods();var found=false;periods=periods.map(function(item){if(item.id!==period.id){return item;}found=true;return Object.assign({},item,period,{divisiones:state.divisions,carrerasDetectadas:state.careers,updatedAt:now()});});if(!found){periods.push(Object.assign({},period,{divisiones:state.divisions,carrerasDetectadas:state.careers,updatedAt:now()}));}storageSet(LS_PERIODOS,periods);
  }
  function saveAll(){
    if(!state.period||state.busy){return Promise.resolve(null);}state.busy=true;
    var period=Object.assign({},state.period,{divisiones:state.divisions,carrerasDetectadas:state.careers,updatedAt:now()});
    return ensure().then(function(con){return con.saveDivisions(period,state.divisions,state.careers);})
      .then(function(result){saveLocal(period);state.dirty=false;showMessage("success","Divisiones guardadas. Estudiantes actualizados: "+Number(result&&result.updated||0)+".");emit("carga:divisions-saved",{periodoId:period.id,divisiones:state.divisions.length,updated:Number(result&&result.updated||0),source:"ConCarga"});close(true);return result;})
      .catch(function(error){showMessage("error",error.message||String(error));throw error;})
      .finally(function(){state.busy=false;});
  }
  function open(period){
    var node=ensurePopup();node.classList.add("is-open");
    return loadPeriods().then(function(){period=normalizePeriod(period)||state.periods[0]||null;if(!period){render();showMessage("warning","Primero crea un período.");return null;}return loadPeriod(period);}).catch(function(error){showMessage("error",error.message||String(error));return null;});
  }
  function close(force){if(state.dirty&&!force&&!confirm("Hay cambios sin guardar. ¿Salir de todos modos?")){return;}var node=document.getElementById("cargaDivisionesPopupV3");if(node){node.classList.remove("is-open");}state.dirty=false;}
  function bindDrop(panel,onDrop){panel.addEventListener("dragover",function(event){event.preventDefault();panel.classList.add("is-over");});panel.addEventListener("dragleave",function(){panel.classList.remove("is-over");});panel.addEventListener("drop",function(event){event.preventDefault();panel.classList.remove("is-over");var id="";try{id=event.dataTransfer.getData("text/plain");}catch(error){}onDrop(id||state.draggedCareerId);});}
  function bindEvents(node){
    node.addEventListener("click",function(event){if(event.target===node||event.target.closest("[data-cdp-exit]")){close(false);return;}var removeButton=event.target.closest("[data-remove-career]");if(removeButton){remove(removeButton.getAttribute("data-remove-career"));}});
    node.addEventListener("dragstart",function(event){var item=event.target.closest("[data-career-id]");if(!item){return;}state.draggedCareerId=item.getAttribute("data-career-id");try{event.dataTransfer.setData("text/plain",state.draggedCareerId);}catch(error){}});
    document.getElementById("cdpPeriod").addEventListener("change",function(){var id=this.value;var period=state.periods.filter(function(item){return item.id===id;})[0];if(period){loadPeriod(period);}});
    document.getElementById("cdpDivision").addEventListener("change",function(){state.selectedDivisionId=this.value;renderDivisionSelect();renderCareers();});
    document.getElementById("cdpCreate").addEventListener("click",createDivision);document.getElementById("cdpRename").addEventListener("click",renameDivision);document.getElementById("cdpDelete").addEventListener("click",deleteDivision);document.getElementById("cdpSave").addEventListener("click",saveAll);
    document.getElementById("cdpAssigned").addEventListener("change",function(event){var select=event.target.closest("[data-move-career]");if(select&&select.value){assign(select.getAttribute("data-move-career"),select.value);}});
    bindDrop(document.getElementById("cdpAssignedPanel"),function(id){if(!state.selectedDivisionId){showMessage("warning","Selecciona una división.");return;}assign(id,state.selectedDivisionId);});
    bindDrop(document.getElementById("cdpAvailablePanel"),remove);
    document.addEventListener("keydown",function(event){if(event.key==="Escape"&&node.classList.contains("is-open")){close(false);}});
  }
  window.CargaDivisionesPopup={version:"2.0.0-concarga-only",open:open,close:close,save:saveAll,reload:function(){return state.period?loadPeriod(state.period):Promise.resolve(null);}};
})(window,document);