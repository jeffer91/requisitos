/* =========================================================
Nombre completo: cone.infor.js
Ruta o ubicación: /BDLocal/conexiones/cone.infor.js
Función o funciones:
- Ser la única conexión de Infor con BDLocal.
- Mantener períodos y estudiantes preparados para consultas síncronas de la pantalla.
- Entregar lecturas y resúmenes sin usar ExcelLocalRepo ni BL2EstudiantesRepo.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.1.0-screen-cache";
  var SCREEN="infor";
  var SOURCE="ConInfor";
  var state={
    ready:false,loading:false,promise:null,error:"",reads:0,refreshes:0,loadedAt:"",
    periods:[],students:[]
  };

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function hub(){return window.BDLocalConexiones||null;}
  function utils(){return window.BDLocalConUtils||null;}
  function studentService(){
    return window.BDLServiceEstudiantes||(
      window.BDLServices&&typeof window.BDLServices.get==="function"
        ?window.BDLServices.get("estudiantes")
        :null
    );
  }
  function statsService(){
    return window.BDLServiceStats||(
      window.BDLServices&&typeof window.BDLServices.get==="function"
        ?window.BDLServices.get("stats")
        :null
    );
  }
  function periodsService(){
    return window.BDLServicePeriodos||(
      window.BDLServices&&typeof window.BDLServices.get==="function"
        ?window.BDLServices.get("periodos")
        :null
    );
  }

  function canonicalPeriod(value){
    var current=utils();
    return current&&typeof current.canonicalPeriodId==="function"
      ?current.canonicalPeriodId(value)
      :text(value).replace(/_+/g,"__");
  }
  function samePeriod(a,b){
    var current=utils();
    return current&&typeof current.samePeriod==="function"
      ?current.samePeriod(a,b)
      :(!text(b)||canonicalPeriod(a)===canonicalPeriod(b));
  }
  function normalizeSearch(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  }

  function periodId(row){
    row=row||{};
    return canonicalPeriod(row.periodoId||row.periodId||row.ultimoPeriodoId||row._periodoId||row.idPeriodo||"");
  }
  function enrollment(row){
    row=row||{};
    return text(row.estadoMatricula||row._estadoMatricula||row.EstadoMatricula||"ACTIVO").toUpperCase();
  }

  function uniquePeriods(rows){
    var map=Object.create(null);
    (Array.isArray(rows)?rows:[]).forEach(function(row){
      row=row||{};
      var id=canonicalPeriod(row.id||row.periodoId||row.value||row.key||row.periodId||"");
      if(!id||map[id]){return;}
      map[id]=Object.assign({},row,{
        id:id,periodoId:id,value:id,key:id,
        label:text(row.label||row.periodoLabel||row.nombre||row.name||id),
        periodoLabel:text(row.periodoLabel||row.label||row.nombre||row.name||id)
      });
    });
    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){return a.label.localeCompare(b.label,"es");});
  }

  function register(){
    var registry=window.BDLocalConeRegistry;
    if(registry&&typeof registry.register==="function"){
      registry.register(SCREEN,{
        label:"Infor",global:"ConInfor",file:"cone.infor.js",
        pathHints:["/infor/","infor/frontend/titulacion.html"],
        aliases:["infor","informe_titulacion","titulacion_informe"],
        canRead:true,canWrite:false,
        operations:["ready","read","refresh","status","diagnose"],
        tables:["periodos","personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","evaluaciones_titulacion"],
        description:"Conector exclusivo para la pantalla de informes de titulación."
      });
    }
  }

  function readPeriods(){
    var current=periodsService();
    if(current){
      if(typeof current.list==="function"){return Promise.resolve(current.list());}
      if(typeof current.getPeriods==="function"){return Promise.resolve(current.getPeriods());}
    }
    var central=hub();
    if(central&&typeof central.ensureCoreReady==="function"){
      return central.ensureCoreReady().then(function(){
        return window.BL2Core&&typeof window.BL2Core.getPeriods==="function"
          ?window.BL2Core.getPeriods()
          :[];
      });
    }
    return Promise.resolve([]);
  }

  function readStudents(){
    var current=studentService();
    if(!current||typeof current.list!=="function"){
      return Promise.reject(new Error("BDLServiceEstudiantes no está disponible para Infor."));
    }
    return Promise.resolve(current.list({matricula:""}));
  }

  function status(){
    return {
      ok:state.ready&&!state.error,ready:state.ready,loading:state.loading,
      version:VERSION,screen:SCREEN,source:SOURCE,error:state.error,
      reads:state.reads,refreshes:state.refreshes,loadedAt:state.loadedAt,
      periods:state.periods.length,students:state.students.length,
      studentService:!!studentService(),statsService:!!statsService()
    };
  }

  function load(){
    return Promise.all([readPeriods(),readStudents()]).then(function(values){
      state.periods=uniquePeriods(values[0]||[]);
      state.students=Array.isArray(values[1])?values[1].slice():[];
      state.ready=true;
      state.error="";
      state.loadedAt=now();
      register();
      var currentHub=hub();
      if(currentHub&&typeof currentHub.register==="function"){currentHub.register(SCREEN,api);}
      try{window.dispatchEvent(new CustomEvent("infor:connection-ready",{detail:status()}));}catch(error){}
      return status();
    });
  }

  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.promise&&!options.force){return state.promise;}
    state.loading=true;
    state.error="";
    var central=hub();
    state.promise=Promise.resolve()
      .then(function(){return central&&typeof central.ensureCoreReady==="function"?central.ensureCoreReady():null;})
      .then(load)
      .catch(function(error){
        state.ready=false;
        state.error=error&&error.message?error.message:String(error);
        return status();
      })
      .finally(function(){state.loading=false;state.promise=null;});
    return state.promise;
  }

  function listPeriodsSync(){return state.periods.slice();}
  function listStudentsSync(options){
    options=options||{};
    var wantedPeriod=canonicalPeriod(options.periodoId||options.periodId||options.period||"");
    var wantedEnrollment=text(options.matricula||options.estadoMatricula||"").toUpperCase();
    var search=normalizeSearch(options.search||options.busqueda||options.query||"");
    var limit=Math.max(0,Number(options.limit||0));
    var rows=state.students.filter(function(row){
      if(wantedPeriod&&!samePeriod(periodId(row),wantedPeriod)){return false;}
      if(wantedEnrollment&&wantedEnrollment!=="TODOS"&&enrollment(row)!==wantedEnrollment){return false;}
      if(search){
        var hay=normalizeSearch([
          row.cedula,row.numeroIdentificacion,row.Nombres,row.nombres,row.nombreCompleto,
          row.NombreCarrera,row.nombreCarrera,row.carrera,row.Sede,row.sede
        ].join(" "));
        if(hay.indexOf(search)<0){return false;}
      }
      return true;
    });
    return limit>0?rows.slice(0,limit):rows;
  }

  function summarySync(options){
    options=options||{};
    var rows=Array.isArray(options.students)?options.students:listStudentsSync(options);
    var active=rows.filter(function(row){return enrollment(row)!=="RETIRADO";}).length;
    return {totalEstudiantes:rows.length,totalActivos:active,totalRetirados:rows.length-active,source:SOURCE};
  }

  function listPeriods(){return ready().then(function(result){if(!result.ok){throw new Error(result.error||"Infor no está listo.");}return listPeriodsSync();});}
  function listStudents(options){return ready().then(function(result){if(!result.ok){throw new Error(result.error||"Infor no está listo.");}return listStudentsSync(options);});}
  function getSummary(options){
    options=options||{};
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Infor no está listo.");}
      var current=statsService();
      if(current){
        if(typeof current.getSummary==="function"){return current.getSummary(options);}
        if(typeof current.summary==="function"){return current.summary(options);}
      }
      return summarySync(options);
    });
  }

  function read(options){
    state.reads+=1;
    options=options||{};
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Infor no está listo.");}
      var students=listStudentsSync(options);
      return {
        ok:true,source:SOURCE,screen:SCREEN,
        data:{periods:listPeriodsSync(),students:students,summary:summarySync({students:students})},
        meta:{generatedAt:now(),version:VERSION,readOnly:true}
      };
    });
  }

  function refresh(options){
    options=options||{};
    state.refreshes+=1;
    var central=hub();
    var operation=central&&typeof central.refreshCache==="function"
      ?central.refreshCache({
          source:"cone.infor",sourceScreen:SCREEN,
          periodoId:text(options.periodoId||options.periodId),
          full:options.full===true,light:options.full!==true,
          immediate:true,force:options.force===true
        })
      :Promise.resolve(null);
    return Promise.resolve(operation).then(function(){return ready({force:true});});
  }

  function snapshot(){return {periods:listPeriodsSync(),students:state.students.slice(),summary:summarySync({}),meta:status()};}

  var api={
    version:VERSION,screen:SCREEN,source:SOURCE,
    ready:ready,read:read,refresh:refresh,reload:refresh,status:status,snapshot:snapshot,getSnapshot:snapshot,
    listPeriods:listPeriods,getPeriods:listPeriods,listPeriodsSync:listPeriodsSync,getPeriodsSync:listPeriodsSync,
    listStudents:listStudents,getStudents:listStudents,listStudentsSync:listStudentsSync,getStudentsSync:listStudentsSync,
    getSummary:getSummary,summary:getSummary,getSummarySync:summarySync,summarySync:summarySync
  };

  window.ConInfor=api;
  window.BDLocalConeInfor=api;
  register();
  var currentHub=hub();
  if(currentHub&&typeof currentHub.register==="function"){currentHub.register(SCREEN,api);}
  ready();
})(window);