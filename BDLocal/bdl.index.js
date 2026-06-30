(function(window, document){
  "use strict";

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(error){}
  }

  function boot(){
    if(!window.BDLocal || typeof window.BDLocal.boot !== "function"){
      emit("bdlocal:error", { message: "BDLocal API no disponible" });
      return;
    }

    window.BDLocal.boot().then(function(status){
      emit("bdlocal:ready", status);
    }).catch(function(error){
      emit("bdlocal:error", { message: error && error.message ? error.message : String(error) });
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);
