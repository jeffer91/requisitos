/* =========================================================
Nombre completo: carga.firebase-finalize.js
Ruta: /Carga/carga.firebase-finalize.js
Función:
- Hacer que la carga actual sea el roster autoritativo cuando existe un archivo analizado.
- Reconfirmar BDLocal desde las filas actuales antes de preparar Firebase.
- Impedir que estudiantes antiguos sigan ACTIVO por error.
- Validar que Estudiante, matriculas y requisitos se preparen 1:1 con el roster actual.
- Acelerar la carga inicial de una Firebase confirmada vacía sin hacer lecturas remotas por documento.
- Mantener la escritura atómica y lotes máximos de 25 del motor existente.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-authoritative-fast-bootstrap";
  var installed=[];
  var trapInstalled=false;

  function text(value){return String(value==null?"":value).trim();}
  function canon(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function normalizeKey(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
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
  function rowsFromCurrentLoad(){
    try{
      var state=window.CargaState&&typeof window.CargaState.get==="function"?window.CargaState.get():null;
      var normalized=state&&state.normalized||{};
      var rows=Array.isArray(normalized.rowsMapeadas)?normalized.rowsMapeadas:
        Array.isArray(normalized.rows)?normalized.rows:
        Array.isArray(normalized.students)?normalized.students:[];
      return rows.filter(function(row){return !!cedulaOf(row);});
    }catch(error){return [];}
  }
  function uniqueCurrentRows(){
    var map=Object.create(null);
    rowsFromCurrentLoad().forEach(function(row){
      var cedula=cedulaOf(row);
      if(cedula){map[cedula]=row;}
    });
    return Object.keys(map).sort().map(function(cedula){return map[cedula];});
  }
  function periodLabel(periodoId){
    try{
      var select=window.document&&window.document.getElementById("cargaPeriodoSelect");
      if(select&&select.selectedIndex>=0){
        return text(select.options[select.selectedIndex]&&select.options[select.selectedIndex].text)||periodoId;
      }
    }catch(error){}
    return periodoId;
  }
  function ensureCurrentLoadInBDLocal(periodoId){
    var rows=uniqueCurrentRows();
    if(!rows.length){return Promise.resolve({used:false,rows:0,cedulas:[]});}
    var core=window.BL2Core;
    if(!core||typeof core.saveStudents!=="function"){
      return Promise.reject(new Error("BL2Core.saveStudents no está disponible para consolidar la carga actual."));
    }
    var cedulas=rows.map(cedulaOf).filter(Boolean);
    return core.saveStudents(rows,{
      normalized:true,
      periodoId:periodoId,
      periodoCanonicoId:periodoId,
      periodoLabel:periodLabel(periodoId),
      periodoCanonicoLabel:periodLabel(periodoId),
      source:"firebase_authoritative_roster",
      sync:false,
      markRetired:true
    }).then(function(result){
      if(!result||result.ok===false){
        throw new Error(result&&result.message||"No se pudo consolidar la carga actual en BDLocal.");
      }
      return {used:true,rows:rows.length,cedulas:cedulas,result:result};
    });
  }
  function isCarga(scope){return normalizeKey(scope)==="carga";}

  function installOnCenter(center){
    if(!center||installed.indexOf(center)>=0){return !!center;}

    var originalRequeue=typeof center.requeue==="function"?center.requeue.bind(center):null;
    var originalAnalyze=typeof center.analyze==="function"?center.analyze.bind(center):null;

    if(originalRequeue){
      var wrappedRequeue=function(scope,options){
        options=Object.assign({},options||{});
        if(!isCarga(scope)){return originalRequeue(scope,options);}
        var periodoId=canon(options.periodoId||options.periodId||"");
        if(!periodoId){return Promise.resolve({ok:false,scope:"carga",message:"Seleccione un período antes de preparar Firebase."});}

        return ensureCurrentLoadInBDLocal(periodoId).then(function(authority){
          return originalRequeue(scope,options).then(function(result){
            result=result||{};
            if(result.ok===false){return result;}
            if(authority.used){
              var expected=authority.rows;
              var actualStudents=Number(result.estudiantesActivos||0);
              var actualEnrollments=Number(result.matriculas||0);
              var actualRequirements=Number(result.requisitos||0);
              if(actualStudents!==expected||actualEnrollments!==expected||actualRequirements!==expected){
                return Object.assign({},result,{
                  ok:false,
                  expectedRoster:expected,
                  message:"La preparación Firebase quedó incompleta: se esperaban "+expected+
                    " Estudiante, "+expected+" matrículas y "+expected+" requisitos; se prepararon "+
                    actualStudents+", "+actualEnrollments+" y "+actualRequirements+". No se subió nada."
                });
              }
              result.rosterSource="carga_actual";
              result.expectedRoster=expected;
              result.currentLoadAuthoritative=true;
            }
            return result;
          });
        });
      };

      try{
        Object.defineProperty(center,"requeue",{
          configurable:true,enumerable:true,writable:true,value:wrappedRequeue
        });
      }catch(error){center.requeue=wrappedRequeue;}

      center.__localSourceRebuildGate=true;
      center.__firebaseAuthoritativeRosterVersion=VERSION;
    }

    if(originalAnalyze){
      center.analyze=function(scope,options){
        options=Object.assign({},options||{});
        var fastBootstrap=isCarga(scope)&&/bootstrapanalyze/.test(normalizeKey(options.source||""));
        if(!fastBootstrap){return originalAnalyze(scope,options);}

        var repo=window.RequisitosFirebaseRepository;
        if(!repo||typeof repo.getById!=="function"){return originalAnalyze(scope,options);}
        var originalGetById=repo.getById;
        repo.getById=function(){return Promise.resolve(null);};
        return Promise.resolve(originalAnalyze(scope,options)).finally(function(){
          repo.getById=originalGetById;
        });
      };
      center.__firebaseFastBootstrapVersion=VERSION;
    }

    installed.push(center);
    return true;
  }

  function installTrap(){
    if(trapInstalled){return true;}
    trapInstalled=true;
    var name="RequisitosFirebaseOperationCenter";
    var descriptor;
    try{descriptor=Object.getOwnPropertyDescriptor(window,name);}catch(error){descriptor=null;}

    if(descriptor&&descriptor.configurable===false){
      if(window[name]){installOnCenter(window[name]);}
      return true;
    }

    var stored=descriptor&&descriptor.get?undefined:window[name];
    var oldGet=descriptor&&descriptor.get;
    var oldSet=descriptor&&descriptor.set;

    try{
      Object.defineProperty(window,name,{
        configurable:true,enumerable:true,
        get:function(){
          return oldGet?oldGet.call(window):stored;
        },
        set:function(value){
          if(oldSet){oldSet.call(window,value);}else{stored=value;}
          var current=oldGet?oldGet.call(window):stored;
          if(current){installOnCenter(current);}
        }
      });
      var current=oldGet?oldGet.call(window):stored;
      if(current){installOnCenter(current);}
      return true;
    }catch(error){
      if(window[name]){installOnCenter(window[name]);}
      return false;
    }
  }

  window.CargaFirebaseFinalize={
    version:VERSION,
    install:function(){
      installTrap();
      if(window.RequisitosFirebaseOperationCenter){installOnCenter(window.RequisitosFirebaseOperationCenter);}
      return true;
    },
    installOnCenter:installOnCenter,
    currentRows:uniqueCurrentRows,
    status:function(){
      var center=window.RequisitosFirebaseOperationCenter;
      return {
        version:VERSION,
        currentRows:uniqueCurrentRows().length,
        centerInstalled:!!(center&&center.__firebaseAuthoritativeRosterVersion),
        fastBootstrap:!!(center&&center.__firebaseFastBootstrapVersion)
      };
    }
  };

  window.CargaFirebaseFinalize.install();
  window.setInterval(function(){
    if(window.RequisitosFirebaseOperationCenter){installOnCenter(window.RequisitosFirebaseOperationCenter);}
  },50);
})(window);
