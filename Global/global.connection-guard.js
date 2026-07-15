/* =========================================================
Nombre completo: global.connection-guard.js
Ruta: /Global/global.connection-guard.js
Función:
- Validar que GlobalCore reciba únicamente datos de ConGlobal.
- Rechazar snapshots heredados o de respaldo.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-conglobal-strict";
  var ALLOWED=["conglobal","bdlocalglobal"];
  var installed=false;

  function text(value){return String(value==null?"":value).trim();}
  function key(value){return text(value).toLowerCase().replace(/[^a-z0-9]+/g,"");}
  function core(){return window.GlobalCore||null;}
  function sourceOf(value){
    value=value&&typeof value==="object"?value:{};
    return text(value.source||(value.meta&&value.meta.source)||"");
  }
  function allowedSource(value){return ALLOWED.indexOf(key(sourceOf(value)))>=0;}
  function requireSource(value){
    if(!allowedSource(value)){
      throw new Error("Global rechazó una fuente distinta de ConGlobal: "+(sourceOf(value)||"sin origen")+".");
    }
    return value;
  }
  function statusSource(){
    var current=core();
    return current&&typeof current.status==="function"?current.status():{};
  }
  function validateCurrent(){
    var current=core();
    if(!current){throw new Error("GlobalCore no está disponible.");}
    var status=statusSource();
    if(!allowedSource(status)){
      throw new Error("GlobalCore no confirmó ConGlobal como fuente activa.");
    }
    var snapshot=typeof current.getSnapshot==="function"?current.getSnapshot():null;
    return requireSource(snapshot);
  }
  function wrapAsync(current,name){
    var original=current&&current[name];
    if(typeof original!=="function"||original.__globalConnectionGuard){return;}
    var wrapped=function(){
      var args=arguments;
      return Promise.resolve(original.apply(current,args)).then(function(result){
        requireSource(result);
        validateCurrent();
        return result;
      });
    };
    wrapped.__globalConnectionGuard=true;
    wrapped.__original=original;
    current[name]=wrapped;
  }
  function wrapSync(current,name){
    var original=current&&current[name];
    if(typeof original!=="function"||original.__globalConnectionGuard){return;}
    var wrapped=function(){
      validateCurrent();
      return original.apply(current,arguments);
    };
    wrapped.__globalConnectionGuard=true;
    wrapped.__original=original;
    current[name]=wrapped;
  }
  function install(){
    var current=core();
    if(!current){return false;}
    if(installed||current.__globalConnectionGuard){installed=true;return true;}
    ["ready","refresh","reloadFromCache"].forEach(function(name){wrapAsync(current,name);});
    ["getFilterOptions","applyFilters","buildData"].forEach(function(name){wrapSync(current,name);});
    var originalSnapshot=current.getSnapshot;
    if(typeof originalSnapshot==="function"){
      current.getSnapshot=function(){return requireSource(originalSnapshot.apply(current,arguments));};
      current.getSnapshot.__globalConnectionGuard=true;
      current.getSnapshot.__original=originalSnapshot;
    }
    current.__globalConnectionGuard=true;
    installed=true;
    return true;
  }
  function ready(){
    if(!install()){return Promise.reject(new Error("No se pudo instalar la protección de ConGlobal."));}
    var current=core();
    return Promise.resolve(current.ready({force:true})).then(function(){return validateCurrent();});
  }

  window.GlobalConnectionGuard={version:VERSION,install:install,ready:ready,validate:validateCurrent,allowedSource:allowedSource};
  install();
})(window);
