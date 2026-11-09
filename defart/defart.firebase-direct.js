/* =========================================================
Nombre completo: defart.firebase-direct.js
Ruta: /defart/defart.firebase-direct.js
Función:
- Subir DIRECTAMENTE a Firebase (/notas) las calificaciones de Defensas del
  período seleccionado, igual que Carga sube sus datos.
- No usa la cola cambios_pendientes ni el límite de 25 cambios por clic:
  toma todas las notas guardadas en BDLocal para el período.
- Compara cada documento con Firebase por dataHash: los iguales no se escriben;
  los nuevos o distintos se escriben con control de versión sobre el estado
  remoto recién leído (si otro equipo lo cambia en medio, se marca conflicto).
- Verifica con una lectura posterior y registra importaciones e historial.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-direct-like-carga";
  var CONCURRENCY=8;
  var running=false;
  var scriptBase=(document.currentScript&&document.currentScript.src)||window.location.href;

  function byId(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function canon(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function periodId(){return canon(byId("def-filter-periodo")&&byId("def-filter-periodo").value);}
  function setNumber(id,value){var node=byId(id);if(node){node.textContent=String(Number(value||0));}}
  function status(message,type){var node=byId("def-firebase-status");if(node){node.textContent=text(message);node.className="def-firebase-status "+(type||"");}}
  function center(){return window.RequisitosFirebaseOperationCenter||null;}
  function repository(){return window.RequisitosFirebaseRepository||null;}
  function mapper(){return window.RequisitosFirebaseMapper||null;}
  function notesRepo(){
    var repos=window.BDLRepositories;
    return (repos&&typeof repos.get==="function"&&(repos.get("notas")||repos.get("notas_titulacion")))||window.BDLRepoNotas||null;
  }
  function url(relative){try{return new URL(relative,scriptBase).href;}catch(error){return relative;}}
  function loadScript(relative,test){
    if(test()){return Promise.resolve(test());}
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=url(relative);script.async=false;
      script.onload=function(){test()?resolve(test()):reject(new Error(relative+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function ensureFirebase(){
    var api=center();
    if(!api){return Promise.reject(new Error("El Centro de Operaciones Firebase no está disponible."));}
    // Misma conexión directa que Carga: App + Firestore + firebase-config + repositorio.
    var ready=typeof api.ensureNcomplex==="function"?api.ensureNcomplex():api.ensure();
    return Promise.resolve(ready).then(function(){
      return loadScript("../BDLocal/firebase/bdl.firebase.mapper.v2.js",mapper);
    }).then(function(){
      var repo=repository();
      if(!repo||typeof repo.writeChecked!=="function"||typeof repo.getById!=="function"){
        throw new Error("El repositorio Firebase no está disponible.");
      }
      return repo;
    });
  }
  function ensureLocal(){
    var con=window.ConDefart;
    var ready=con&&typeof con.ready==="function"?con.ready():Promise.resolve({ok:true});
    return Promise.resolve(ready).then(function(){
      var repo=notesRepo();
      if(!repo||typeof repo.list!=="function"){throw new Error("BDLocal no expone las notas de Defensas.");}
      return repo;
    });
  }

  function hasDefenseGrade(row){
    var names=["notaArticulo","notaDefensa","notaFinal","Notart","Notdef","Notafinal","Nart","Ndef","Nfinal","notaEscrito","notaDefensaTrabajo"];
    return names.some(function(name){var v=row&&row[name];return v!==null&&v!==undefined&&text(v)!=="";});
  }
  function buildDocuments(rows,period){
    var map=mapper(),repo=repository(),out=[],skipped=[],seen=Object.create(null);
    rows.forEach(function(row){
      if(!row||row.eliminado===true||!hasDefenseGrade(row)){return;}
      if(canon(row.periodoId||row.periodId)!==period){return;}
      var doc=map.notesDocument(row,{});
      if(!doc){skipped.push(text(row.cedula)||text(row.id));return;}
      var id=repo.documentId("notas",doc);
      if(!id){skipped.push(text(doc.cedula));return;}
      if(seen[id]){return;}
      seen[id]=true;
      out.push({id:id,document:doc});
    });
    return {entries:out,skipped:skipped};
  }

  function pool(items,worker,onDone){
    var index=0,done=0;
    function run(){
      if(index>=items.length){return Promise.resolve();}
      var item=items[index++];
      return Promise.resolve(worker(item)).then(function(){done++;if(onDone){onDone(done,items.length);}return run();});
    }
    var runners=[];
    for(var i=0;i<Math.min(CONCURRENCY,items.length);i++){runners.push(run());}
    return Promise.all(runners);
  }

  function writeAudit(repo,period,summary){
    var stamp=now(),token=String(Date.now());
    var map=mapper();
    function withHash(entity,doc){
      doc.version=1;doc.eliminado=false;
      doc.dataHash=map&&typeof map.dataHash==="function"&&typeof map.functionalContent==="function"
        ?map.dataHash({entity:entity,data:map.functionalContent(doc)}):("h"+token);
      return doc;
    }
    var importDoc=withHash("importaciones",{
      id:"defensas__"+period+"__"+token,periodoId:period,archivoNombre:"Defensas (BDLocal)",archivoTipo:"notas_defensas",
      totalFilas:summary.total,nuevos:summary.nuevos,actualizados:summary.modificados,sinCambios:summary.iguales,
      retirados:0,errores:summary.errores+summary.conflictos,estado:summary.errores||summary.conflictos?"CON_INCIDENCIAS":"COMPLETADO",
      source:"Defensas.firebase.direct",createdAt:stamp,updatedAt:stamp
    });
    var historyDoc=withHash("historial",{
      id:"defensas_firebase__"+period+"__"+token,entidad:"notas",entidadId:period,periodoId:period,
      accion:"ACTUALIZAR_FIREBASE_DESDE_DEFENSAS",pantalla:"Defensas",source:"Defensas.firebase.direct",
      metadata:{total:summary.total,nuevos:summary.nuevos,modificados:summary.modificados,iguales:summary.iguales,
        conflictos:summary.conflictos,errores:summary.errores},
      createdAt:stamp,updatedAt:stamp
    });
    return repo.writeChecked("importaciones",importDoc,{expected:{exists:false}})
      .then(function(){return repo.writeChecked("historial",historyDoc,{expected:{exists:false}});})
      .catch(function(error){summary.auditError=error&&error.message?error.message:String(error);});
  }

  function uploadAll(options){
    options=options||{};
    var period=canon(options.periodoId||periodId());
    if(!period){return Promise.reject(new Error("Seleccione un período."));}
    if(running){return Promise.reject(new Error("Ya hay una subida de Defensas en curso."));}
    running=true;
    var progress=typeof options.onProgress==="function"?options.onProgress:function(){};
    var summary={ok:false,periodoId:period,total:0,nuevos:0,modificados:0,iguales:0,conflictos:0,errores:0,
      noVerificados:0,omitidos:0,detalles:[],version:VERSION};
    var repo=null;
    return Promise.all([ensureFirebase(),ensureLocal()]).then(function(out){
      repo=out[0];
      progress("Leyendo notas de BDLocal…",0,0);
      return out[1].list({periodoId:period});
    }).then(function(rows){
      var built=buildDocuments(Array.isArray(rows)?rows:[],period);
      summary.total=built.entries.length;summary.omitidos=built.skipped.length;
      if(!built.entries.length){return null;}
      progress("Comparando con Firebase…",0,built.entries.length);
      // 1) Leer el estado remoto (como Carga) para no reescribir lo igual.
      var pending=[];
      return pool(built.entries,function(entry){
        return repo.getById("notas",entry.id).then(function(remote){
          var data=remote&&remote.data||null;
          if(data&&text(data.dataHash)&&text(data.dataHash)===text(entry.document.dataHash)){summary.iguales++;return;}
          entry.expected=data?{exists:true,hash:text(data.dataHash),version:Number(data.version||0),updatedAt:text(data.updatedAt)}:{exists:false};
          entry.isNew=!data;
          pending.push(entry);
        }).catch(function(error){summary.errores++;summary.detalles.push(entry.id+": "+(error.message||error));});
      },function(done,total){progress("Comparando con Firebase…",done,total);}).then(function(){
        if(!pending.length){return null;}
        // 2) Escribir con control de versión y 3) verificar con lectura posterior.
        return pool(pending,function(entry){
          return repo.writeChecked("notas",entry.document,{expected:entry.expected,documentId:entry.id}).then(function(result){
            if(!result||result.ok!==true){throw new Error("Firebase no confirmó la escritura.");}
            return repo.getById("notas",entry.id);
          }).then(function(check){
            if(!check||!check.data||text(check.data.dataHash)!==text(entry.document.dataHash)){
              summary.noVerificados++;summary.detalles.push(entry.id+": no se pudo verificar la lectura posterior.");return;
            }
            if(entry.isNew){summary.nuevos++;}else{summary.modificados++;}
          }).catch(function(error){
            if(error&&error.code==="FIREBASE_CONFLICT"){summary.conflictos++;summary.detalles.push(entry.id+": cambió en Firebase durante la subida; vuelva a pulsar Subir.");return;}
            summary.errores++;summary.detalles.push(entry.id+": "+(error&&error.message||error));
          });
        },function(done,total){progress("Subiendo a Firebase…",done,total);});
      });
    }).then(function(){
      summary.ok=summary.errores===0&&summary.conflictos===0&&summary.noVerificados===0;
      if(summary.total&&(summary.nuevos||summary.modificados)){return writeAudit(repo,period,summary);}
    }).then(function(){
      try{window.dispatchEvent(new CustomEvent("requisitos:defensas-firebase-direct",{detail:summary}));}catch(error){}
      return summary;
    }).finally(function(){running=false;});
  }

  function render(summary){
    setNumber("defFirebasePending",summary.total);
    setNumber("defFirebaseNew",summary.nuevos);
    setNumber("defFirebaseModified",summary.modificados);
    setNumber("defFirebaseUnchanged",summary.iguales);
    setNumber("defFirebaseConflicts",summary.conflictos);
    if(!summary.total){status("No hay notas de Defensas guardadas en BDLocal para este período.","is-warn");return;}
    var line="Firebase /notas: "+summary.nuevos+" nuevas · "+summary.modificados+" actualizadas · "+summary.iguales+" ya iguales";
    if(summary.ok){status(line+". Todo verificado.","is-ok");}
    else{
      status(line+" · "+summary.conflictos+" conflictos · "+(summary.errores+summary.noVerificados)+" errores. "+
        (summary.detalles.slice(0,2).join(" | ")||""),"is-danger");
    }
  }
  function install(){
    var analyzeButton=byId("def-btn-firebase-analyze");
    var parent=analyzeButton&&analyzeButton.parentNode;
    if(!parent||byId("def-btn-firebase-direct")){return !!parent;}
    var button=document.createElement("button");
    button.type="button";button.id="def-btn-firebase-direct";
    button.textContent="Subir a Firebase";
    button.title="Sube directo todas las notas de Defensas del período (igual que Carga)";
    parent.insertBefore(button,parent.firstChild);
    // Un solo camino de subida: la cola antigua de 25 cambios queda oculta para no
    // reenviar copias viejas encima de las notas actuales.
    ["def-btn-firebase-analyze","def-btn-firebase-push","def-btn-firebase-rebuild"].forEach(function(id){
      var node=byId(id);if(node){node.hidden=true;}
    });
    var copy=document.querySelector(".def-firebase-copy span");
    if(copy){copy.textContent="Sube directo a Firebase N-ART, N-DEF, N-FIN y el estado de evaluación de todo el período seleccionado, igual que Carga.";}
    function refreshState(){button.disabled=running||!periodId();}
    button.addEventListener("click",function(){
      if(running||!periodId()){return;}
      button.disabled=true;
      uploadAll({onProgress:function(label,done,total){status(label+(total?" "+done+" / "+total:""),"is-warn");}})
        .then(render)
        .catch(function(error){status("No se pudo subir a Firebase: "+(error&&error.message||error)+". Las notas siguen en BDLocal.","is-danger");})
        .then(refreshState);
    });
    var select=byId("def-filter-periodo");
    if(select){select.addEventListener("change",function(){refreshState();status(periodId()?"Pulse «Subir a Firebase» para enviar las notas del período.":"Seleccione un período.","");});}
    // La cola antigua puede volver a mostrar sus botones; mantenerlos ocultos.
    window.setTimeout(function(){["def-btn-firebase-rebuild"].forEach(function(id){var n=byId(id);if(n){n.hidden=true;}});},1500);
    refreshState();
    return true;
  }

  window.DefartFirebaseDirect={version:VERSION,uploadAll:uploadAll,buildDocuments:buildDocuments,install:install};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",install);}else{install();}
})(window,document);
