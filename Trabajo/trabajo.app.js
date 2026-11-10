/* =========================================================
Nombre completo: trabajo.app.js
Ruta: /Trabajo/trabajo.app.js
Función:
- Menú Notas → Trabajo: pegar una o varias actas SENESCYT de trabajo de
  titulación, validarlas contra BDLocal y guardarlas.
- Al elegir el período se lee BDLocal UNA vez: habilitados = matrícula
  ACTIVA con Aprobación final (Aprobación titulación + Aprobación
  complexivo/proyecto en CUMPLE).
- Bloquea el acta si: el texto no cuadra, no hay matrícula ACTIVA en el
  período, el código de carrera no coincide, no tiene Aprobación final o el
  estudiante ya está en examen complexivo.
- Guarda en BDLocal (evaluaciones_titulacion) y sube directo a
  Firebase /notas_trabajo, igual que Carga.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0";
  var state={period:"",periods:[],students:Object.create(null),checked:[],working:false,roster:null,readyAnnounced:false};
  var base=(document.currentScript&&document.currentScript.src)||document.baseURI;

  function $(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function canon(value){return text(value).replace(/_+/g,"__");}
  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function el(tag,content,css){var node=document.createElement(tag);if(content!=null){node.textContent=String(content);}if(css){node.className=css;}return node;}
  function fmt(value){return Number.isFinite(value)?value.toFixed(2).replace(".",","):"—";}
  function message(value,type){var node=$("tt-message");node.textContent=text(value);node.className="tt-message"+(type?" is-"+type:"");}
  var MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var periodNames=Object.create(null);
  // Igual que las demás pantallas: la etiqueta de BDLocal («Mayo 2026 a Noviembre 2026»);
  // si no existe, se arma desde el código 2026-05__2026-11.
  function periodName(id){
    id=canon(id);if(periodNames[id]){return periodNames[id];}
    var m=id.match(/^(\d{4})-(\d{2})__(\d{4})-(\d{2})$/);
    return m?MESES[Number(m[2])-1]+" "+m[1]+" a "+MESES[Number(m[4])-1]+" "+m[3]:id;
  }
  function con(){var c=window.ConNcomplex;return c&&c.__loaderProxy!==true?c:c||null;}

  function loadScript(relative,test){
    if(test()){return Promise.resolve(test());}
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");script.src=url(relative);script.async=false;
      script.onload=function(){resolve(test());};
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    });
  }
  function connect(){
    return loadScript("../BDLocal/conexiones/cone.ncomplex.js",function(){return window.ConNcomplex||window.ConNcomplexLoader;}).then(function(){
      var c=window.ConNcomplex;
      if(!c||typeof c.ready!=="function"){throw new Error("ConNcomplex no está disponible.");}
      return Promise.resolve(c.ready()).then(function(result){
        if(result&&result.ok===false){throw new Error(result.error||"BDLocal no está lista.");}
        return window.ConNcomplex;
      });
    });
  }

  function studentId(st){var v=text(st.cedula||st.Cedula||st.numeroIdentificacion||st.NumeroIdentificacion).replace(/\D/g,"");return /^\d{9}$/.test(v)?"0"+v:v;}
  function studentCode(st){return text(st.CodigoCarrera||st.codigoCarrera||st.codigoCarreraActual).toUpperCase();}
  function studentPeriod(st){return canon(st.periodoId||st.PeriodoId||st.periodId);}
  function active(st){
    var estado=text(st.estadoMatricula||st._estadoMatricula).toUpperCase();
    return st.eliminado!==true&&st.retirado!==true&&estado==="ACTIVO";
  }
  function groupFromCode(code,name){
    var c=text(code).toLowerCase(),n=text(name).toLowerCase();
    var letter=(c.match(/-([a-z])-\d+\s*$/)||[])[1]||"";
    if(/pvc/.test(c+" "+n)){return "PVC";}
    if(/online|en.linea|virtual/.test(n)||letter==="l"){return "ONLINE";}
    if(letter==="p"){return "PRESENCIAL";}
    return "";
  }
  function studentsOf(period){
    if(state.students[period]){return Promise.resolve(state.students[period]);}
    return con().listStudents({periodoId:period}).then(function(rows){
      state.students[period]=(rows||[]).filter(function(st){return studentPeriod(st)===period||!studentPeriod(st);});
      return state.students[period];
    });
  }
  // Si no está en el período elegido, decir en cuál sí tiene matrícula activa.
  function findElsewhere(cedula){
    var others=state.periods.filter(function(p){return p!==state.period;});
    return others.reduce(function(chain,period){
      return chain.then(function(found){
        if(found){return found;}
        return studentsOf(period).then(function(rows){
          return rows.some(function(st){return studentId(st)===cedula&&active(st);})?period:"";
        }).catch(function(){return "";});
      });
    },Promise.resolve(""));
  }

  function hasValue(v){return v!==null&&v!==undefined&&text(v)!=="";}
  function habilitado(st){var f=st&&st._aprobacionFinal;return !!st&&(st.aprobacionFinal===true||(f&&f.eligible===true));}
  function finalReason(st){var f=st&&st._aprobacionFinal;return text(st&&st.aprobacionFinalFaltante||f&&f.reason)||"sin verificación";}
  // Quien está en examen complexivo no puede tener trabajo de titulación (y al revés).
  function inComplexivo(ev){
    return !!ev&&text(ev.modalidadTitulacion)==="EXAMEN_COMPLEXIVO"&&
      [ev.notaTeorica,ev.notaPractica,ev.notaComplexivo,ev.notaSupletorio,ev.notaTeoricaSupletorio,ev.notaPracticaSupletorio,ev.notaOficial].some(hasValue);
  }
  function announceReady(){
    if(state.readyAnnounced){return;}state.readyAnnounced=true;
    try{window.dispatchEvent(new CustomEvent("maqueta:screen-render-complete",{detail:{source:"trabajo"}}));}catch(error){}
  }
  // Una sola lectura de BDLocal por período: matrículas + requisitos + evaluaciones.
  function loadRoster(period){
    state.period=period;state.checked=[];state.roster=null;render();renderRoster();
    if(!period){message("Selecciona el período de la matrícula para cargar los estudiantes habilitados.");return refreshSaved();}
    var started=Date.now();message("Leyendo "+periodName(period)+" en BDLocal…");
    return Promise.all([studentsOf(period),con().listEvaluations({periodoId:period}).catch(function(){return [];})]).then(function(out){
      if(state.period!==period){return;}
      var evalByCed=Object.create(null);
      (out[1]||[]).forEach(function(ev){if(ev&&ev.eliminado!==true&&canon(ev.periodoId)===period){evalByCed[studentId(ev)]=ev;}});
      var activos=out[0].filter(active),list=activos.filter(habilitado);
      state.roster={period:period,list:list,activos:activos.length,evalByCed:evalByCed,ms:Date.now()-started};
      var withActa=list.filter(function(st){var ev=evalByCed[studentId(st)];return ev&&ev.actaTrabajo;}).length;
      message("BDLocal leída en "+(state.roster.ms/1000).toFixed(1).replace(".",",")+" s · "+list.length+" habilitado(s) con Aprobación final de "+
        activos.length+" matrícula(s) activa(s) · "+withActa+" con acta guardada. Pegue las actas y pulse Analizar.",list.length?"ok":"error");
    }).catch(function(error){message("No se pudo leer BDLocal: "+(error.message||error),"error");})
      .then(function(){renderRoster();announceReady();return refreshSaved();});
  }
  function renderRoster(){
    var box=$("tt-roster");if(!box){return;}
    box.textContent="";
    var roster=state.roster;box.hidden=!roster;
    if(!roster){return;}
    var summary=el("summary",roster.list.length+" estudiante(s) habilitado(s) con Aprobación final en "+periodName(roster.period));
    box.appendChild(summary);
    var list=el("ul");
    roster.list.slice().sort(function(a,b){return text(a.NombreCarrera||a.nombreCarrera).localeCompare(text(b.NombreCarrera||b.nombreCarrera),"es")||
      text(a.Nombres||a.nombres).localeCompare(text(b.Nombres||b.nombres),"es");}).forEach(function(st){
      var ev=roster.evalByCed[studentId(st)];
      var state2=ev&&ev.actaTrabajo?"acta "+text(ev.actaTrabajo.numeroActaSenescyt)+" guardada":inComplexivo(ev)?"en examen complexivo":ev&&text(ev.modalidadTitulacion)==="TRABAJO_TITULACION"&&ev.notaTrabajoTitulacion!=null?"nota consolidada institucional "+fmt(Number(ev.notaTrabajoTitulacion))+" (sin acta)":"sin acta";
      list.appendChild(el("li",text(st.Nombres||st.nombres)+" · "+studentId(st)+" · "+text(st.NombreCarrera||st.nombreCarrera)+" — "+state2));
    });
    box.appendChild(list);
  }

  function check(result){
    var acta=result.acta,item={result:result,acta:acta,blocked:result.errors.slice(),warnings:result.warnings.slice(),student:null,group:""};
    if(!result.ok){return Promise.resolve(item);}
    var period=state.period,roster=state.roster;
    return studentsOf(period).then(function(rows){
      var matches=rows.filter(function(st){return studentId(st)===acta.cedula;});
      var current=matches.filter(active)[0]||null;
      item.student=current;
      if(!current){
        return findElsewhere(acta.cedula).then(function(other){
          item.blocked.push(matches.length?"La matrícula en "+periodName(period)+" no está ACTIVA (retirado o eliminado).":
            other?"No tiene matrícula en "+periodName(period)+"; tiene matrícula activa en "+periodName(other)+". Elija ese período.":
            "No tiene matrícula activa en "+periodName(period)+".");
        });
      }
      if(studentCode(current)&&studentCode(current)!==acta.codigoCarrera){
        item.blocked.push("El código de carrera del acta ("+acta.codigoCarrera+") no coincide con la matrícula ("+studentCode(current)+").");
      }
      item.group=groupFromCode(acta.codigoCarrera,acta.nombreCarrera)||groupFromCode(studentCode(current),current.NombreCarrera||current.nombreCarrera);
      if(!item.group){item.blocked.push("No se pudo deducir la modalidad (Presencial/Online/PVC) del código de carrera.");}
      if(!habilitado(current)){item.blocked.push("No está habilitado: falta Aprobación final ("+finalReason(current)+").");}
      var existing=roster&&roster.period===period?roster.evalByCed[acta.cedula]:null;
      if(inComplexivo(existing)){item.blocked.push("Ya está en examen complexivo: no puede tener trabajo de titulación.");}
      var prev=existing&&existing.actaTrabajo&&text(existing.actaTrabajo.numeroActaSenescyt);
      if(prev&&prev!==acta.numeroActaSenescyt){item.warnings.push("Reemplaza el acta "+prev+" guardada antes.");}
    }).then(function(){return item;});
  }

  function render(){
    var tbody=$("tt-table").querySelector("tbody");tbody.textContent="";
    var ready=0,blocked=0;
    state.checked.forEach(function(item){
      var a=item.acta,ok=item.blocked.length===0;ok?ready++:blocked++;
      var tr=el("tr",null,ok?"":"is-blocked");
      var who=el("td");who.appendChild(el("strong",a.nombres||"(sin nombre)"));who.appendChild(el("small",a.cedula+" · "+a.codigoCarrera));
      tr.appendChild(who);
      tr.appendChild(el("td",a.numeroActaSenescyt||"—"));
      tr.appendChild(el("td",a.fechaActaGradoTexto||"—"));
      [a.promedioTrabajoEscrito,a.promedioEvaluacionPractica,a.promedioEvaluacionDefensa,a.promedioDefensaOral].forEach(function(v){tr.appendChild(el("td",fmt(v)));});
      tr.appendChild(el("td",Number.isFinite(a.notaFinal)?String(a.notaFinal).replace(".",","):"—","tt-final"));
      var status=el("td");
      var chip=el("span",item.upload?item.upload:ok?"Lista":"Bloqueada","tt-chip "+(item.upload==="ERROR"||item.upload==="CONFLICTO"||!ok?"is-bad":item.upload?"is-ok":"is-ready"));
      status.appendChild(chip);
      item.blocked.concat(item.warnings.map(function(w){return "⚠ "+w;})).forEach(function(line){status.appendChild(el("small",line));});
      tr.appendChild(status);
      tbody.appendChild(tr);
    });
    $("tt-count-total").textContent=state.checked.length;
    $("tt-count-ready").textContent=ready;
    $("tt-count-blocked").textContent=blocked;
    $("tt-results").hidden=state.checked.length===0;
    $("tt-save").disabled=state.working||ready===0;
  }

  function analyze(){
    if(state.working){return;}
    if(!state.period){message("Seleccione el período de la matrícula del estudiante.","error");return;}
    var parser=window.TrabajoParser,raw=$("tt-paste").value;
    if(!text(raw)){message("Pegue una o varias actas.","error");return;}
    var parsed=parser.parse(raw);
    if(!parsed.total){message("No se encontró ningún acta. Cada acta debe empezar con «Nombres: Cedula: Código de Carrera: Carrera:».","error");return;}
    state.working=true;message("Validando "+parsed.total+" acta(s) contra BDLocal…");
    parsed.actas.reduce(function(chain,result){
      return chain.then(function(list){return check(result).then(function(item){list.push(item);return list;});});
    },Promise.resolve([])).then(function(list){
      state.checked=list;
      var ready=list.filter(function(i){return !i.blocked.length;}).length;
      message(ready+" de "+list.length+" acta(s) listas para guardar."+(ready<list.length?" Las bloqueadas no se guardan.":""),ready?"ok":"error");
    }).catch(function(error){message(error.message||String(error),"error");})
      .then(function(){state.working=false;render();});
  }

  function localRow(item,doc){
    var a=item.acta;
    return {periodoId:state.period,cedula:a.cedula,modalidadTitulacion:"TRABAJO_TITULACION",
      CodigoCarrera:a.codigoCarrera,NombreCarrera:a.nombreCarrera,grupoInforme:item.group,
      // La nota oficial es la del acta; los componentes se guardan con nombre propio
      // para que BDLocal no la recalcule con otro redondeo.
      notaTrabajoTitulacion:a.notaFinal,promedioTrabajoEscrito:a.promedioTrabajoEscrito,
      promedioDefensaOral:a.promedioDefensaOral,numeroActaSenescyt:a.numeroActaSenescyt,
      actaTrabajo:Object.assign({},doc,{dataHash:undefined,version:undefined}),
      origen:"trabajo_acta_senescyt"};
  }

  function save(){
    if(state.working){return;}
    var ready=state.checked.filter(function(i){return !i.blocked.length&&!i.upload;});
    if(!ready.length){return;}
    state.working=true;render();
    var api=window.TrabajoFirebase,docs=[];
    message("Guardando "+ready.length+" acta(s) en BDLocal…");
    api.ensure().catch(function(){return null;}).then(function(){
      docs=ready.map(function(item){return api.buildDocument(item.acta,{periodoId:state.period,grupoInforme:item.group});});
      return con().saveMany(ready.map(function(item,i){return localRow(item,docs[i]);}),{periodoId:state.period,source:"trabajo_acta_senescyt"});
    }).then(function(){
      message("BDLocal guardada. Subiendo a Firebase /notas_trabajo…");
      return api.upload(docs,{periodoId:state.period,onProgress:function(done,total){message("Subiendo a Firebase /notas_trabajo… "+done+" / "+total);}});
    }).then(function(summary){
      ready.forEach(function(item){item.upload=summary.resultados[item.acta.cedula]||"ERROR";});
      var line="Firebase /notas_trabajo: "+summary.nuevos+" nuevas · "+summary.actualizados+" actualizadas · "+summary.iguales+" ya iguales";
      if(summary.ok){message(line+". Todo verificado.","ok");}
      else{message(line+" · "+(summary.errores+summary.conflictos)+" con error. "+summary.detalles.slice(0,2).join(" | ")+" Las notas quedaron en BDLocal; vuelva a pulsar Guardar.","error");
        ready.forEach(function(item){if(item.upload==="ERROR"||item.upload==="CONFLICTO"){delete item.upload;}});}
      if(state.roster){
        return con().listEvaluations({periodoId:state.period}).then(function(rows){
          (rows||[]).forEach(function(ev){if(ev&&canon(ev.periodoId)===state.period){state.roster.evalByCed[studentId(ev)]=ev;}});
        }).catch(function(){}).then(function(){renderRoster();return refreshSaved();});
      }
      return refreshSaved();
    }).catch(function(error){
      message("No se pudo completar: "+(error.message||error)+". Lo guardado en BDLocal se conserva.","error");
    }).then(function(){state.working=false;render();});
  }

  // Actas ya guardadas en BDLocal para el período (sirve para reintentar la subida).
  function savedRows(){
    return con().listEvaluations({periodoId:state.period}).then(function(rows){
      return (rows||[]).filter(function(r){return text(r.modalidadTitulacion)==="TRABAJO_TITULACION"&&r.actaTrabajo&&canon(r.periodoId)===state.period;});
    });
  }
  function refreshSaved(){
    if(!state.period){$("tt-saved").textContent="";return Promise.resolve();}
    return savedRows().then(function(rows){
      $("tt-saved").textContent=rows.length+" acta(s) de trabajo guardadas en BDLocal para este período.";
      $("tt-resync").disabled=state.working||!rows.length;
    }).catch(function(){$("tt-saved").textContent="";});
  }
  function resync(){
    if(state.working){return;}
    state.working=true;$("tt-resync").disabled=true;
    var api=window.TrabajoFirebase;
    api.ensure().then(savedRows).then(function(rows){
      var docs=rows.map(function(r){
        return api.buildDocument(r.actaTrabajo,{periodoId:state.period,grupoInforme:r.actaTrabajo.grupoInforme||r.grupoInforme,createdAt:r.actaTrabajo.createdAt});
      });
      message("Subiendo "+docs.length+" acta(s) guardadas a Firebase /notas_trabajo…");
      return api.upload(docs,{periodoId:state.period});
    }).then(function(summary){
      message("Firebase /notas_trabajo: "+summary.nuevos+" nuevas · "+summary.actualizados+" actualizadas · "+summary.iguales+" ya iguales"+
        (summary.ok?". Todo verificado.":" · "+(summary.errores+summary.conflictos)+" con error. "+summary.detalles.slice(0,2).join(" | ")),summary.ok?"ok":"error");
    }).catch(function(error){message("No se pudo subir: "+(error.message||error),"error");})
      .then(function(){state.working=false;return refreshSaved();});
  }

  function fillPeriods(periods){
    var select=$("tt-period");
    (periods||[]).forEach(function(p){
      var id=canon(p&&(p.id||p.periodoId||p.periodId||p.value)||p);
      var name=text(p&&(p.label||p.nombre||p.periodoLabel));
      if(id&&name&&name!==id){periodNames[id]=name;}
    });
    state.periods=(periods||[]).map(function(p){return canon(p&&(p.id||p.periodoId||p.periodId||p.value)||p);}).filter(Boolean)
      .filter(function(v,i,all){return all.indexOf(v)===i;}).sort().reverse();
    select.textContent="";
    select.appendChild(el("option","Selecciona un período")).value="";
    state.periods.forEach(function(id){var o=el("option",periodName(id));o.value=id;select.appendChild(o);});
  }
  function init(){
    // El período (propio o el global de la app) carga la lista de habilitados.
    $("tt-period").addEventListener("change",function(){loadRoster(canon(this.value));});
    $("tt-analyze").addEventListener("click",analyze);
    $("tt-save").addEventListener("click",save);
    $("tt-resync").addEventListener("click",resync);
    $("tt-clear").addEventListener("click",function(){$("tt-paste").value="";state.checked=[];render();message("");});
    message("Conectando con BDLocal…");
    connect().then(function(c){return c.listPeriods();}).then(function(periods){
      fillPeriods(periods);
      var current=canon($("tt-period").value);
      if(current){return loadRoster(current);}
      message("Selecciona el período de la matrícula para cargar los estudiantes habilitados (Aprobación final).");announceReady();
    }).catch(function(error){message("No se pudo conectar con BDLocal: "+(error.message||error),"error");announceReady();});
    render();
  }

  window.TrabajoApp={version:VERSION,init:init,analyze:analyze,save:save,loadRoster:loadRoster,_state:state};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
})(window,document);
