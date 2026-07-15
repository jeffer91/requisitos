/* =========================================================
Nombre completo: cone.registry.js
Ruta: /BDLocal/conexiones/cone.registry.js
Función:
- Mantener el inventario oficial de pantallas y conectores.
- Resolver una conexión exclusiva por pantalla.
- Evitar asociaciones heredadas entre Infor/Stats y Defart/Cr-def.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.0.0-one-screen-one-connector";
  var C=window.BDLocalConeContract||null;
  var definitions=Object.create(null);
  var aliases=Object.create(null);

  function text(value){
    return C&&typeof C.text==="function"
      ?C.text(value)
      :String(value==null?"":value).trim();
  }

  function normalize(value){
    return C&&typeof C.normalizeScreen==="function"
      ?C.normalizeScreen(value)
      :text(value).toLowerCase().replace(/[^a-z0-9_-]+/g,"");
  }

  function clone(value){
    try{return C&&typeof C.clone==="function"?C.clone(value):JSON.parse(JSON.stringify(value));}
    catch(error){return value;}
  }

  function unique(values){
    var seen=Object.create(null);
    return (Array.isArray(values)?values:[]).map(text).filter(function(value){
      if(!value||seen[value]){return false;}
      seen[value]=true;
      return true;
    });
  }

  function dispatch(name,detail){
    if(C&&typeof C.dispatch==="function"){return C.dispatch(name,detail||{});}
    try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));return true;}
    catch(error){return false;}
  }

  function normalizeDefinition(name,definition){
    definition=definition&&typeof definition==="object"?definition:{};
    var id=normalize(definition.id||name);
    if(!id){throw new Error("El registro requiere un identificador de pantalla.");}
    return {
      id:id,
      label:text(definition.label)||id,
      global:text(definition.global)||("Con"+id.charAt(0).toUpperCase()+id.slice(1)),
      file:text(definition.file)||("cone."+id+".js"),
      pathHints:unique(definition.pathHints||[id]),
      aliases:unique(definition.aliases||[]),
      canRead:definition.canRead!==false,
      canWrite:definition.canWrite===true,
      operations:unique(definition.operations||["ready","read","refresh","status","diagnose"]),
      tables:unique(definition.tables||[]),
      description:text(definition.description),
      enabled:definition.enabled!==false
    };
  }

  function clearAliasesFor(id){
    Object.keys(aliases).forEach(function(key){if(aliases[key]===id){delete aliases[key];}});
  }

  function register(name,definition){
    var item=normalizeDefinition(name,definition);
    clearAliasesFor(item.id);
    definitions[item.id]=item;
    aliases[item.id]=item.id;
    aliases[normalize(item.global)]=item.id;
    item.aliases.concat(item.pathHints).forEach(function(alias){
      var key=normalize(alias);
      if(key){aliases[key]=item.id;}
    });
    dispatch("bdlocal:connections:registry-updated",{
      action:"register",screen:item.id,at:new Date().toISOString()
    });
    return clone(item);
  }

  function get(name){
    var key=normalize(name);
    var id=definitions[key]?key:aliases[key];
    return id&&definitions[id]?clone(definitions[id]):null;
  }

  function list(options){
    options=options||{};
    return Object.keys(definitions).map(function(id){return clone(definitions[id]);}).filter(function(item){
      return options.includeDisabled===true||item.enabled;
    });
  }

  function resolve(name){
    var item=get(name);
    if(!item||!item.enabled){return null;}
    if(window[item.global]){return window[item.global];}
    var hub=window.BDLocalConexiones||null;
    var found=null;
    ["getConnector","connector","get"].some(function(method){
      if(!hub||typeof hub[method]!=="function"){return false;}
      try{found=hub[method](item.id)||null;}catch(error){found=null;}
      return !!found;
    });
    return found;
  }

  function detect(fallback){
    var candidates=[];
    var source=text(window.location&&window.location.pathname).toLowerCase();
    var script=document.currentScript;
    if(script){candidates.push(script.getAttribute("data-bdl-screen"),script.getAttribute("data-screen"));}
    if(document.body){candidates.push(document.body.getAttribute("data-bdl-screen"),document.body.getAttribute("data-screen"));}
    list().some(function(item){
      var match=item.pathHints.some(function(hint){return source.indexOf(text(hint).toLowerCase())>=0;});
      if(match){candidates.push(item.id);}
      return match;
    });
    candidates.push(fallback);
    for(var i=0;i<candidates.length;i+=1){
      var item=get(candidates[i]);
      if(item){return item.id;}
    }
    return "";
  }

  function status(){
    var screens=list({includeDisabled:true}).map(function(item){
      return {
        id:item.id,label:item.label,global:item.global,file:item.file,enabled:item.enabled,
        loaded:!!resolve(item.id),canRead:item.canRead,canWrite:item.canWrite,
        tables:item.tables.slice(),operations:item.operations.slice()
      };
    });
    return {
      ok:true,version:VERSION,total:screens.length,
      loaded:screens.filter(function(item){return item.loaded;}).length,
      missing:screens.filter(function(item){return item.enabled&&!item.loaded;}).map(function(item){return item.id;}),
      detectedScreen:detect(""),screens:screens
    };
  }

  var common=["periodos","personas","matriculas_periodo","requisitos_estudiante"];
  var rows=[
    {id:"carga",label:"Carga",global:"ConCarga",file:"cone.carga.js",pathHints:["/carga/","carga.html"],aliases:["importacion"],canWrite:true,operations:["ready","read","save","update","remove","refresh","status","diagnose"],tables:common.concat(["contactos_estudiante","notas_titulacion","divisiones_estudiante","importaciones","cambios_pendientes"])},
    {id:"baselocal",label:"Base Local",global:"ConBaseLocal",file:"cone.baselocal.js",pathHints:["/bdlocal/bl2.html"],aliases:["bl","bl2","base_local"],canWrite:true,operations:["ready","read","save","update","remove","refresh","status","diagnose"],tables:common.concat(["contactos_estudiante","notas_titulacion","divisiones_estudiante","importaciones","cambios_pendientes","evaluaciones_titulacion"])},
    {id:"tabla",label:"Tabla",global:"ConTabla",file:"cone.tabla.js",pathHints:["/gestion/tabla/","tabla.html"],aliases:["gestiontabla"],tables:common.concat(["contactos_estudiante"])},
    {id:"ficha",label:"Ficha",global:"ConFicha",file:"cone.ficha.js",pathHints:["/ficha/","ficha.html"],canWrite:true,operations:["ready","read","save","update","refresh","status","diagnose"],tables:common.concat(["contactos_estudiante","notas_titulacion","divisiones_estudiante","cambios_pendientes"])},
    {id:"stats",label:"Estadísticas",global:"ConStats",file:"cone.stats.js",pathHints:["/stats/","stats.html"],aliases:["estadisticas"],tables:common.concat(["notas_titulacion","divisiones_estudiante"])},
    {id:"coordi",label:"Coordinación",global:"ConCoordi",file:"cone.coordi.js",pathHints:["/coordi/","coordi.html"],aliases:["coordinacion"],tables:common.concat(["contactos_estudiante","divisiones_estudiante"])},
    {id:"global",label:"Global",global:"ConGlobal",file:"cone.global.js",pathHints:["/global/","global.html"],tables:common.concat(["contactos_estudiante","notas_titulacion","divisiones_estudiante"])},
    {id:"reportes",label:"Reportes",global:"ConReportes",file:"cone.reportes.js",pathHints:["/reportes/","repo.html"],aliases:["reporte","repo"],tables:common.concat(["contactos_estudiante","notas_titulacion","divisiones_estudiante"])},
    {id:"defart",label:"Defensas",global:"ConDefart",file:"cone.defart.js",pathHints:["/defart/","defart.html"],aliases:["pantalla_defensas"],canWrite:true,operations:["ready","read","save","update","refresh","status","diagnose"],tables:common.concat(["notas_titulacion","divisiones_estudiante","cambios_pendientes"])},
    {id:"ncomplex",label:"Ncomplex",global:"ConNcomplex",file:"cone.ncomplex.js",pathHints:["/ncomplex/","ncomplex.html"],aliases:["complexivo"],canWrite:true,operations:["ready","read","save","update","refresh","status","diagnose"],tables:common.concat(["evaluaciones_titulacion","importaciones","cambios_pendientes"])},
    {id:"cr_def",label:"Cr-def",global:"ConCrDef",file:"cone.crdef.js",pathHints:["/cr-def/","cr-def.html"],aliases:["crdef","cr-def","sacar_n"],tables:common.concat(["notas_titulacion","divisiones_estudiante"])},
    {id:"infor",label:"Infor",global:"ConInfor",file:"cone.infor.js",pathHints:["/infor/","/titulacion/","titulacion.html"],aliases:["titulacion","informe_titulacion"],tables:common.concat(["notas_titulacion","evaluaciones_titulacion"])},
    {id:"defensas",label:"Defensas legacy",global:"ConDefensas",file:"cone.defensas.js",pathHints:["__legacy_defensas__"],aliases:["defensas_legacy"],canWrite:true,enabled:false,operations:["ready","read","save","update","refresh","status"],tables:common.concat(["notas_titulacion","divisiones_estudiante"])}
  ];

  rows.forEach(function(item){register(item.id,item);});

  window.BDLocalConeRegistry={
    version:VERSION,register:register,get:get,list:list,resolve:resolve,detect:detect,status:status
  };

  dispatch("bdlocal:connections:registry-ready",{
    ok:true,version:VERSION,total:list().length,detectedScreen:detect(""),at:new Date().toISOString()
  });
})(window,document);
