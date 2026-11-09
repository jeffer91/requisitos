/* =========================================================
Nombre completo: complexivo.firebase.js
Ruta: /Complexivo/complexivo.firebase.js
Función:
- Armar /notas_complexivo/{periodoId__cedula} con las notas del examen y el
  resultado calculado por la app (40 % teórico + 60 % práctico).
- Subirlo DIRECTO a Firebase igual que Carga: lee el remoto, si es igual no
  escribe; si falta o difiere escribe con control de versión y verifica.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-notas-complexivo";
  var COLLECTION="notas_complexivo";
  var scriptBase=(document&&document.currentScript&&document.currentScript.src)||(window.location&&window.location.href)||"";

  function text(value){return String(value==null?"":value).trim();}
  function url(relative){try{return new URL(relative,scriptBase).href;}catch(error){return relative;}}
  function mapper(){return window.RequisitosFirebaseMapper||null;}
  function repository(){return window.RequisitosFirebaseRepository||null;}
  function num(v){return v===null||v===undefined||!Number.isFinite(v)?null:v;}
  function loadScript(relative,test){
    if(test()){return Promise.resolve(test());}
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");script.src=url(relative);script.async=false;
      script.onload=function(){test()?resolve(test()):reject(new Error(relative+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    });
  }
  function ensure(){
    var center=window.RequisitosFirebaseOperationCenter;
    if(!center){return Promise.reject(new Error("El Centro de Operaciones Firebase no está disponible."));}
    var ready=typeof center.ensureNcomplex==="function"?center.ensureNcomplex():center.ensure();
    return Promise.resolve(ready).then(function(){
      return loadScript("../BDLocal/firebase/bdl.firebase.mapper.v2.js",mapper);
    }).then(function(){
      var repo=repository();
      if(!repo||typeof repo.writeChecked!=="function"){throw new Error("El repositorio Firebase no está disponible.");}
      return repo;
    });
  }
  function hashOf(doc){
    var map=mapper();
    return map&&typeof map.dataHash==="function"?map.dataHash({entity:COLLECTION,data:map.functionalContent(doc)}):"h"+Date.now();
  }

  // entry: {periodoId, cedula, nombres, correo, codigoCarrera, nombreCarrera, grupoInforme, cursoMoodle, fila, resultado}
  function buildDocument(entry){
    var o=entry.fila.ordinaria||{},s=entry.fila.supletorio||{},r=entry.resultado,stamp=new Date().toISOString();
    var doc={
      id:entry.periodoId+"__"+entry.cedula,localId:entry.cedula+"__"+entry.periodoId,
      periodoId:entry.periodoId,cedula:entry.cedula,nombres:text(entry.nombres),correo:text(entry.correo),
      codigoCarrera:text(entry.codigoCarrera),nombreCarrera:text(entry.nombreCarrera),grupoInforme:text(entry.grupoInforme),
      modalidadTitulacion:"EXAMEN_COMPLEXIVO",cursoMoodle:text(entry.cursoMoodle),
      notaTeorica:num(o.teorico),notaPractica:num(o.practico),notaOrdinaria:num(r.notaOrdinaria),
      notaTeoricaSupletorio:num(s.teorico),notaPracticaSupletorio:num(s.practico),notaSupletorio:num(r.notaSupletorio),
      notaOficial:r.notaOficial,notaMinimaAprobacion:7,oportunidadAplicada:r.oportunidadAplicada,
      estadoEvaluacion:r.estadoEvaluacion,observaciones:(r.observaciones||[]).join(" "),
      origen:"complexivo_moodle",createdAt:text(entry.createdAt)||stamp,updatedAt:stamp,version:1,eliminado:false,eliminadoEn:""
    };
    doc.dataHash=hashOf(doc);
    return doc;
  }

  function upload(docs,options){
    options=options||{};
    var progress=typeof options.onProgress==="function"?options.onProgress:function(){};
    var summary={ok:false,total:docs.length,nuevos:0,actualizados:0,iguales:0,conflictos:0,errores:0,detalles:[],resultados:{}};
    return ensure().then(function(repo){
      var chain=Promise.resolve(),done=0;
      docs.forEach(function(doc){
        chain=chain.then(function(){
          return repo.getById(COLLECTION,doc.id).then(function(remote){
            var data=remote&&remote.data||null;
            if(data&&hashOf(data)===doc.dataHash){summary.iguales++;summary.resultados[doc.cedula]="IGUAL";return null;}
            if(data){doc.createdAt=text(data.createdAt)||doc.createdAt;}
            var expected=data?{exists:true,hash:text(data.dataHash),version:Number(data.version||0),updatedAt:text(data.updatedAt)}:{exists:false};
            return repo.writeChecked(COLLECTION,doc,{expected:expected,documentId:doc.id}).then(function(result){
              if(!result||result.ok!==true){throw new Error("Firebase no confirmó la escritura.");}
              return repo.getById(COLLECTION,doc.id);
            }).then(function(check){
              if(!check||!check.data||text(check.data.dataHash)!==text(doc.dataHash)){throw new Error("La lectura posterior no coincide.");}
              if(data){summary.actualizados++;summary.resultados[doc.cedula]="ACTUALIZADO";}
              else{summary.nuevos++;summary.resultados[doc.cedula]="NUEVO";}
            });
          }).catch(function(error){
            if(error&&error.code==="FIREBASE_CONFLICT"){summary.conflictos++;summary.resultados[doc.cedula]="CONFLICTO";
              summary.detalles.push(doc.cedula+": cambió en Firebase durante la subida; vuelva a subir.");return;}
            summary.errores++;summary.resultados[doc.cedula]="ERROR";
            summary.detalles.push(doc.cedula+": "+(error&&error.message||error));
          }).then(function(){done++;progress(done,docs.length);});
        });
      });
      return chain.then(function(){
        summary.ok=summary.errores===0&&summary.conflictos===0;
        if(summary.nuevos||summary.actualizados){return audit(repo,docs,summary,options);}
      }).then(function(){return summary;});
    });
  }
  function audit(repo,docs,summary,options){
    var map=mapper(),stamp=new Date().toISOString(),token=String(Date.now());
    var period=text(options.periodoId||(docs[0]&&docs[0].periodoId));
    function finish(entity,doc){
      doc.version=1;doc.eliminado=false;doc.createdAt=stamp;doc.updatedAt=stamp;
      doc.dataHash=map?map.dataHash({entity:entity,data:map.functionalContent(doc)}):"h"+token;return doc;
    }
    var cursos=docs.map(function(d){return d.cursoMoodle;}).filter(function(v,i,a){return v&&a.indexOf(v)===i;});
    return repo.writeChecked("importaciones",finish("importaciones",{id:"complexivo__"+period+"__"+token,periodoId:period,
      archivoNombre:cursos.join(" · ")||"Moodle - Examen Complexivo",archivoTipo:"notas_complexivo",totalFilas:summary.total,
      nuevos:summary.nuevos,actualizados:summary.actualizados,sinCambios:summary.iguales,retirados:0,
      errores:summary.errores+summary.conflictos,estado:summary.ok?"COMPLETADO":"CON_INCIDENCIAS",source:"Complexivo.firebase.direct"}),
      {expected:{exists:false}})
    .then(function(){
      return repo.writeChecked("historial",finish("historial",{id:"complexivo_firebase__"+period+"__"+token,entidad:COLLECTION,
        entidadId:period,periodoId:period,accion:"ACTUALIZAR_FIREBASE_DESDE_COMPLEXIVO",pantalla:"Complexivo",source:"Complexivo.firebase.direct",
        metadata:{total:summary.total,nuevos:summary.nuevos,actualizados:summary.actualizados,iguales:summary.iguales,cursos:cursos}}),{expected:{exists:false}});
    }).catch(function(error){summary.auditError=error&&error.message||String(error);});
  }

  window.ComplexivoFirebase={version:VERSION,collection:COLLECTION,ensure:ensure,buildDocument:buildDocument,upload:upload};
})(window,typeof document!=="undefined"?document:null);
