/* =========================================================
Nombre completo: ficha.connection-bridge.js
Ruta o ubicación: /Ficha/ficha.connection-bridge.js
Función o funciones:
- Reemplazar las lecturas de FichaCore por métodos exclusivos de ConFicha.
- Entregar detalle, contactos y requisitos a ficha.app.js mediante una fachada controlada.
- Evitar accesos desde /Ficha/ a BL2DB, BDLServiceFicha, BL2DataEngine o ExcelLocalRepo.
Con qué se conecta:
- ../BDLocal/conexiones/cone.ficha.js
- ficha.core.js
========================================================= */
(function(window){
  "use strict";

  var Core=window.FichaCore||null;
  if(!Core){return;}

  var original={
    normalizeLight:Core.normalizeLight,
    normalizeFull:Core.normalizeFull,
    invalidate:Core.invalidate
  };

  function text(value){return String(value==null?"":value).trim();}
  function connector(){return window.ConFicha||window.BDLocalFicha||null;}
  function normalizeOptions(options){
    options=Object.assign({},options||{});
    return {
      periodoId:text(options.periodoId||options.periodId||""),
      periodId:text(options.periodoId||options.periodId||""),
      division:text(options.division||""),
      matricula:options.matricula==null?"ACTIVO":text(options.matricula),
      search:text(options.search||options.busqueda||""),
      limit:Number(options.limit||0),
      force:options.force===true
    };
  }
  function ensure(){
    var con=connector();
    if(!con){return Promise.reject(new Error("ConFicha no está cargado."));}
    return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(result){
      if(result&&result.ok===false){throw new Error(result.error||"ConFicha no está listo.");}
      return con;
    });
  }
  function normalizeLight(row){return typeof original.normalizeLight==="function"?original.normalizeLight(row||{}):Object.assign({},row||{});}
  function normalizeFull(row){return typeof original.normalizeFull==="function"?original.normalizeFull(row||{}):Object.assign({},row||{});}
  function periods(){
    var con=connector();if(!con){return [];}
    try{
      var rows=typeof con.listPeriods==="function"?con.listPeriods():typeof con.periods==="function"?con.periods():[];
      return Array.isArray(rows)?rows:[];
    }catch(error){return [];}
  }
  function rawRows(options){
    var con=connector();if(!con){return [];}
    options=normalizeOptions(options);
    try{
      var rows=typeof con.rows==="function"?con.rows(options):typeof con.getStudents==="function"?con.getStudents(options):[];
      if(rows&&Array.isArray(rows.rows)){rows=rows.rows;}
      return Array.isArray(rows)?rows:[];
    }catch(error){return [];}
  }
  function students(options){return rawRows(options).map(normalizeLight);}
  function filter(options){return students(options);}
  function divisions(list,options){
    var con=connector();if(!con){return [];}
    try{
      var values=typeof con.divisions==="function"?con.divisions(normalizeOptions(options||{})):[];
      return Array.isArray(values)?values:[];
    }catch(error){return [];}
  }
  function getById(id,options){
    var con=connector();if(!con){return null;}
    try{
      var row=typeof con.getStudentById==="function"?con.getStudentById(text(id),normalizeOptions(options||{})):null;
      return row?normalizeFull(row):null;
    }catch(error){return null;}
  }
  function detail(filter){
    filter=filter||{};
    return ensure().then(function(con){
      var periodoId=text(filter.periodoId||filter.periodId||"");
      var cedula=text(filter.cedula||filter.numeroIdentificacion||"");
      var student=typeof con.getStudentByCedula==="function"?con.getStudentByCedula(cedula,periodoId):null;
      if(!student&&typeof con.getStudentById==="function"){student=con.getStudentById(cedula,{periodoId:periodoId,matricula:""});}
      if(!student){return {ok:false,source:"ConFicha",requisitos:[]};}
      var contact=typeof con.getContact==="function"?con.getContact({cedula:cedula,periodoId:periodoId,idEstudiantePeriodo:student.idEstudiantePeriodo||student.studentId||student.id}):null;
      var requirements=typeof con.getRequirements==="function"?con.getRequirements({cedula:cedula,periodoId:periodoId}):[];
      return {
        ok:true,source:"ConFicha",
        estudiante:student,
        matricula:student,
        persona:student,
        contacto:contact||{},
        requisitos:Array.isArray(requirements)?requirements:[],
        notas:student._bdlNotas||student.notas||{}
      };
    });
  }
  function invalidate(){
    if(typeof original.invalidate==="function"){original.invalidate();}
  }
  function install(){
    Core.periods=periods;
    Core.students=students;
    Core.filter=filter;
    Core.divisions=divisions;
    Core.getById=getById;
    Core.source=function(){return "ConFicha";};
    Core.invalidate=invalidate;
    window.BDLServiceFicha={version:"facade-conficha",getDetalle:detail};
    return true;
  }

  window.FichaConnectionBridge={version:"1.0.0-conficha-only",install:install,ready:ensure,getDetalle:detail};
  install();
  ensure().then(function(){
    invalidate();
    try{window.dispatchEvent(new CustomEvent("ficha:connection-ready",{detail:{ok:true,source:"ConFicha"}}));}catch(error){}
  }).catch(function(error){
    try{window.dispatchEvent(new CustomEvent("ficha:connection-error",{detail:{ok:false,source:"ConFicha",error:error.message||String(error)}}));}catch(innerError){}
  });
})(window);