/* =========================================================
Nombre completo: ficha.connection-bridge.js
Ruta o ubicación: /Ficha/ficha.connection-bridge.js
Función o funciones:
- Reemplazar las lecturas de FichaCore por métodos exclusivos de ConFicha.
- Cargar automáticamente desde BDLocal el período elegido en Ficha.
- Entregar detalle, contactos y requisitos a ficha.app.js mediante una fachada controlada.
- Evitar accesos desde /Ficha/ a BL2DB, BDLServiceFicha, BL2DataEngine o ExcelLocalRepo.
- Entregar todos los estudiantes filtrados y neutralizar el límite visual heredado de 400 registros.
- Ocultar el botón Actualizar porque el selector de período ejecuta la carga automáticamente.
Con qué se conecta:
- ../BDLocal/conexiones/cone.ficha.js
- ficha.core.js
- ficha.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.2.0-auto-period-load";
  var Core=window.FichaCore||null;
  if(!Core){return;}

  var original={
    normalizeLight:Core.normalizeLight,
    normalizeFull:Core.normalizeFull,
    invalidate:Core.invalidate
  };

  var periodLoads=Object.create(null);
  var periodReady=Object.create(null);
  var periodFailures=Object.create(null);
  var FAILURE_COOLDOWN_MS=5000;

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
  function setStatus(message,cls){
    try{
      var node=window.document&&window.document.getElementById("ficha-status");
      if(node){
        node.textContent=message;
        node.className="ficha-status "+(cls||"");
      }
    }catch(error){}
  }
  function selectedPeriod(){
    try{
      var select=window.document&&window.document.getElementById("ficha-periodo");
      return text(select&&select.value);
    }catch(error){return "";}
  }
  function hideRefreshButton(){
    try{
      var button=window.document&&window.document.getElementById("ficha-btn-refresh");
      if(button){
        button.hidden=true;
        button.disabled=true;
        button.setAttribute("aria-hidden","true");
      }
    }catch(error){}
  }
  function emit(name,detail){
    try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}
  }
  function ensure(options){
    var con=connector();
    if(!con){return Promise.reject(new Error("ConFicha no está cargado."));}
    var normalized=normalizeOptions(options||{});
    return Promise.resolve(typeof con.ready==="function"?con.ready(normalized):true).then(function(result){
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
  function noLimit(options){
    return Object.assign({},options||{},{limit:0});
  }
  function exposeCompleteList(rows){
    rows=Array.isArray(rows)?rows:[];

    try{
      Object.defineProperty(rows,"slice",{
        configurable:true,
        enumerable:false,
        writable:true,
        value:function(start,end){
          if(Number(start||0)===0&&Number(end)===400&&this.length>400){
            return Array.prototype.slice.call(this,0);
          }
          return Array.prototype.slice.call(this,start,end);
        }
      });
    }catch(error){}

    return rows;
  }
  function rerenderPeriod(periodoId){
    invalidate();

    if(window.FichaApp&&typeof window.FichaApp.render==="function"){
      window.FichaApp.render("period-data-ready");
    }else{
      emit("requisitos:bl:snapshot-changed",{
        source:"ficha.connection-bridge",
        periodoId:periodoId
      });
    }

    emit("ficha:period-data-ready",{
      ok:true,
      source:"ConFicha",
      periodoId:periodoId
    });
  }
  function loadPeriod(options){
    var normalized=normalizeOptions(options||{});
    var periodoId=normalized.periodoId;

    if(!periodoId){return ensure(normalized);}
    if(periodReady[periodoId]){return Promise.resolve(connector());}
    if(periodLoads[periodoId]){return periodLoads[periodoId];}

    if(
      periodFailures[periodoId]&&
      Date.now()-periodFailures[periodoId]<FAILURE_COOLDOWN_MS
    ){
      return Promise.resolve(connector());
    }

    if(!selectedPeriod()||selectedPeriod()===periodoId){
      setStatus("Cargando estudiantes del período...","");
    }

    periodLoads[periodoId]=ensure(normalized).then(function(con){
      if(typeof con.refresh!=="function"){
        throw new Error("ConFicha.refresh no está disponible.");
      }

      return con.refresh({
        periodoId:periodoId,
        periodId:periodoId,
        source:"ficha.connection-bridge.period-change",
        full:true,
        immediate:true,
        force:true
      });
    }).then(function(){
      periodReady[periodoId]=true;
      delete periodFailures[periodoId];

      if(!selectedPeriod()||selectedPeriod()===periodoId){
        setStatus("Período cargado desde Base Local.","ok");
      }

      rerenderPeriod(periodoId);
      return connector();
    }).catch(function(error){
      periodFailures[periodoId]=Date.now();

      if(!selectedPeriod()||selectedPeriod()===periodoId){
        setStatus(
          "No se pudieron cargar los estudiantes del período: "+
          (error&&error.message?error.message:String(error)),
          "warn"
        );
      }

      emit("ficha:period-data-error",{
        ok:false,
        source:"ConFicha",
        periodoId:periodoId,
        error:error&&error.message?error.message:String(error)
      });

      return connector();
    }).finally(function(){
      delete periodLoads[periodoId];
    });

    return periodLoads[periodoId];
  }
  function students(options){
    var normalized=normalizeOptions(options||{});
    var rows=exposeCompleteList(
      rawRows(noLimit(normalized)).map(normalizeLight)
    );

    if(normalized.periodoId&&!periodReady[normalized.periodoId]){
      loadPeriod(normalized).catch(function(){});
    }

    return rows;
  }
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
    return ensure(filter).then(function(con){
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
    hideRefreshButton();
    return true;
  }

  window.FichaConnectionBridge={
    version:VERSION,
    install:install,
    ready:ensure,
    loadPeriod:loadPeriod,
    getDetalle:detail
  };

  install();

  if(window.document&&window.document.readyState==="loading"){
    window.document.addEventListener("DOMContentLoaded",hideRefreshButton,{once:true});
  }else{
    hideRefreshButton();
  }

  ensure().then(function(){
    invalidate();
    emit("ficha:connection-ready",{ok:true,source:"ConFicha",fullStudentList:true,autoPeriodLoad:true});
  }).catch(function(error){
    emit("ficha:connection-error",{ok:false,source:"ConFicha",error:error.message||String(error)});
  });
})(window);
