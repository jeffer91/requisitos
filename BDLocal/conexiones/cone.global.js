(function(window){
  "use strict";
  var U=window.BDLocalConUtils;
  var hub=window.BDLocalConexiones;
  if(!U){return;}
  function text(v){return U.text?U.text(v):String(v==null?"":v).trim();}
  function clone(v){return U.clone?U.clone(v):JSON.parse(JSON.stringify(v||null));}
  function ready(){return hub&&typeof hub.ready==="function"?hub.ready().catch(function(){return status();}):Promise.resolve(status());}
  function refresh(options){return hub&&typeof hub.refreshCache==="function"?hub.refreshCache(Object.assign({source:"ConGlobal"},options||{})).catch(function(){return U.readCache();}):Promise.resolve(U.readCache());}
  function cache(){try{return U.readCache();}catch(e){return {meta:{},periods:[],students:[],requirements:[],diagnostics:[{message:e.message}]};}}
  function normalizePeriod(period){return U.normalizePeriod?U.normalizePeriod(period):period;}
  function normalizeStudent(row){return U.normalizeStudent?U.normalizeStudent(row):Object.assign({},row||{});}
  function periods(){return (cache().periods||[]).map(normalizePeriod).filter(Boolean);}
  function students(filters){filters=filters||{};var rows=(cache().students||[]).map(normalizeStudent);return U.filterStudents?U.filterStudents(rows,filters):rows;}
  function requirements(filters){
    filters=filters||{};
    var reqs=Array.isArray(cache().requirements)?cache().requirements:[];
    var periodoId=text(filters.periodoId||filters.periodId||"");
    var cedula=text(filters.cedula||filters.numeroIdentificacion||"");
    return reqs.filter(function(req){return (!periodoId||text(req.periodoId||req.periodId)===periodoId)&&(!cedula||text(req.cedula||req.numeroIdentificacion)===cedula);});
  }
  function careers(){
    var map={};
    students({matricula:""}).forEach(function(row){
      var nombre=text(row.NombreCarrera||row.nombreCarrera||row.carrera||row.Carrera||row._carrera);
      var codigo=text(row.CodigoCarrera||row.codigoCarrera||row.codigo||row._codigoCarrera||nombre);
      var key=(codigo||nombre).toUpperCase();
      if(nombre&&!map[key]){map[key]={id:key,codigo:codigo||key,nombre:nombre,tipo:nombre.toUpperCase().indexOf("UNIVERSITARIA")>=0?"UNIVERSITARIA":"SUPERIOR"};}
    });
    return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es");});
  }
  function requirementCatalog(){
    var map={};
    requirements({}).forEach(function(req){var key=text(req.requisitoId||req.requisito||req.campo||req.key||req.nombre);if(key){map[key]={id:key,key:key,label:text(req.label||req.nombre||key)};}});
    students({matricula:""}).forEach(function(row){Object.keys(row||{}).forEach(function(key){var value=text(row[key]).toUpperCase();if(["CUMPLE","NO CUMPLE","PENDIENTE"].indexOf(value)>=0){map[key]={id:key,key:key,label:key};}});});
    return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return a.label.localeCompare(b.label,"es");});
  }
  function snapshot(options){options=options||{};var c=cache();return {ok:true,source:"ConGlobal",version:"1.0.0-bloque-2",meta:clone(c.meta||{}),periods:periods(),students:students(options.filters||{matricula:""}),requirements:requirements(options.filters||{}),careers:careers(),requirementCatalog:requirementCatalog(),diagnostics:clone(c.diagnostics||[]),generatedAt:new Date().toISOString()};}
  function status(){var c=cache();return {ok:true,version:"1.0.0-bloque-2",source:"ConGlobal",periods:(c.periods||[]).length,students:(c.students||[]).length,requirements:(c.requirements||[]).length,careers:careers().length,requirementCatalog:requirementCatalog().length,updatedAt:new Date().toISOString()};}
  var api={version:"1.0.0-bloque-2",ready:ready,refresh:refresh,status:status,snapshot:snapshot,getSnapshot:snapshot,periods:periods,getPeriods:periods,students:students,getStudents:students,requirements:requirements,getRequirements:requirements,careers:careers,getCareers:careers,requirementCatalog:requirementCatalog,getRequirementCatalog:requirementCatalog};
  window.BDLocalGlobal=api;
  window.ConGlobal=api;
  if(hub&&typeof hub.register==="function"){hub.register("global",api);}
})(window);
