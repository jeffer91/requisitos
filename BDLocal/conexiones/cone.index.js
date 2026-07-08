(function(window,document){
  "use strict";
  var U=window.BDLocalConUtils;
  if(!U){return;}
  var base=document.currentScript&&document.currentScript.src?document.currentScript.src:window.location.href;
  var state={connectors:{},errors:[],ready:false,loading:null};
  function src(file){try{return new URL(file,base).href;}catch(e){return file;}}
  function add(file){
    return new Promise(function(resolve){
      var url=src(file);
      var exists=Array.prototype.slice.call(document.scripts||[]).some(function(s){return s.src===url||s.getAttribute("data-bdl-con-src")===url;});
      if(exists){resolve(url);return;}
      var el=document.createElement("script");
      el.src=url;
      el.async=false;
      el.defer=false;
      el.setAttribute("data-bdl-con-src",url);
      el.onload=function(){resolve(url);};
      el.onerror=function(){state.errors.push({file:file,at:U.nowISO()});resolve(url);};
      document.head.appendChild(el);
    });
  }
  function seq(files){var p=Promise.resolve();files.forEach(function(f){p=p.then(function(){return add(f);});});return p;}
  function register(name,api){name=U.text(name);if(!name||!api){return false;}state.connectors[name]=api;window.BDLocalConexiones[name]=api;return true;}
  function get(name){return state.connectors[U.text(name)]||null;}
  function needsConfigV2(){
    var cfg=window.BL2Config||{};
    var stores=cfg.stores||{};
    return !window.BL2Config||Number(cfg.dbVersion||1)<2||!stores.matriculasPeriodo||!stores.requisitosEstudiante||!stores.cambiosPendientes;
  }
  function ensureCoreScripts(){
    var files=[];
    if(!window.BL2Config){files.push("../bl2.config.js");}
    if(!window.BL2DB&&needsConfigV2()){files.push("../bl2.config.v2.js");}
    if(!window.BL2DB){files.push("../bl2.db.js");}
    if(!window.BL2Backup){files.push("../bl2.backup.js");}
    if(!window.BL2Import){files.push("../bl2.import.js");}
    if(!window.BL2Sync){files.push("../bl2.sync.js");}
    if(!window.BL2Core){files.push("../bl2.core.js");}
    if(!window.BDLocal||!window.BL2DataEngine||!window.ExcelLocalRepo){files.push("../bl2.compat.js");}
    return seq(files);
  }
  function ensureCoreReady(){
    return ensureCoreScripts().then(function(){
      var c=window.BL2Core||null;
      var bd=window.BDLocal||null;
      if(window.BL2DB&&window.BL2Config&&Number(window.BL2Config.dbVersion||1)<2){
        state.errors.push({file:"../bl2.config.v2.js",message:"BL2DB ya estaba cargado antes de aplicar configuracion v2. Recargue la pantalla para completar la migracion.",at:U.nowISO()});
      }
      if(bd&&typeof bd.ready==="function"){return bd.ready().then(function(){return c||bd;}).catch(function(){return c||bd;});}
      if(c&&typeof c.getState==="function"){try{var st=c.getState()||{};if(st.initialized){return c;}}catch(e){}}
      if(c&&typeof c.init==="function"){return c.init().then(function(){return c;}).catch(function(){return c;});}
      return c||bd||null;
    });
  }
  function refreshCache(options){
    options=options||{};
    return ensureCoreReady().then(function(c){
      c=window.BL2Core||c;
      if(!c){return U.readCache();}
      var p=typeof c.getPeriods==="function"?c.getPeriods().catch(function(){return [];}):Promise.resolve([]);
      var s=typeof c.getStudents==="function"?c.getStudents({}).catch(function(){return [];}):Promise.resolve([]);
      var r=typeof c.getRequirements==="function"?c.getRequirements({}).catch(function(){return [];}):Promise.resolve([]);
      return Promise.all([p,s,r]).then(function(v){return U.writeCache({meta:{app:"Requisitos",module:"BDLocalConexiones",version:"1.0.4",source:options.source||"cone.index",updatedAt:U.nowISO(),schemaVersion:(window.BL2Config&&window.BL2Config.schemaVersion)||""},periods:v[0]||[],students:v[1]||[],requirements:v[2]||[],summaries:{},diagnostics:state.errors});});
    });
  }
  function status(){var c=U.readCache();return {ok:state.errors.length===0,ready:state.ready,connectors:Object.keys(state.connectors),periods:c.periods.length,students:c.students.length,errors:state.errors};}
  function loadConnectors(){return seq(["cone.carga.js","cone.tabla.js","cone.ficha.js","cone.stats.js","cone.coordi.js","cone.reportes.js","cone.global.js"]);}
  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.loading&&!options.force){return state.loading;}
    state.loading=refreshCache({source:"BDLocalConexiones.ready"}).then(function(){return loadConnectors();}).then(function(){state.ready=true;return status();}).finally(function(){state.loading=null;});
    return state.loading;
  }
  window.BDLocalConexiones=window.BDLocalConexiones||{};
  Object.assign(window.BDLocalConexiones,{version:"1.0.4",ready:ready,ensureCoreReady:ensureCoreReady,refreshCache:refreshCache,register:register,get:get,status:status,utils:U});
  ready({force:false});
})(window,document);
