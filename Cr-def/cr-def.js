/* =========================================================
Nombre completo: cr-def.js
Ruta: /Requisitos/Cr-def/cr-def.js
Función:
- Cargar estudiantes aptos desde BDLocal.
- Permitir fecha por carrera y hora/responsables/aula por estudiante.
- Guardar automáticamente cambios parciales del cronograma.
- Reutilizar nombres de tribunales e investigadores con autocompletado.
========================================================= */
(function(window,document){
  "use strict";

  var APP_NAME="Cr-def";
  var VERSION="bloque-8-editor-manual";
  var PEOPLE_KEY="CR_DEF_PERSONAS_V1";
  var state={
    periodo:"",
    periodos:[],
    busqueda:"",
    filtros:{carrera:"",sede:"",estado:""},
    rows:[],
    loading:false,
    cacheStale:false,
    firmaActual:null
  };
  var els={};
  var people=[];

  function $(selector){return document.querySelector(selector);}
  function text(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function norm(value){return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
  function rowIdentity(row){row=row||{};return [row.periodoId,row.cedula,row.intento||1].map(text).join("__");}
  function escapeHtml(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function unique(values){
    var seen=Object.create(null),out=[];
    (values||[]).forEach(function(value){
      value=text(value);var key=norm(value);
      if(value&&!seen[key]){seen[key]=true;out.push(value);}
    });
    return out;
  }

  function bindDom(){
    els.periodo=$("[data-cr-periodo]");
    els.busqueda=$("[data-cr-busqueda]");
    els.filtroCarrera=$("[data-cr-filtro-carrera]");
    els.filtroSede=$("[data-cr-filtro-sede]");
    els.filtroEstado=$("[data-cr-filtro-estado]");
    els.tablaBody=$("[data-cr-tabla-body]");
    els.cacheStatus=$("[data-cr-cache-status]");
    els.alerta=$("[data-cr-alerta-principal]");
    els.statusPanel=$("[data-cr-status-panel]");
    els.btnActualizar=$("[data-cr-actualizar]");
    els.btnExportar=$("[data-cr-exportar]");
    els.saveStatus=$("[data-cr-save-status]");
    els.peopleCatalog=$("[data-cr-people-catalog]");
  }

  function setAlert(kind,title,message){
    if(!els.alerta||!els.statusPanel)return;
    if(!kind||kind==="info"){
      els.statusPanel.hidden=true;
      els.alerta.textContent="";
      return;
    }
    els.statusPanel.hidden=false;
    els.alerta.className="cr-alert cr-alert--"+(kind==="danger"?"danger":"warn");
    els.alerta.innerHTML="<strong>"+escapeHtml(title||"Aviso")+"</strong> "+escapeHtml(message||"");
  }

  function setSaveStatus(message,type){
    if(!els.saveStatus)return;
    els.saveStatus.textContent=message||"Guardado automático";
    els.saveStatus.className="cr-save-status"+(type?" is-"+type:"");
  }

  function setCacheStatus(message){if(els.cacheStatus)els.cacheStatus.textContent=message||"";}

  function createOption(value,label){
    var option=document.createElement("option");
    option.value=value;option.textContent=label;
    return option;
  }

  function setSelectOptions(select,values,firstLabel){
    if(!select)return;
    var current=select.value;
    select.innerHTML="";
    select.appendChild(createOption("",firstLabel||"Todas"));
    (values||[]).forEach(function(value){if(text(value))select.appendChild(createOption(value,value));});
    select.value=current;
    if(select.value!==current)select.value="";
  }

  function updateButtons(){
    var hasPeriodo=!!state.periodo;
    var hasData=!!(window.CR_DEF_DATA&&window.CR_DEF_DATA.dbAvailable&&window.CR_DEF_DATA.dbAvailable());
    if(els.btnActualizar)els.btnActualizar.disabled=state.loading||!hasPeriodo||!hasData;
    if(els.btnExportar)els.btnExportar.disabled=state.loading||!hasPeriodo||!state.rows.length;
  }

  function setLoading(value){
    state.loading=!!value;
    updateButtons();
  }

  function loadPeople(){
    var list=[];
    try{
      var saved=JSON.parse(window.localStorage.getItem(PEOPLE_KEY)||"[]");
      if(Array.isArray(saved))list=list.concat(saved);
    }catch(error){}
    try{
      var groups=window.CR_DEF_TEMPLATES&&window.CR_DEF_TEMPLATES.tribunales||{};
      Object.keys(groups).forEach(function(key){
        (groups[key]||[]).forEach(function(item){
          list.push(item.tribunal1,item.tribunal2,item.investigador||item.tribunal3);
        });
      });
    }catch(error){}
    people=unique(list).sort(function(a,b){return a.localeCompare(b,"es",{sensitivity:"base"});});
    renderPeopleCatalog();
  }

  function collectPeopleFromRows(rows){
    var list=people.slice();
    (rows||[]).forEach(function(row){list.push(row.tribunal1,row.tribunal2,row.investigador||row.tribunal3);});
    people=unique(list).sort(function(a,b){return a.localeCompare(b,"es",{sensitivity:"base"});});
    savePeople();
    renderPeopleCatalog();
  }

  function rememberPerson(value){
    value=text(value);
    if(!value)return;
    if(!people.some(function(item){return norm(item)===norm(value);})){
      people.push(value);
      people.sort(function(a,b){return a.localeCompare(b,"es",{sensitivity:"base"});});
      savePeople();
      renderPeopleCatalog();
    }
  }

  function savePeople(){
    try{window.localStorage.setItem(PEOPLE_KEY,JSON.stringify(people));}catch(error){}
  }

  function renderPeopleCatalog(){
    if(!els.peopleCatalog)return;
    els.peopleCatalog.innerHTML="";
    people.forEach(function(name){
      var option=document.createElement("option");
      option.value=name;
      els.peopleCatalog.appendChild(option);
    });
  }

  function canonicalDateToDisplay(iso){
    var m=text(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?m[3]+"/"+m[2]+"/"+m[1]:text(iso);
  }

  function displayDateToISO(value){
    var raw=text(value),iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/),dmy=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if(iso)return iso[1]+"-"+String(iso[2]).padStart(2,"0")+"-"+String(iso[3]).padStart(2,"0");
    if(dmy)return dmy[3]+"-"+String(dmy[2]).padStart(2,"0")+"-"+String(dmy[1]).padStart(2,"0");
    return "";
  }

  function todayISO(){
    var d=new Date();
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }

  function parseTimeStart(value){
    var m=text(value).match(/(\d{1,2}:\d{2})/);
    return m?m[1].padStart(5,"0"):"";
  }

  function minutesOf(value){
    var m=text(value).match(/^(\d{1,2}):(\d{2})$/);
    if(!m)return null;
    var h=Number(m[1]),min=Number(m[2]);
    return h>=0&&h<=23&&min>=0&&min<=59?h*60+min:null;
  }

  function formatMinutes(total){
    total=((Number(total)||0)%1440+1440)%1440;
    return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");
  }

  function durationForRow(row){
    var direct=Number(row&&row.duracionMinutos||0);
    if(Number.isFinite(direct)&&direct>0)return direct;
    try{
      var list=window.CR_DEF_TEMPLATES&&typeof window.CR_DEF_TEMPLATES.templatesPorCarrera==="function"
        ?window.CR_DEF_TEMPLATES.templatesPorCarrera(row&&row.carrera):[];
      var tpl=Array.isArray(list)&&list[0]||null;
      var value=Number(tpl&&tpl.duracionMinutos||0);
      if(Number.isFinite(value)&&value>0)return value;
    }catch(error){}
    return 30;
  }

  function buildRange(start,duration){
    var min=minutesOf(start);
    if(min===null)return "";
    duration=Number(duration||30);
    if(!Number.isFinite(duration)||duration<=0)duration=30;
    return formatMinutes(min)+"–"+formatMinutes(min+duration);
  }

  function dateSortKey(value){
    return displayDateToISO(value)||"9999-99-99";
  }

  function loadPeriods(){
    if(!window.CR_DEF_DATA||typeof window.CR_DEF_DATA.listarPeriodos!=="function"){
      setAlert("danger","BDLocal no disponible.","No se encontró el lector de datos de Cr-def.");
      return Promise.resolve([]);
    }
    return window.CR_DEF_DATA.listarPeriodos().then(function(periodos){
      state.periodos=Array.isArray(periodos)?periodos:[];
      if(els.periodo){
        els.periodo.innerHTML="";
        els.periodo.appendChild(createOption("","Seleccione período"));
        state.periodos.forEach(function(periodo){els.periodo.appendChild(createOption(periodo.id,periodo.label||periodo.id));});
      }
      var last=window.CR_DEF_CACHE&&typeof window.CR_DEF_CACHE.getLastPeriod==="function"?window.CR_DEF_CACHE.getLastPeriod():"";
      if(last&&state.periodos.some(function(periodo){return periodo.id===last;})){
        state.periodo=last;
        if(els.periodo)els.periodo.value=last;
        loadCacheForPeriod(last);
        window.setTimeout(actualizarAptos,0);
      }
      updateButtons();
      return state.periodos;
    }).catch(function(error){
      setAlert("danger","Error al cargar períodos.",error&&error.message?error.message:String(error));
      return [];
    });
  }

  function loadCacheForPeriod(periodoId){
    periodoId=text(periodoId);
    if(!periodoId){
      state.rows=[];
      setCacheStatus("");
      renderTable();
      return;
    }
    var cache=window.CR_DEF_CACHE&&typeof window.CR_DEF_CACHE.getPeriodCache==="function"?window.CR_DEF_CACHE.getPeriodCache(periodoId):null;
    if(cache&&Array.isArray(cache.rows)){
      state.rows=cache.rows;
      state.cacheStale=false;
      setCacheStatus("Datos locales");
      collectPeopleFromRows(state.rows);
      updateFiltersFromRows(state.rows);
      renderTable();
    }else{
      state.rows=[];
      setCacheStatus("Preparando");
      updateFiltersFromRows([]);
      renderTable();
    }
  }

  function preserveCurrentSchedule(nextRows){
    var current=Object.create(null);
    state.rows.forEach(function(row){current[rowIdentity(row)]=row;});
    return (nextRows||[]).map(function(row){
      var previous=current[rowIdentity(row)];
      if(!previous)return row;
      ["aula","dia","hora","sede","tribunal1","tribunal2","investigador","tribunal3","duracionMinutos","cronograma","cronogramaEstado"].forEach(function(key){
        if((row[key]==null||text(row[key])==="")&&previous[key]!=null&&text(previous[key])!=="")row[key]=previous[key];
      });
      row.investigador=text(row.investigador||row.tribunal3||"");
      row.tribunal3=row.investigador;
      return row;
    });
  }

  function actualizarAptos(){
    if(!state.periodo||!window.CR_DEF_DATA||typeof window.CR_DEF_DATA.cargarAptos!=="function")return;
    setLoading(true);
    setSaveStatus("Actualizando datos…","saving");
    window.CR_DEF_DATA.cargarAptos(state.periodo).then(function(result){
      result=result||{};
      state.rows=preserveCurrentSchedule(Array.isArray(result.rows)?result.rows:[]);
      state.firmaActual=result.firma||null;
      state.cacheStale=false;
      normalizeScheduleStates();
      collectPeopleFromRows(state.rows);
      updateFiltersFromRows(state.rows);
      saveCache("BDLocal");
      setCacheStatus("Actualizado");
      renderTable();
      setAlert("info","","");
      setSaveStatus("Guardado automático","ok");
    }).catch(function(error){
      setAlert("danger","Error al actualizar.",error&&error.message?error.message:String(error));
      setSaveStatus("Error de actualización","error");
    }).finally(function(){setLoading(false);});
  }

  function updateFiltersFromRows(rows){
    var carreras=unique((rows||[]).map(function(row){return row.carrera;})).sort(function(a,b){return a.localeCompare(b,"es");});
    var sedes=unique((rows||[]).map(function(row){return row.sede;})).sort(function(a,b){return a.localeCompare(b,"es");});
    setSelectOptions(els.filtroCarrera,carreras,"Todas");
    setSelectOptions(els.filtroSede,sedes,"Todas");
  }

  function rowMatches(row){
    var haystack=norm([row.aula,row.dia,row.hora,row.sede,row.cedula,row.nombre,row.carrera,row.notaArticulo,row.tribunal1,row.tribunal2,row.investigador||row.tribunal3,row.estado,(row.alertas||[]).join(" ")].join(" "));
    if(state.busqueda&&haystack.indexOf(norm(state.busqueda))===-1)return false;
    if(state.filtros.carrera&&norm(row.carrera)!==norm(state.filtros.carrera))return false;
    if(state.filtros.sede&&norm(row.sede)!==norm(state.filtros.sede))return false;
    if(state.filtros.estado&&norm(row.estadoClave)!==norm(state.filtros.estado))return false;
    return true;
  }

  function normalizeScheduleStates(){
    state.rows=state.rows.map(function(row){
      var scheduled=!!(text(row.dia)&&text(row.hora));
      if(scheduled){
        row.estadoClave="programado";
        row.estado="Defensa programada";
      }else if(row.estadoClave==="programado"||row.estadoClave==="conflicto"||row.estadoClave==="sin-cupo"){
        row.estadoClave=String(row.tipoDefensa||"").toUpperCase()==="SUPLETORIO"?"supletorio":"apto";
        row.estado=row.estadoClave==="supletorio"?"Supletorio / segunda defensa":"Apto para agendar";
      }
      row.investigador=text(row.investigador||row.tribunal3||"");
      row.tribunal3=row.investigador;
      return row;
    });
    if(window.CR_DEF_SCHEDULER&&typeof window.CR_DEF_SCHEDULER.detectarConflictos==="function"){
      state.rows=window.CR_DEF_SCHEDULER.detectarConflictos(state.rows);
    }
  }

  function saveCache(source){
    if(!state.periodo||!window.CR_DEF_CACHE||typeof window.CR_DEF_CACHE.savePeriodCache!=="function")return;
    window.CR_DEF_CACHE.savePeriodCache(state.periodo,{
      rows:state.rows,
      firma:state.firmaActual||null,
      source:source||"manual"
    });
  }

  function persistRows(rows){
    rows=Array.isArray(rows)?rows:[];
    saveCache("manual");
    if(!rows.length||!window.CR_DEF_DATA||typeof window.CR_DEF_DATA.guardarCronograma!=="function")return Promise.resolve([]);
    setSaveStatus("Guardando…","saving");
    return window.CR_DEF_DATA.guardarCronograma(rows).then(function(saved){
      setSaveStatus("Guardado","ok");
      setCacheStatus("Guardado");
      return saved;
    }).catch(function(error){
      setSaveStatus("Error al guardar","error");
      setAlert("danger","No se pudo guardar.",error&&error.message?error.message:String(error));
      throw error;
    });
  }

  function findRow(key){
    return state.rows.find(function(row){return rowIdentity(row)===key;})||null;
  }

  function applyRowField(key,field,value){
    var row=findRow(key);
    if(!row)return;
    if(field==="hora"){
      row.duracionMinutos=durationForRow(row);
      row.hora=value?buildRange(value,row.duracionMinutos):"";
    }else if(field==="investigador"){
      row.investigador=text(value);row.tribunal3=row.investigador;rememberPerson(value);
    }else{
      row[field]=text(value);
      if(field==="tribunal1"||field==="tribunal2")rememberPerson(value);
    }
    normalizeScheduleStates();
    var updated=findRow(key);
    renderTable();
    persistRows(updated?[updated]:[]);
  }

  function careerRows(carrera){
    return state.rows.filter(function(row){return norm(row.carrera)===norm(carrera);});
  }

  function applyCareerDate(carrera,iso){
    var display=iso?canonicalDateToDisplay(iso):"";
    var changed=[];
    state.rows.forEach(function(row){
      if(norm(row.carrera)===norm(carrera)){
        row.dia=display;
        changed.push(row);
      }
    });
    normalizeScheduleStates();
    renderTable();
    persistRows(changed.map(function(row){return findRow(rowIdentity(row))||row;}));
  }

  function commonCareerDate(rows){
    var dates=unique((rows||[]).map(function(row){return displayDateToISO(row.dia);}).filter(Boolean));
    return dates.length===1?dates[0]:"";
  }

  function emptyRow(message){
    var tr=document.createElement("tr");
    tr.className="cr-empty-row";
    var td=document.createElement("td");
    td.colSpan=9;td.textContent=message;
    tr.appendChild(td);
    return tr;
  }

  function careerRow(carrera,rows){
    var tr=document.createElement("tr");
    tr.className="cr-career-row";
    var td=document.createElement("td");td.colSpan=9;
    var wrap=document.createElement("div");wrap.className="cr-career-bar";
    var title=document.createElement("strong");title.className="cr-career-name";title.textContent=carrera||"SIN CARRERA";
    var controls=document.createElement("div");controls.className="cr-career-date-controls";
    var label=document.createElement("span");label.textContent="Fecha";
    var input=document.createElement("input");input.type="date";input.className="cr-career-date";input.value=commonCareerDate(rows);input.setAttribute("data-career-date",carrera);
    input.title="Aplica esta fecha a todos los estudiantes de la carrera";
    var today=document.createElement("button");today.type="button";today.className="cr-mini-btn";today.textContent="Hoy";today.setAttribute("data-career-today",carrera);
    controls.appendChild(label);controls.appendChild(input);controls.appendChild(today);
    wrap.appendChild(title);wrap.appendChild(controls);td.appendChild(wrap);tr.appendChild(td);
    return tr;
  }

  function textCell(value,className){
    var td=document.createElement("td");
    if(className)td.className=className;
    td.textContent=text(value)||"";
    return td;
  }

  function inputCell(row,field,type,listId){
    var td=document.createElement("td");
    var input=document.createElement("input");
    input.type=type||"text";
    input.className="cr-inline-input";
    input.setAttribute("data-row-key",rowIdentity(row));
    input.setAttribute("data-field",field);
    if(listId)input.setAttribute("list",listId);
    if(field==="hora"){
      input.value=parseTimeStart(row.hora);
      input.step="1800";
      input.title=text(row.hora)||"Hora de inicio";
    }else{
      input.value=text(row[field]||(field==="investigador"?row.tribunal3:""));
    }
    td.appendChild(input);
    return td;
  }

  function renderRow(row){
    var tr=document.createElement("tr");
    tr.setAttribute("data-cr-row-key",rowIdentity(row));
    if(row.estadoClave==="conflicto")tr.className="cr-row--conflicto";
    else if(!text(row.dia)||!text(row.hora))tr.className="cr-row--pending";
    if(Array.isArray(row.alertas)&&row.alertas.length)tr.title=row.alertas.join("\n");

    tr.appendChild(textCell(row.dia,"cr-col-day"));
    tr.appendChild(inputCell(row,"hora","time"));
    tr.appendChild(textCell(row.sede));
    tr.appendChild(textCell(row.nombre,"cr-col-name"));
    tr.appendChild(textCell(row.carrera,"cr-col-career"));
    tr.appendChild(inputCell(row,"tribunal1","text","crPeopleCatalog"));
    tr.appendChild(inputCell(row,"tribunal2","text","crPeopleCatalog"));
    tr.appendChild(inputCell(row,"investigador","text","crPeopleCatalog"));
    tr.appendChild(inputCell(row,"aula","text"));
    return tr;
  }

  function renderTable(){
    if(!els.tablaBody)return;
    var rows=state.rows.filter(rowMatches);
    els.tablaBody.innerHTML="";
    if(!state.periodo){
      els.tablaBody.appendChild(emptyRow("Selecciona un período."));
      return;
    }
    if(!rows.length){
      els.tablaBody.appendChild(emptyRow(state.rows.length?"No hay resultados con los filtros actuales.":"No hay estudiantes aptos para este período."));
      return;
    }
    rows.sort(function(a,b){
      var career=text(a.carrera).localeCompare(text(b.carrera),"es",{sensitivity:"base"});
      if(career!==0)return career;
      return [dateSortKey(a.dia),parseTimeStart(a.hora),text(a.nombre)].join("|").localeCompare([dateSortKey(b.dia),parseTimeStart(b.hora),text(b.nombre)].join("|"),"es",{numeric:true,sensitivity:"base"});
    });

    var groups=[],map=Object.create(null);
    rows.forEach(function(row){
      var key=norm(row.carrera)||"sin_carrera";
      if(!map[key]){map[key]={carrera:text(row.carrera)||"SIN CARRERA",rows:[]};groups.push(map[key]);}
      map[key].rows.push(row);
    });

    groups.forEach(function(group){
      els.tablaBody.appendChild(careerRow(group.carrera,group.rows));
      group.rows.forEach(function(row){els.tablaBody.appendChild(renderRow(row));});
    });
  }

  function bindEvents(){
    if(els.periodo)els.periodo.addEventListener("change",function(){
      state.periodo=text(els.periodo.value);
      state.rows=[];state.firmaActual=null;
      if(window.CR_DEF_CACHE&&typeof window.CR_DEF_CACHE.setLastPeriod==="function")window.CR_DEF_CACHE.setLastPeriod(state.periodo);
      loadCacheForPeriod(state.periodo);
      if(state.periodo)actualizarAptos();
      updateButtons();
    });
    if(els.busqueda)els.busqueda.addEventListener("input",function(){state.busqueda=text(els.busqueda.value);renderTable();});
    if(els.filtroCarrera)els.filtroCarrera.addEventListener("change",function(){state.filtros.carrera=text(els.filtroCarrera.value);renderTable();});
    if(els.filtroSede)els.filtroSede.addEventListener("change",function(){state.filtros.sede=text(els.filtroSede.value);renderTable();});
    if(els.filtroEstado)els.filtroEstado.addEventListener("change",function(){state.filtros.estado=text(els.filtroEstado.value);renderTable();});
    if(els.btnActualizar)els.btnActualizar.addEventListener("click",actualizarAptos);

    if(els.tablaBody){
      els.tablaBody.addEventListener("change",function(event){
        var input=event.target;
        if(input.matches("[data-career-date]")){
          applyCareerDate(input.getAttribute("data-career-date"),input.value);
          return;
        }
        if(input.matches(".cr-inline-input[data-row-key][data-field]")){
          applyRowField(input.getAttribute("data-row-key"),input.getAttribute("data-field"),input.value);
        }
      });
      els.tablaBody.addEventListener("click",function(event){
        var button=event.target.closest("[data-career-today]");
        if(!button)return;
        applyCareerDate(button.getAttribute("data-career-today"),todayISO());
      });
      els.tablaBody.addEventListener("keydown",function(event){
        if(event.key==="Enter"&&event.target.matches(".cr-inline-input")){
          event.preventDefault();
          event.target.blur();
        }
      });
    }
  }

  function exposeApi(){
    window.CR_DEF_APP={
      name:APP_NAME,
      version:VERSION,
      state:state,
      render:renderTable,
      actualizarAptos:actualizarAptos,
      updateButtons:updateButtons,
      setRows:function(rows){
        state.rows=Array.isArray(rows)?rows:[];
        normalizeScheduleStates();
        collectPeopleFromRows(state.rows);
        updateFiltersFromRows(state.rows);
        renderTable();
        updateButtons();
      },
      saveRows:persistRows,
      rememberPerson:rememberPerson
    };
  }

  function init(){
    bindDom();
    loadPeople();
    bindEvents();
    exposeApi();
    if(!window.CR_DEF_DATA||!window.CR_DEF_DATA.dbAvailable||!window.CR_DEF_DATA.dbAvailable()){
      setAlert("danger","BDLocal no disponible.","ConCrDef no quedó disponible para esta pantalla.");
      setCacheStatus("Sin conexión");
      updateButtons();
      return;
    }
    setAlert("info","","");
    setCacheStatus("Listo");
    loadPeriods().then(function(){renderTable();updateButtons();});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})(window,document);
