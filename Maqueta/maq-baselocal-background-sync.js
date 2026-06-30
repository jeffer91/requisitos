(function(window,document){
  "use strict";
  var KEY="REQ_MAQ_BL_BACKGROUND_SYNC_STATUS_V1";
  var AUTO="REQ_BL_AUTO_SYNC_ENABLED_V1";
  function now(){return new Date().toISOString();}
  function save(data){try{localStorage.setItem(KEY,JSON.stringify(Object.assign({version:"2.0.0-bdlocal",updatedAt:now(),source:"BDLocal"},data||{})));}catch(error){}}
  function auto(){try{return localStorage.getItem(AUTO)==="true";}catch(error){return false;}}
  function run(){save({ok:true,mode:"delegated",message:"Usa BDLocal > Sincronizar ahora."});return Promise.resolve({ok:true,delegated:true});}
  function schedule(){save({ok:true,mode:auto()?"delegated":"paused",message:auto()?"Auto sync delegado a BDLocal.":"Sincronización automática pausada."});}
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",schedule);}else{schedule();}
  window.MAQ_BASELOCAL_BACKGROUND_SYNC={version:"2.0.0-bdlocal",run:run,status:function(){try{return JSON.parse(localStorage.getItem(KEY)||"{}");}catch(error){return {};}}};
})(window,document);
