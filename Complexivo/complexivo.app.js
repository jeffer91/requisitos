/* =========================================================
Nombre completo: complexivo.app.js
Ruta: /Complexivo/complexivo.app.js
Función:
- Menú Notas → Complexivo: pegar uno o varios libros de Moodle del Examen
  Complexivo, calcular la nota oficial (40/60) y guardarla.
- Período y carrera se leen del título del libro. Cada fila se cruza con
  BDLocal por el NOMBRE (sin importar el orden nombres/apellidos, las tildes
  ni las iniciales que Moodle pega delante). El correo no se usa ni se guarda.
- Bloquea si: no hay matrícula ACTIVA en el período, no cumple los 9
  requisitos o el estudiante ya tiene notas de trabajo de titulación.
- No se guardan: «no rindió» ni supletorio/ordinario incompletos.
- Guarda en BDLocal (evaluaciones_titulacion) y sube directo a
  Firebase /notas_complexivo, igual que Carga.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0";
  var state={periods:[],students:Object.create(null),items:[],books:[],working:false};
  var base=(document.currentScript&&document.currentScript.src)||document.baseURI;

  function $(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").toUpperCase();}
  function canon(value){return text(value).replace(/_+/g,"__");}
  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function el(tag,content,css){var node=document.createElement(tag);if(content!=null){node.textContent=String(content);}if(css){node.className=css;}return node;}
  function fmt(value){return value===null||value===undefined||!Number.isFinite(value)?"—":value.toFixed(2).replace(".",",");}
  function message(value,type){var node=$("cx-message");node.textContent=text(value);node.className="cx-message"+(type?" is-"+type:"");}
  var MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  var periodNames=Object.create(null);
  // Igual que las demás pantallas: la etiqueta de BDLocal («Mayo 2026 a Noviembre 2026»);
  // si no existe, se arma desde el código 2026-05__2026-11.
  function periodName(id){
    id=canon(id);if(periodNames[id]){return periodNames[id];}
    var m=id.match(/^(\d{4})-(\d{2})__(\d{4})-(\d{2})$/);
    return m?MESES[Number(m[2])-1]+" "+m[1]+" a "+MESES[Number(m[4])-1]+" "+m[3]:id;
  }
  function con(){return window.ConNcomplex;}

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
  function studentCareer(st){return text(st.NombreCarrera||st.nombreCarrera||st.Carrera||st.nombreCarreraActual);}
  function studentName(st){return text(st.Nombres||st.nombres||st.nombreCompleto||st.NombreCompleto);}
  function studentPeriod(st){return canon(st.periodoId||st.PeriodoId||st.periodId);}
  function active(st){var e=text(st.estadoMatricula||st._estadoMatricula).toUpperCase();return st.eliminado!==true&&st.retirado!==true&&e==="ACTIVO";}
  // Nombre → clave: palabras sin tildes, ordenadas («ALVARADO PEREZ MALENA RACHELL»
  // y «MALENA RACHELL ALVARADO PEREZ» dan la misma clave).
  function tokens(value){return norm(value).replace(/[^A-Z ]/g," ").split(" ").filter(Boolean);}
  function nameKey(list){return list.slice().sort().join(" ");}
  // Moodle pega las iniciales del avatar al nombre: «MAMALENA RACHELL ALVARADO PEREZ» = MA + MALENA.
  function moodleKeys(name){
    var t=tokens(name),keys=[nameKey(t)];
    if(t.length>1&&t[0].length>3&&t[0][0]===t[0][2]&&t.slice(1).some(function(w){return w[0]===t[0][1];})){
      keys.unshift(nameKey([t[0].slice(2)].concat(t.slice(1))));
    }
    return keys;
  }
  function lookup(idx,name){
    var keys=moodleKeys(name);
    for(var i=0;i<keys.length;i++){if(idx.byName[keys[i]]){return idx.byName[keys[i]];}}
    return [];
  }
  function careerKey(value){return norm(value).replace(/\b(ONLINE|EN LINEA|VIRTUAL|PVC|PRESENCIAL)\b/g,"").replace(/^TECNOLOGIA SUPERIOR EN /,"").replace(/[^A-Z0-9 ]/g,"").replace(/\s+/g," ").trim();}
  function groupFromCode(code,name){
    var c=text(code).toLowerCase(),n=text(name).toLowerCase(),letter=(c.match(/-([a-z])-\d+\s*$/)||[])[1]||"";
    if(/pvc/.test(c+" "+n)){return "PVC";}
    if(/online|en.linea|virtual/.test(n)||letter==="l"){return "ONLINE";}
    if(letter==="p"){return "PRESENCIAL";}
    return "";
  }
  function studentsOf(period){
    if(state.students[period]){return Promise.resolve(state.students[period]);}
    return con().listStudents({periodoId:period}).then(function(rows){
      var list=(rows||[]).filter(function(st){return !studentPeriod(st)||studentPeriod(st)===period;});
      var byName=Object.create(null);
      list.forEach(function(st){var k=nameKey(tokens(studentName(st)));if(k){(byName[k]=byName[k]||[]).push(st);}});
      state.students[period]={list:list,byName:byName};
      return state.students[period];
    });
  }
  function findElsewhere(name,period){
    return state.periods.filter(function(p){return p!==period;}).reduce(function(chain,p){
      return chain.then(function(found){
        if(found){return found;}
        return studentsOf(p).then(function(idx){return lookup(idx,name).some(active)?p:"";}).catch(function(){return "";});
      });
    },Promise.resolve(""));
  }

  function checkRow(book,fila,period){
    var rules=window.ComplexivoRules,item={book:book,fila:fila,periodoId:period,resultado:rules.evaluate(fila),
      blocked:fila.errors.slice(),warnings:[],student:null,group:"",skip:false};
    item.warnings=item.resultado.observaciones.slice();
    if(item.resultado.estadoEvaluacion==="SIN_NOTAS"){item.skip=true;item.skipReason="No rindió";}
    else if(item.resultado.estadoEvaluacion==="INCOMPLETO"){item.skip=true;item.skipReason="Incompleto";}
    if(!period){item.blocked.push("Sin período.");return Promise.resolve(item);}
    return studentsOf(period).then(function(idx){
      var matches=lookup(idx,fila.nombreMoodle);
      var current=matches.filter(active);
      if(current.length>1&&current.some(function(st){return studentId(st)!==studentId(current[0]);})){
        item.blocked.push("Hay más de un estudiante activo con ese nombre en BDLocal ("+current.map(studentId).join(", ")+").");return item;
      }
      item.student=current[0]||null;
      if(item.student){
        var ced=studentId(item.student),dup=state.items.some(function(other){return other!==item&&other.student&&studentId(other.student)===ced&&!other.skip;});
        if(dup&&!item.skip){item.blocked.push("Este estudiante ya aparece en otra fila pegada.");}
      }
      if(!item.student){
        if(item.skip){return item;}
        return findElsewhere(fila.nombreMoodle,period).then(function(other){
          item.blocked.push(matches.length?"La matrícula en "+periodName(period)+" no está ACTIVA.":
            other?"No tiene matrícula en "+periodName(period)+"; la tiene en "+periodName(other)+".":"No se encontró por nombre en BDLocal para "+periodName(period)+". Revise cómo está escrito en Moodle.");
          return item;
        });
      }
      var st=item.student;
      if(careerKey(studentCareer(st))&&careerKey(book.info.carrera)&&careerKey(studentCareer(st))!==careerKey(book.info.carrera)){
        item.warnings.push("Libro de «"+book.info.carrera+"», matrícula en «"+studentCareer(st)+"».");
      }
      item.group=groupFromCode(studentCode(st),studentCareer(st));
      if(item.skip){return item;}
      if(!item.group){item.blocked.push("No se pudo deducir la modalidad (Presencial/Online/PVC) del código de carrera "+studentCode(st)+".");}
      var c=con(),ced=studentId(st);
      return Promise.all([
        c.checkRequirements(period,ced).catch(function(e){return {eligible:false,reason:e.message||String(e)};}),
        c.getEvaluation(period,ced).catch(function(){return null;})
      ]).then(function(out){
        var req=out[0]||{},existing=out[1];
        if(!req.eligible){item.blocked.push("No cumple los 9 requisitos: "+(text(req.reason)||"sin verificación")+".");}
        if(existing&&text(existing.modalidadTitulacion)==="TRABAJO_TITULACION"&&
          (existing.actaTrabajo||[existing.notaTrabajoTitulacion,existing.notaEscrito].some(function(v){return v!==null&&v!==undefined&&text(v)!=="";}))){
          item.blocked.push("Ya tiene notas de trabajo de titulación en este período.");
        }
        return item;
      });
    });
  }

  function missingRoster(book,period,items){
    // Estudiantes activos de la carrera del libro que no aparecen en Moodle.
    var key=careerKey(book.info.carrera),seen=Object.create(null);
    items.forEach(function(i){if(i.student){seen[studentId(i.student)]=true;}});
    var idx=state.students[period];if(!idx||!key){return [];}
    return idx.list.filter(function(st){return active(st)&&careerKey(studentCareer(st))===key&&!seen[studentId(st)];});
  }

  function render(){
    var tbody=$("cx-table").querySelector("tbody");tbody.textContent="";
    var counts={ready:0,blocked:0,skip:0};
    state.books.forEach(function(entry){
      var head=el("tr",null,"cx-book");var th=el("td",null);th.colSpan=11;
      th.appendChild(el("strong",entry.book.info.titulo.replace(/\]$/,"")));
      th.appendChild(el("span",(entry.period?periodName(entry.period):"sin período")+" · "+entry.items.length+" filas"+
        (entry.missing.length?" · "+entry.missing.length+" matriculado(s) sin fila en Moodle":"")));
      if(entry.book.errors.length){th.appendChild(el("small",entry.book.errors.join(" ")));}
      if(entry.missing.length){th.appendChild(el("small","No están en el libro: "+entry.missing.slice(0,12).map(studentName).join(", ")+(entry.missing.length>12?"…":"")));}
      head.appendChild(th);tbody.appendChild(head);
      entry.items.forEach(function(item){
        var r=item.resultado,o=item.fila.ordinaria,s=item.fila.supletorio;
        var ok=!item.blocked.length&&!item.skip;
        if(item.skip){counts.skip++;}else if(ok){counts.ready++;}else{counts.blocked++;}
        var tr=el("tr",null,item.skip?"is-skip":ok?"":"is-blocked");
        var who=el("td");who.appendChild(el("strong",item.student?studentName(item.student):item.fila.nombreMoodle));
        who.appendChild(el("small",item.student?studentId(item.student)+" · Moodle: "+item.fila.nombreMoodle:"Moodle: "+item.fila.nombreMoodle));tr.appendChild(who);
        tr.appendChild(el("td",item.group||"—"));
        [o.teorico,o.practico,r.notaOrdinaria,s.teorico,s.practico,r.notaSupletorio].forEach(function(v,i){tr.appendChild(el("td",fmt(v),i===2||i===5?"cx-sub":""));});
        tr.appendChild(el("td",fmt(r.notaOficial),"cx-final"));
        tr.appendChild(el("td",r.oportunidadAplicada?r.oportunidadAplicada.charAt(0)+r.oportunidadAplicada.slice(1).toLowerCase():"—"));
        var status=el("td");
        var label=item.upload||(item.skip?item.skipReason:ok?(r.estadoEvaluacion==="APROBADO"?"Aprobado":"No aprobado"):"Bloqueada");
        var css=item.upload==="ERROR"||item.upload==="CONFLICTO"||(!ok&&!item.skip)?"is-bad":item.skip?"is-muted":item.upload?"is-ok":r.estadoEvaluacion==="APROBADO"?"is-ready":"is-warn";
        status.appendChild(el("span",label,"cx-chip "+css));
        item.blocked.concat(item.warnings.map(function(w){return "⚠ "+w;})).forEach(function(line){status.appendChild(el("small",line));});
        tr.appendChild(status);tbody.appendChild(tr);
      });
    });
    $("cx-count-total").textContent=state.items.length;
    $("cx-count-ready").textContent=counts.ready;
    $("cx-count-blocked").textContent=counts.blocked;
    $("cx-count-skip").textContent=counts.skip;
    $("cx-results").hidden=state.items.length===0;
    $("cx-save").disabled=state.working||counts.ready===0;
  }

  function analyze(){
    if(state.working){return;}
    var raw=$("cx-paste").value;
    if(!text(raw)){message("Pegue uno o varios libros de calificaciones de Moodle.","error");return;}
    var parsed=window.ComplexivoMoodle.parse(raw);
    if(!parsed.total){message("No se encontró ningún libro. Cada libro empieza con su título «Examen Complexivo … ]».","error");return;}
    var forced=canon($("cx-period").value);
    state.working=true;state.books=[];state.items=[];render();
    message("Validando "+parsed.total+" libro(s) contra BDLocal…");
    parsed.libros.reduce(function(chain,book){
      return chain.then(function(){
        var period=forced||book.info.periodoId;
        var entry={book:book,period:period,items:[],missing:[]};state.books.push(entry);
        if(period&&state.periods.indexOf(period)<0){book.errors.push("El período "+periodName(period)+" no está en BDLocal.");period="";entry.period="";}
        if(book.errors.length&&!book.filas.length){return null;}
        return book.filas.reduce(function(c,fila){
          return c.then(function(){return checkRow(book,fila,period).then(function(item){
            if(book.errors.length){item.blocked.unshift("Libro con errores: "+book.errors[0]);}
            entry.items.push(item);state.items.push(item);});});
        },Promise.resolve()).then(function(){entry.missing=period?missingRoster(book,period,entry.items):[];});
      });
    },Promise.resolve()).then(function(){
      var ready=state.items.filter(function(i){return !i.blocked.length&&!i.skip;}).length;
      message(ready+" nota(s) listas para guardar de "+state.items.length+" fila(s)."+(ready<state.items.length?" Bloqueadas, incompletas y «no rindió» no se guardan.":""),ready?"ok":"error");
    }).catch(function(error){message(error.message||String(error),"error");})
      .then(function(){state.working=false;render();return refreshSaved();});
  }

  function entryOf(item){
    var st=item.student;
    return {periodoId:item.periodoId,cedula:studentId(st),nombres:studentName(st),
      codigoCarrera:studentCode(st),nombreCarrera:studentCareer(st),grupoInforme:item.group,
      cursoMoodle:item.book.info.titulo.replace(/\]$/,""),fila:item.fila,resultado:item.resultado};
  }
  function localRow(entry){
    var o=entry.fila.ordinaria,s=entry.fila.supletorio;
    return {periodoId:entry.periodoId,cedula:entry.cedula,modalidadTitulacion:"EXAMEN_COMPLEXIVO",
      CodigoCarrera:entry.codigoCarrera,NombreCarrera:entry.nombreCarrera,grupoInforme:entry.grupoInforme,
      notaTeorica:o.teorico,notaPractica:o.practico,notaTeoricaSupletorio:s.teorico,notaPracticaSupletorio:s.practico,
      oportunidadAplicada:entry.resultado.oportunidadAplicada,cursoMoodle:entry.cursoMoodle,
      nombresMoodle:entry.nombres,origen:"complexivo_moodle"};
  }

  function persist(entries){
    var api=window.ComplexivoFirebase,byPeriod=Object.create(null);
    entries.forEach(function(e){(byPeriod[e.periodoId]=byPeriod[e.periodoId]||[]).push(e);});
    return api.ensure().catch(function(){return null;}).then(function(){
      return Object.keys(byPeriod).reduce(function(chain,period){
        return chain.then(function(acc){
          var list=byPeriod[period];
          message("Guardando "+list.length+" nota(s) de "+periodName(period)+" en BDLocal…");
          return con().saveMany(list.map(localRow),{periodoId:period,source:"complexivo_moodle"}).then(function(){
            var docs=list.map(function(e){return api.buildDocument(e);});
            return api.upload(docs,{periodoId:period,onProgress:function(d,t){message("Subiendo a Firebase /notas_complexivo ("+periodName(period)+")… "+d+" / "+t);}});
          }).then(function(summary){
            ["nuevos","actualizados","iguales","conflictos","errores"].forEach(function(k){acc[k]+=summary[k];});
            Object.assign(acc.resultados,summary.resultados);acc.detalles=acc.detalles.concat(summary.detalles);return acc;
          });
        });
      },Promise.resolve({nuevos:0,actualizados:0,iguales:0,conflictos:0,errores:0,resultados:{},detalles:[]}));
    });
  }
  function report(acc){
    var ok=acc.errores===0&&acc.conflictos===0;
    var line="Firebase /notas_complexivo: "+acc.nuevos+" nuevas · "+acc.actualizados+" actualizadas · "+acc.iguales+" ya iguales";
    message(ok?line+". Todo verificado.":line+" · "+(acc.errores+acc.conflictos)+" con error. "+acc.detalles.slice(0,2).join(" | ")+" Lo guardado en BDLocal se conserva; vuelva a subir.",ok?"ok":"error");
    return ok;
  }

  function save(){
    if(state.working){return;}
    var ready=state.items.filter(function(i){return !i.blocked.length&&!i.skip&&!i.upload;});
    if(!ready.length){return;}
    state.working=true;render();
    persist(ready.map(entryOf)).then(function(acc){
      ready.forEach(function(i){i.upload=acc.resultados[studentId(i.student)]||"ERROR";});
      if(!report(acc)){ready.forEach(function(i){if(i.upload==="ERROR"||i.upload==="CONFLICTO"){delete i.upload;}});}
      return refreshSaved();
    }).catch(function(error){message("No se pudo completar: "+(error.message||error)+". Lo guardado en BDLocal se conserva.","error");})
      .then(function(){state.working=false;render();});
  }

  // Reintento: reconstruye desde BDLocal las notas complexivo guardadas por esta pantalla.
  function savedRows(period){
    return con().listEvaluations({periodoId:period}).then(function(rows){
      return (rows||[]).filter(function(r){return text(r.modalidadTitulacion)==="EXAMEN_COMPLEXIVO"&&text(r.origen)==="complexivo_moodle"&&canon(r.periodoId)===period;});
    });
  }
  function selectedPeriod(){return canon($("cx-period").value)||(state.books[0]&&state.books[0].period)||"";}
  function refreshSaved(){
    var period=selectedPeriod();
    if(!period){$("cx-saved").textContent="Elija un período para ver lo guardado.";$("cx-resync").disabled=true;return Promise.resolve();}
    return savedRows(period).then(function(rows){
      $("cx-saved").textContent=rows.length+" nota(s) de complexivo guardadas en BDLocal para "+periodName(period)+".";
      $("cx-resync").disabled=state.working||!rows.length;
    }).catch(function(){$("cx-saved").textContent="";});
  }
  function resync(){
    var period=selectedPeriod();if(state.working||!period){return;}
    state.working=true;$("cx-resync").disabled=true;
    var rules=window.ComplexivoRules,api=window.ComplexivoFirebase;
    api.ensure().then(function(){return savedRows(period);}).then(function(rows){
      var docs=rows.map(function(r){
        var fila={ordinaria:{teorico:r.notaTeorica==null?null:Number(r.notaTeorica),practico:r.notaPractica==null?null:Number(r.notaPractica)},
          supletorio:{teorico:r.notaTeoricaSupletorio==null?null:Number(r.notaTeoricaSupletorio),practico:r.notaPracticaSupletorio==null?null:Number(r.notaPracticaSupletorio)}};
        var resultado=rules.evaluate(fila);
        return resultado.publicable?api.buildDocument({periodoId:period,cedula:text(r.cedula),nombres:r.nombresMoodle,
          codigoCarrera:r.CodigoCarrera||r.codigoCarrera,nombreCarrera:r.NombreCarrera||r.nombreCarrera,grupoInforme:r.grupoInforme,
          cursoMoodle:r.cursoMoodle,fila:fila,resultado:resultado}):null;
      }).filter(Boolean);
      message("Subiendo "+docs.length+" nota(s) guardadas a Firebase /notas_complexivo…");
      return api.upload(docs,{periodoId:period});
    }).then(report).catch(function(error){message("No se pudo subir: "+(error.message||error),"error");})
      .then(function(){state.working=false;return refreshSaved();});
  }

  function fillPeriods(periods){
    var select=$("cx-period");
    (periods||[]).forEach(function(p){
      var id=canon(p&&(p.id||p.periodoId||p.periodId||p.value)||p);
      var name=text(p&&(p.label||p.nombre||p.periodoLabel));
      if(id&&name&&name!==id){periodNames[id]=name;}
    });
    state.periods=(periods||[]).map(function(p){return canon(p&&(p.id||p.periodoId||p.periodId||p.value)||p);}).filter(Boolean)
      .filter(function(v,i,all){return all.indexOf(v)===i;}).sort().reverse();
    select.textContent="";
    select.appendChild(el("option","Automático (del título de Moodle)")).value="";
    state.periods.forEach(function(id){var o=el("option",periodName(id));o.value=id;select.appendChild(o);});
  }
  function init(){
    $("cx-analyze").addEventListener("click",analyze);
    $("cx-save").addEventListener("click",save);
    $("cx-resync").addEventListener("click",resync);
    $("cx-period").addEventListener("change",function(){refreshSaved();});
    $("cx-clear").addEventListener("click",function(){$("cx-paste").value="";state.items=[];state.books=[];render();message("");});
    message("Conectando con BDLocal…");
    connect().then(function(c){return c.listPeriods();}).then(function(periods){
      fillPeriods(periods);message("Pegue uno o varios libros de Moodle y pulse Analizar.");refreshSaved();
    }).catch(function(error){message("No se pudo conectar con BDLocal: "+(error.message||error),"error");});
    render();
  }

  window.ComplexivoApp={version:VERSION,init:init,analyze:analyze,save:save,resync:resync,_state:state};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
})(window,document);
