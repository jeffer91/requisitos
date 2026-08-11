/* =========================================================
Nombre completo: carga.firebase-supervisor.js
Ruta: /Carga/carga.firebase-supervisor.js
Función:
- Supervisar la acción única Actualizar Firebase sin crear otra conexión.
- Impedir que un archivo analizado para un período se suba a otro período.
- Explicar que 25 es el tamaño del lote y no el total de la carga.
- Verificar al final que el roster actual exista 1:1 en Estudiante, matriculas y requisitos.
- Reportar la colección exacta cuando una escritura Firebase falle.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-completeness-supervisor";
  var FLAG="__cargaFirebaseSupervisorBound";
  var repositoryPatched=false;

  function text(value){return String(value==null?"":value).trim();}
  function canon(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function normalizeCedula(value){
    var rules=window.BDLRulesPersona||{};
    if(typeof rules.normalizeCedula==="function"){
      try{return text(rules.normalizeCedula(value));}catch(error){}
    }
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function first(row,names){
    row=row||{};
    for(var i=0;i<(names||[]).length;i+=1){
      var value=row[names[i]];
      if(value!==undefined&&value!==null&&text(value)!==""){return value;}
    }
    return "";
  }
  function cedulaOf(row){
    return normalizeCedula(first(row,[
      "cedula","numeroIdentificacion","NumeroIdentificacion","identificacion",
      "Cedula","Cédula","_cedula"
    ]));
  }
  function byId(id){return document&&document.getElementById?document.getElementById(id):null;}
  function status(label,type){
    var node=byId("cargaFirebaseStatus");
    if(node){node.textContent=text(label);node.setAttribute("data-status",text(type||""));}
  }
  function message(value,type){
    var node=byId("cargaFirebaseMessage");
    if(node){node.textContent=text(value);node.className="carga-firebase-message "+text(type||"");}
  }
  function selectedPeriod(){return canon(byId("cargaPeriodoSelect")&&byId("cargaPeriodoSelect").value||"");}
  function currentState(){
    try{return window.CargaState&&typeof window.CargaState.get==="function"?window.CargaState.get():null;}
    catch(error){return null;}
  }
  function currentRows(){
    var state=currentState()||{};
    var normalized=state.normalized||{};
    var rows=Array.isArray(normalized.rowsMapeadas)?normalized.rowsMapeadas:
      Array.isArray(normalized.rows)?normalized.rows:
      Array.isArray(normalized.students)?normalized.students:[];
    var map=Object.create(null);
    rows.forEach(function(row){var cedula=cedulaOf(row);if(cedula){map[cedula]=row;}});
    return Object.keys(map).sort().map(function(key){return map[key];});
  }
  function analyzedPeriod(){
    var state=currentState()||{};
    var normalized=state.normalized||{};
    var detected=normalized.periodoDetectado||{};
    return canon(detected.periodoId||detected.periodoCanonicoId||"");
  }
  function setOf(values){
    var map=Object.create(null);
    (values||[]).forEach(function(value){value=normalizeCedula(value);if(value){map[value]=true;}});
    return map;
  }
  function missing(expectedMap,actualMap){
    return Object.keys(expectedMap).filter(function(key){return actualMap[key]!==true;});
  }
  function repo(){return window.RequisitosFirebaseRepository||null;}

  function patchRepositoryErrors(){
    var current=repo();
    if(!current||typeof current.writeManyChecked!=="function"){return false;}
    if(current.__cargaSupervisorVersion===VERSION){repositoryPatched=true;return true;}
    var original=current.writeManyChecked.bind(current);
    current.writeManyChecked=function(entity,entries,options){
      return Promise.resolve(original(entity,entries,options)).catch(function(error){
        var collection=text(entity);
        try{if(typeof current.collectionName==="function"){collection=current.collectionName(entity)||collection;}}catch(inner){}
        var base=error&&error.message?error.message:String(error);
        var wrapped=new Error("Falló la colección "+collection+": "+base);
        wrapped.cause=error;
        wrapped.firebaseEntity=entity;
        wrapped.firebaseCollection=collection;
        throw wrapped;
      });
    };
    current.__cargaSupervisorVersion=VERSION;
    repositoryPatched=true;
    return true;
  }

  function listEntity(entity,options){
    var current=repo();
    if(!current||typeof current.list!=="function"){return Promise.reject(new Error("Repositorio Firebase no disponible para verificar "+entity+"."));}
    return current.list(entity,Object.assign({limit:1000,includeDeleted:false},options||{}));
  }
  function getStudentIds(ids){
    var current=repo();
    if(!current||typeof current.getById!=="function"){return Promise.reject(new Error("Repositorio Firebase no permite verificar Estudiante."));}
    ids=Array.isArray(ids)?ids:[];
    var found=Object.create(null),index=0;
    function batch(){
      var slice=ids.slice(index,index+12);index+=slice.length;
      if(!slice.length){return Promise.resolve(found);}
      return Promise.all(slice.map(function(id){
        return current.getById("estudiantes",id).then(function(item){if(item&&item.data&&item.data.eliminado!==true){found[id]=true;}});
      })).then(batch);
    }
    return batch();
  }
  function cedulasFromDocuments(result){
    var map=Object.create(null);
    (result&&result.documents||[]).forEach(function(item){
      var data=item&&item.data||{};
      if(data.eliminado===true){return;}
      var cedula=normalizeCedula(data.cedula||data.numeroIdentificacion||"");
      if(cedula){map[cedula]=true;}
    });
    return map;
  }
  function verifyRemote(periodoId,rows){
    periodoId=canon(periodoId);rows=Array.isArray(rows)?rows:[];
    var ids=rows.map(cedulaOf).filter(Boolean);
    var expected=setOf(ids);
    return Promise.all([
      listEntity("matriculas",{periodoId:periodoId}),
      listEntity("requisitos",{periodoId:periodoId}),
      getStudentIds(ids)
    ]).then(function(values){
      var enrollmentSet=cedulasFromDocuments(values[0]);
      var requirementsSet=cedulasFromDocuments(values[1]);
      var studentsSet=values[2]||{};
      var missStudents=missing(expected,studentsSet);
      var missEnrollments=missing(expected,enrollmentSet);
      var missRequirements=missing(expected,requirementsSet);
      return {
        ok:!missStudents.length&&!missEnrollments.length&&!missRequirements.length,
        expected:ids.length,
        estudiantes:ids.length-missStudents.length,
        matriculas:ids.length-missEnrollments.length,
        requisitos:ids.length-missRequirements.length,
        missingStudents:missStudents,
        missingEnrollments:missEnrollments,
        missingRequirements:missRequirements
      };
    });
  }

  function preflight(){
    var periodoId=selectedPeriod();
    if(!periodoId){return {ok:false,message:"Seleccione un período antes de actualizar Firebase."};}
    var rows=currentRows();
    var analyzed=analyzedPeriod();
    if(rows.length&&analyzed&&analyzed!==periodoId){
      return {
        ok:false,
        message:"El archivo actual fue analizado para "+analyzed+" pero Firebase está apuntando a "+periodoId+". Vuelva a analizar el archivo con el período correcto antes de subir."
      };
    }
    return {ok:true,periodoId:periodoId,rows:rows};
  }

  function run(){
    var smart=window.CargaFirebaseSmart||null;
    if(!smart||typeof smart.update!=="function"){return Promise.reject(new Error("El controlador inteligente Firebase no está disponible."));}
    var check=preflight();
    if(!check.ok){
      status("Bloqueado","is-danger");message(check.message,"is-danger");
      return Promise.resolve({ok:false,blocked:true,message:check.message});
    }
    patchRepositoryErrors();
    if(check.rows.length){
      status("Preparando","is-warn");
      message("Se cargarán "+check.rows.length+" estudiantes. Los lotes son de hasta 25 y continuarán automáticamente hasta terminar.","");
    }
    return smart.update().then(function(result){
      result=result||{};
      if(result.ok===false||result.stopped||result.emptyLocal){return result;}
      if(!check.rows.length){return result;}
      status("Verificando","is-warn");
      message("La subida terminó. Verificando que Estudiante, matrículas y requisitos estén completos...","");
      return verifyRemote(check.periodoId,check.rows).then(function(verification){
        result.verification=verification;
        if(!verification.ok){
          result.ok=false;result.incomplete=true;
          status("Incompleto","is-danger");
          message(
            "Firebase quedó incompleto. Esperados "+verification.expected+
            ": Estudiante "+verification.estudiantes+", matrículas "+verification.matriculas+
            ", requisitos "+verification.requisitos+". No se considera finalizada la actualización.",
            "is-danger"
          );
          return result;
        }
        status("Completo","is-ok");
        message(
          "Firebase verificado: "+verification.expected+" Estudiante, "+
          verification.expected+" matrículas y "+verification.expected+
          " requisitos del período. Los lotes de 25 se procesaron automáticamente.",
          "is-ok"
        );
        return result;
      });
    }).catch(function(error){
      status("Error","is-danger");message(error&&error.message?error.message:String(error),"is-danger");
      return {ok:false,message:error&&error.message?error.message:String(error)};
    });
  }

  function bind(){
    patchRepositoryErrors();
    if(window[FLAG]){return true;}
    var current=byId("cargaBtnFirebaseActualizar");
    if(!current||!current.parentNode){return false;}
    var button=current.cloneNode(true);
    current.parentNode.replaceChild(button,current);
    button.__firebaseSupervisorBound=true;
    button.addEventListener("click",function(event){
      event.preventDefault();event.stopPropagation();
      if(typeof event.stopImmediatePropagation==="function"){event.stopImmediatePropagation();}
      run();
    },true);
    window[FLAG]=true;
    return true;
  }

  window.addEventListener("requisitos:firebase-repository-ready",patchRepositoryErrors);
  window.CargaFirebaseSupervisor={
    version:VERSION,bind:bind,run:run,preflight:preflight,
    verifyRemote:verifyRemote,currentRows:currentRows,
    status:function(){return {version:VERSION,bound:!!window[FLAG],rows:currentRows().length,periodoId:selectedPeriod(),analyzedPeriod:analyzedPeriod(),repositoryPatched:repositoryPatched};}
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){window.setTimeout(bind,0);},{once:true});
  }else{window.setTimeout(bind,0);}
})(window,document);
