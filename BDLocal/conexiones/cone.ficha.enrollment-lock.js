/* =========================================================
Nombre completo: cone.ficha.enrollment-lock.js
Ruta: /BDLocal/conexiones/cone.ficha.enrollment-lock.js
Función:
- Marcar ACTIVO/RETIRADO como decisión manual.
- Guardar la marca mediante ConFicha.updateStudent.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-manual-enrollment-lock";

  function text(value){return String(value==null?"":value).trim();}
  function connector(){return window.ConFicha||window.BDLocalFicha||null;}
  function normalize(value){value=text(value).toUpperCase();return value==="ACTIVO"||value==="RETIRADO"?value:"";}

  function install(){
    var api=connector();
    if(!api||typeof api.updateStudent!=="function"){return false;}
    if(api.__manualEnrollmentLock){return true;}

    api.updateEnrollmentStatus=function(id,value,options){
      options=Object.assign({},options||{});
      var status=normalize(value);
      var stamp=new Date().toISOString();
      if(!status){return Promise.reject(new Error("El estado debe ser ACTIVO o RETIRADO."));}

      var changes={
        estadoMatricula:status,
        retirado:status==="RETIRADO",
        estadoMatriculaActualizadaEn:stamp,
        estadoMatriculaManual:true,
        estadoMatriculaManualActualizadaEn:stamp,
        estadoMatriculaManualOrigen:"FICHA"
      };
      if(status==="RETIRADO"){changes.retiradoEn=stamp;}
      else{changes.retiradoEn="";changes.reactivadoEn=stamp;}

      options.action=status==="RETIRADO"?"manual_retire":"manual_reactivate";
      options.source=options.source||"cone.ficha.enrollment-lock";

      return api.updateStudent(id,changes,options).then(function(saved){
        var result={ok:true,id:text(saved&&(saved.idEstudiantePeriodo||saved.studentId||saved.id)||id),status:status,student:saved||null,source:"ConFicha",manual:true};
        try{window.dispatchEvent(new CustomEvent("ficha:enrollment-status-saved",{detail:result}));}catch(error){}
        return result;
      });
    };

    api.__manualEnrollmentLock=true;
    return true;
  }

  window.ConFichaEnrollmentLock={version:VERSION,install:install};
  install();
})(window);
