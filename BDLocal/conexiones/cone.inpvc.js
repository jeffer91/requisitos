/* =========================================================
Archivo: cone.inpvc.js
Ruta: /BDLocal/conexiones/cone.inpvc.js
Función:
- Ser la única conexión de InPVC con BDLocal.
- Leer períodos PVC, estudiantes, requisitos y notas de titulación.
- Entregar un conjunto normalizado y de solo lectura para el informe.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-pvc-read-only";
  var SCREEN="inpvc";
  var SOURCE="ConInPVC";
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var loading=Object.create(null);
  var state={ready:false,loading:false,promise:null,error:"",loadedAt:"",reads:0,refreshes:0,dependenciesReady:false};

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function now(){return new Date().toISOString();}
  function hub(){return window.BDLocalConexiones||null;}
  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===src||item.getAttribute("data-coninpvc-src")===src;});}
  function service(name){return window.BDLServices&&typeof window.BDLServices.get==="function"?window.BDLServices.get(name):null;}
  function studentService(){return window.BDLServiceEstudiantes||service("estudiantes");}
  function periodService(){return window.BDLServicePeriodos||service("periodos");}
  function notesRepo(){return window.BDLRepoNotas||(window.BDLRepositories&&typeof window.BDLRepositories.get==="function"?(window.BDLRepositories.get("notas")||window.BDLRepositories.get("notas_titulacion")):null);}
  function requirementsRepo(){return window.BDLRepoRequisitos||(window.BDLRepositories&&typeof window.BDLRepositories.get==="function"?window.BDLRepositories.get("requisitos"):null);}

  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||15000));var started=Date.now();
    return new Promise(function(resolve,reject){(function check(){var value=null;try{value=test();}catch(error){}if(value){resolve(value);return;}if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}setTimeout(check,40);})();});
  }
  function load(relative,test){
    var src=url(relative),current=null;try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}if(loading[src]){return loading[src];}
    if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-coninpvc-src",src);
      script.onload=function(){var value=src;try{value=test?test():src;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }
  function sequence(files){return files.reduce(function(chain,item){return chain.then(function(){return load(item.path,item.test);});},Promise.resolve());}

  function canonicalPeriod(value){
    var utils=window.BDLocalConUtils;
    return utils&&typeof utils.canonicalPeriodId==="function"?utils.canonicalPeriodId(value):text(value).replace(/_+/g,"__");
  }
  function samePeriod(a,b){
    var utils=window.BDLocalConUtils;
    return utils&&typeof utils.samePeriod==="function"?utils.samePeriod(a,b):canonicalPeriod(a)===canonicalPeriod(b);
  }
  function periodId(row){row=row||{};return canonicalPeriod(row.periodoId||row.periodId||row.periodoCanonicoId||row._periodoId||row.id||row.value||"");}
  function periodLabel(row){row=row||{};return text(row.periodoLabel||row.periodoCanonicoLabel||row.label||row.nombre||row.name||periodId(row));}
  function explicitType(row){row=row||{};return norm(row.tipoPeriodo||row.periodType||row.periodoTipo||row._tipoPeriodo||"");}
  function isPVCPeriod(row){
    row=row||{};if(row.isPVC===true){return true;}var explicit=explicitType(row);if(explicit){return explicit.indexOf("pvc")>=0;}
    var value=norm([periodId(row),periodLabel(row)].join(" "));
    if(value.indexOf("pvc")>=0){return true;}
    var regular=(value.indexOf("octubre")>=0&&value.indexOf("marzo")>=0)||(value.indexOf("abril")>=0&&value.indexOf("septiembre")>=0)||/20\d{2}[-_/ ]?10.*20\d{2}[-_/ ]?03/.test(value)||/20\d{2}[-_/ ]?04.*20\d{2}[-_/ ]?09/.test(value);
    return !regular;
  }
  function studentId(row){row=row||{};return text(row.idEstudiantePeriodo||row.studentId||row.id||"");}
  function cedula(row){row=row||{};return text(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row._cedula||"");}
  function studentName(row){row=row||{};return text(row.nombreCompleto||row.Nombres||row.nombres||row.Nombre||row.nombre||"");}
  function career(row){row=row||{};return text(row.carrera||row.NombreCarrera||row.nombreCarrera||row.Carrera||"SIN CARRERA");}
  function number(value){if(value===null||value===undefined||text(value)===""){return null;}var result=Number(text(value).replace(",","."));return Number.isFinite(result)?Math.max(0,Math.min(10,Math.round(result*100)/100)):null;}
  function pick(row,names){row=row||{};for(var index=0;index<names.length;index+=1){if(row[names[index]]!==undefined&&row[names[index]]!==null&&text(row[names[index]])!==""){return row[names[index]];}}return null;}
  function noteValues(row){
    var article=number(pick(row,["Notart","Nart","notart","nart","notaArticulo","notaEscrito"]));
    var defense=number(pick(row,["Notdef","Ndef","notdef","ndef","notaDefensa","notaDefensaTrabajo"]));
    var finalValue=number(pick(row,["Notafinal","Nfinal","notafinal","nfinal","nfin","notaFinal","notaTrabajoTitulacion"]));
    if(finalValue==null&&article!=null&&defense!=null){finalValue=Math.round(((article*.70)+(defense*.30))*100)/100;}
    return {nart:article,ndef:defense,nfin:finalValue};
  }
  function statusOf(notes,requirements){
    var list=Array.isArray(requirements)?requirements:[requirements||{}];var fails=list.some(function(item){var req=norm(item.estado||item.valor||item.estadoRequisitos||item.aprobacion||item.AprobacionTitulacion||"");return !!req&&/(no cumple|incumple|bloqueado|rechaz|pendiente)/.test(req);});
    if(fails){return "NO_CUMPLE_REQUISITOS";}
    if(notes.nart==null&&notes.ndef==null&&notes.nfin==null){return "NO_RINDIO";}
    if(notes.nfin==null){return "PENDIENTE";}
    return notes.nfin>=7?"APROBADO":"REPROBADO";
  }
  function normalizePeriod(row){var id=periodId(row);return Object.assign({},row||{},{id:id,periodoId:id,value:id,label:periodLabel(row)||id,periodoLabel:periodLabel(row)||id,tipoPeriodo:"PVC",isPVC:true});}

  function register(){
    var registry=window.BDLocalConeRegistry;
    if(registry&&typeof registry.register==="function"){
      registry.register(SCREEN,{label:"InPVC",global:"ConInPVC",file:"cone.inpvc.js",pathHints:["/inpvc/","inpvc.html"],aliases:["inpvc","infor","informe_pvc","titulacion_pvc"],canRead:true,canWrite:false,operations:["ready","read","refresh","status","diagnose"],tables:["periodos","personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","evaluaciones_titulacion"],description:"Conector exclusivo y de solo lectura para informes PVC."});
    }
  }
  function ensureDependencies(){
    if(state.dependenciesReady){return Promise.resolve(true);}
    return load("../adapters/bdl.screen-deps.js",function(){return window.BDLocalScreenDeps;})
      .then(function(adapter){return adapter&&typeof adapter.ready==="function"?adapter.ready():adapter;})
      .then(function(){return sequence([
        {path:"../rules/bdl.rules.index.js",test:function(){return window.BDLRules;}},
        {path:"../rules/bdl.rules.notas.js"},
        {path:"../repositories/bdl.repo.periodos.js"},
        {path:"../repositories/bdl.repo.notas.js",test:notesRepo},
        {path:"../services/bdl.service.periodos.js",test:periodService},
        {path:"../services/bdl.service.estudiantes.js",test:studentService}
      ]);})
      .then(function(){if(!studentService()||!periodService()||!notesRepo()){throw new Error("Los servicios de períodos, estudiantes o notas no están disponibles para InPVC.");}state.dependenciesReady=true;return true;});
  }
  function status(){return {ok:state.ready&&!state.error,ready:state.ready,loading:state.loading,error:state.error,version:VERSION,screen:SCREEN,source:SOURCE,loadedAt:state.loadedAt,reads:state.reads,refreshes:state.refreshes,dependenciesReady:state.dependenciesReady,readOnly:true};}
  function ready(options){options=options||{};if(state.ready&&!options.force){return Promise.resolve(status());}if(state.promise&&!options.force){return state.promise;}state.loading=true;state.error="";state.promise=ensureDependencies().then(function(){state.ready=true;state.loadedAt=now();register();var currentHub=hub();if(currentHub&&typeof currentHub.register==="function"){currentHub.register(SCREEN,api);}return status();}).catch(function(error){state.ready=false;state.error=error&&error.message?error.message:String(error);return status();}).finally(function(){state.loading=false;state.promise=null;});return state.promise;}
  function requireReady(){return ready().then(function(result){if(!result.ok){throw new Error(result.error||"InPVC no está listo.");}return result;});}
  function listPeriods(){return requireReady().then(function(){return periodService().list();}).then(function(rows){var map=Object.create(null);(rows||[]).filter(isPVCPeriod).forEach(function(row){var item=normalizePeriod(row);if(item.id){map[item.id]=item;}});return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){return a.label.localeCompare(b.label,"es");});});}
  function listRequirements(options){options=options||{};var repo=requirementsRepo();if(!repo){return Promise.resolve([]);}if(typeof repo.list==="function"){return Promise.resolve(repo.list({periodoId:options.periodoId||options.periodId||""})).catch(function(){return [];});}return Promise.resolve([]);}
  function listStudents(options){options=options||{};var wanted=canonicalPeriod(options.periodoId||options.periodId||"");return requireReady().then(function(){return Promise.all([studentService().list({periodoId:wanted,matricula:""}),notesRepo().list({periodoId:wanted}),listRequirements({periodoId:wanted})]);}).then(function(values){
    var notes=Object.create(null),requirements=Object.create(null);
    (values[1]||[]).forEach(function(row){notes[studentId(row)||cedula(row)]=row;notes[cedula(row)]=row;});
    (values[2]||[]).forEach(function(row){var key=studentId(row)||cedula(row);if(key){(requirements[key]=requirements[key]||[]).push(row);}var id=cedula(row);if(id&&id!==key){(requirements[id]=requirements[id]||[]).push(row);}});
    return (values[0]||[]).filter(function(row){return !wanted||samePeriod(periodId(row),wanted);}).filter(function(row){var enrollment=norm(row.estadoMatricula||row._estadoMatricula||"activo");return enrollment!=="retirado";}).map(function(row){
      var note=notes[studentId(row)]||notes[cedula(row)]||row;var req=requirements[studentId(row)]||requirements[cedula(row)]||[];var valuesNote=noteValues(Object.assign({},row,note));
      return Object.assign({},row,{idEstudiantePeriodo:studentId(row),periodoId:periodId(row)||wanted,cedula:cedula(row),numeroIdentificacion:cedula(row),nombres:studentName(row),Nombres:studentName(row),carrera:career(row),NombreCarrera:career(row),modalidadTitulacion:"ARTICULO_ACADEMICO",nart:valuesNote.nart,ndef:valuesNote.ndef,nfin:valuesNote.nfin,Notart:valuesNote.nart,Notdef:valuesNote.ndef,Notafinal:valuesNote.nfin,estadoPVC:statusOf(valuesNote,req),requisitosPVC:req});
    });
  });}
  function summarize(rows){var map=Object.create(null);(rows||[]).forEach(function(row){var key=career(row);if(!map[key]){map[key]={carrera:key,total:0,rindieron:0,aprobados:0,reprobados:0,pendientes:0,noCumple:0,promedio:null,_sum:0,_count:0};}var item=map[key];item.total+=1;if(row.estadoPVC!=="NO_RINDIO"){item.rindieron+=1;}if(row.estadoPVC==="APROBADO"){item.aprobados+=1;}else if(row.estadoPVC==="REPROBADO"){item.reprobados+=1;}else if(row.estadoPVC==="NO_CUMPLE_REQUISITOS"){item.noCumple+=1;}else{item.pendientes+=1;}if(row.nfin!=null){item._sum+=row.nfin;item._count+=1;}});return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");}).map(function(key){var item=map[key];item.promedio=item._count?Math.round((item._sum/item._count)*100)/100:null;delete item._sum;delete item._count;return item;});}
  function read(options){options=options||{};state.reads+=1;return Promise.all([listPeriods(),listStudents(options)]).then(function(values){var rows=values[1]||[];return {ok:true,source:SOURCE,screen:SCREEN,data:{periods:values[0]||[],students:rows,summary:summarize(rows)},meta:{generatedAt:now(),version:VERSION,readOnly:true}};});}
  function refresh(options){options=options||{};state.refreshes+=1;var currentHub=hub();var operation=currentHub&&typeof currentHub.refreshCache==="function"?currentHub.refreshCache({source:"cone.inpvc",sourceScreen:SCREEN,periodoId:text(options.periodoId||options.periodId),full:options.full===true,light:options.full!==true,immediate:true,force:options.force===true}):Promise.resolve(null);return Promise.resolve(operation).then(function(){return ready({force:true});});}

  var api={version:VERSION,screen:SCREEN,source:SOURCE,ready:ready,read:read,refresh:refresh,reload:refresh,status:status,listPeriods:listPeriods,getPeriods:listPeriods,listStudents:listStudents,getStudents:listStudents,getSummary:function(options){return listStudents(options).then(summarize);},summary:function(options){return listStudents(options).then(summarize);}};
  window.ConInPVC=api;window.BDLocalConeInPVC=api;register();var currentHub=hub();if(currentHub&&typeof currentHub.register==="function"){currentHub.register(SCREEN,api);}
})(window,document);
