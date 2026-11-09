/* =========================================================
Nombre completo: trabajo.firebase.js
Ruta: /Trabajo/trabajo.firebase.js
Función:
- Armar el documento /notas_trabajo/{periodoId__cedula} con el acta SENESCYT
  completa (estudiante, tutor, lector, vocales, criterios y promedios).
- Subirlo DIRECTO a Firebase igual que Carga: lee el remoto, si es igual no
  escribe; si falta o difiere escribe con control de versión y verifica.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-notas-trabajo";
  var COLLECTION="notas_trabajo";
  var PASSING=7;
  var scriptBase=(document&&document.currentScript&&document.currentScript.src)||(window.location&&window.location.href)||"";

  function text(value){return String(value==null?"":value).trim();}
  function url(relative){try{return new URL(relative,scriptBase).href;}catch(error){return relative;}}
  function mapper(){return window.RequisitosFirebaseMapper||null;}
  function repository(){return window.RequisitosFirebaseRepository||null;}
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

  function buildDocument(acta,context){
    context=context||{};
    var periodoId=text(context.periodoId),cedula=text(acta.cedula),stamp=new Date().toISOString();
    var doc={
      id:periodoId+"__"+cedula,localId:cedula+"__"+periodoId,periodoId:periodoId,cedula:cedula,
      nombres:text(acta.nombres),codigoCarrera:text(acta.codigoCarrera),nombreCarrera:text(acta.nombreCarrera),
      grupoInforme:text(context.grupoInforme),modalidadTitulacion:"TRABAJO_TITULACION",
      numeroActaSenescyt:text(acta.numeroActaSenescyt),fechaActaGrado:text(acta.fechaActaGrado),
      calificacionTutor:acta.calificacionTutor,calificacionLector:acta.calificacionLector,
      promedioTrabajoEscrito:acta.promedioTrabajoEscrito,
      vocales:(acta.vocales||[]).map(function(v){return {orden:v.orden,cargo:v.cargo,nombre:v.nombre};}),
      evaluacionPractica:acta.evaluacionPractica,evaluacionDefensa:acta.evaluacionDefensa,
      promedioEvaluacionPractica:acta.promedioEvaluacionPractica,
      promedioEvaluacionDefensa:acta.promedioEvaluacionDefensa,
      promedioDefensaOral:acta.promedioDefensaOral,
      notaFinal:acta.notaFinal,notaFinalCalculada:acta.notaFinalCalculada,
      notaMinimaAprobacion:PASSING,
      estadoEvaluacion:acta.notaFinal>=PASSING?"APROBADO":"NO_APROBADO",
      textoOriginalHash:text(acta.textoOriginalHash),origen:"trabajo",
      createdAt:text(context.createdAt)||stamp,updatedAt:stamp,version:1,eliminado:false,eliminadoEn:""
    };
    var map=mapper();
    doc.dataHash=map&&typeof map.dataHash==="function"
      ?map.dataHash({entity:COLLECTION,data:map.functionalContent(doc)})
      :"h"+text(acta.textoOriginalHash);
    return doc;
  }

  // Comparación funcional: el remoto es "igual" si coincide todo salvo metadatos.
  function sameContent(remote,doc){
    var map=mapper();
    if(!remote){return false;}
    if(map&&typeof map.dataHash==="function"){
      return map.dataHash({entity:COLLECTION,data:map.functionalContent(remote)})===doc.dataHash;
    }
    return text(remote.dataHash)===text(doc.dataHash);
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
            if(data&&sameContent(data,doc)){summary.iguales++;summary.resultados[doc.cedula]="IGUAL";return null;}
            if(data){doc.createdAt=text(data.createdAt)||doc.createdAt;doc.dataHash=buildHash(doc);}
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
  function buildHash(doc){
    var map=mapper();
    return map&&typeof map.dataHash==="function"?map.dataHash({entity:COLLECTION,data:map.functionalContent(doc)}):doc.dataHash;
  }
  function audit(repo,docs,summary,options){
    var map=mapper(),stamp=new Date().toISOString(),token=String(Date.now());
    var period=text(options.periodoId||(docs[0]&&docs[0].periodoId));
    function finish(entity,doc){
      doc.version=1;doc.eliminado=false;doc.createdAt=stamp;doc.updatedAt=stamp;
      doc.dataHash=map?map.dataHash({entity:entity,data:map.functionalContent(doc)}):"h"+token;return doc;
    }
    return repo.writeChecked("importaciones",finish("importaciones",{id:"trabajo__"+period+"__"+token,periodoId:period,
      archivoNombre:"Actas SENESCYT de trabajo de titulación",archivoTipo:"notas_trabajo",totalFilas:summary.total,
      nuevos:summary.nuevos,actualizados:summary.actualizados,sinCambios:summary.iguales,retirados:0,
      errores:summary.errores+summary.conflictos,estado:summary.ok?"COMPLETADO":"CON_INCIDENCIAS",source:"Trabajo.firebase.direct"}),
      {expected:{exists:false}})
    .then(function(){
      return repo.writeChecked("historial",finish("historial",{id:"trabajo_firebase__"+period+"__"+token,entidad:COLLECTION,
        entidadId:period,periodoId:period,accion:"ACTUALIZAR_FIREBASE_DESDE_TRABAJO",pantalla:"Trabajo",source:"Trabajo.firebase.direct",
        metadata:{total:summary.total,nuevos:summary.nuevos,actualizados:summary.actualizados,iguales:summary.iguales,
          actas:docs.map(function(d){return d.numeroActaSenescyt;})}}),{expected:{exists:false}});
    }).catch(function(error){summary.auditError=error&&error.message||String(error);});
  }

  window.TrabajoFirebase={version:VERSION,collection:COLLECTION,ensure:ensure,buildDocument:buildDocument,upload:upload};
})(window,typeof document!=="undefined"?document:null);
