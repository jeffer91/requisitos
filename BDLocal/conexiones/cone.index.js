(function(window,document){
  "use strict";
  var U=window.BDLocalConUtils;
  if(!U){return;}
  var base=document.currentScript&&document.currentScript.src?document.currentScript.src:window.location.href;
  var state={connectors:{},errors:[],ready:false};
  function src(file){try{return new URL(file,base).href;}catch(e){return file;}}
  function add(file){
    return new Promise(function(resolve){
      var url=src(file);
      var exists=Array.prototype.slice.call(document.scripts||[]).some(function(s){return s.src===url;});
      if(exists){resolve(url);return;}
      var el=document.createElement("script");
      el.src=url;
      el.async=false;
      el.onload=function(){resolve(url);};
      el.onerror=function(){state.errors.push({file:file,at:U.nowISO()});resolve(url);};
      document.head.appendChild(el);
    });
  }
  function seq(files){var p=Promise.resolve();files.forEach(function(f){p=p.then(function(){return add(f);});});return p;}
  function register(name,api){if(!name||!api){return false;}state.connectors[name]=api;window.BDLocalConexiones[name]=api;return true;}
  function get(name){return state.connectors[U.text(name)]||null;}
  function ensureCoreReady(){
    var c=window.BL2Core||window.BDLocal||null;
    if(c&&typeof c.ready==="function"){return c.ready().then(function(){return c;}).catch(function(){return c;});}
    if(c&&typeof c.init==="function"){return c.init().then(function(){return c;}).catch(function(){return c;});}
    return Promise.resolve(c);
  }
  function refreshCache(){
    return ensureCoreReady().then(function(c){
      c=window.BL2Core||c;
      if(!c){return U.readCache();}
      var p=typeof c.getPeriods==="function"?c.getPeriods().catch(function(){return [];}):Promise.resolve([]);
      var s=typeof c.getStudents==="function"?c.getStudents({}).catch(function(){return [];}):Promise.resolve([]);
      var r=typeof c.getRequirements==="function"?c.getRequirements({}).catch(function(){return [];}):Promise.resolve([]);
      return Promise.all([p,s,r]).then(function(v){return U.writeCache({meta:{source:"cone.index",updatedAt:U.nowISO()},periods:v[0]||[],students:v[1]||[],requirements:v[2]||[],summaries:{},diagnostics:state.errors});});
    });
  }
  function status(){var c=U.readCache();return {ok:state.errors.length===0,ready:state.ready,connectors:Object.keys(state.connectors),periods:c.periods.length,students:c.students.length,errors:state.errors};}
  function ready(){
    return refreshCache().then(function(){return seq(["cone.carga.js","cone.tabla.js","cone.ficha.js","cone.stats.js","cone.coordi.js","cone.reportes.js","cone.global.js"]);}).then(function(){state.ready=true;return status();});
  }
  window.BDLocalConexiones=window.BDLocalConexiones||{};
  Object.assign(window.BDLocalConexiones,{version:"1.0.2",ready:ready,ensureCoreReady:ensureCoreReady,refreshCache:refreshCache,register:register,get:get,status:status,utils:U});
  ready();
})(window,document);
