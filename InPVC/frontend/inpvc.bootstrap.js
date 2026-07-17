/* Arranque seguro de InPVC después de confirmar ConInPVC. */
(function(window,document){
  "use strict";var base=document.currentScript&&document.currentScript.src||document.baseURI;
  function load(relative){return new Promise(function(resolve,reject){var script=document.createElement("script");script.src=new URL(relative,base).href;script.async=false;script.onload=function(){resolve(script.src);};script.onerror=function(){reject(new Error("No se pudo cargar "+relative));};document.head.appendChild(script);});}
  function connectorReady(){var con=window.ConInPVC||window.BDLocalConeInPVC;if(!con){return Promise.reject(new Error("ConInPVC no está disponible."));}return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(status){if(status&&status.ok===false){throw new Error(status.error||"ConInPVC no está listo.");}return con;});}
  function boot(){connectorReady().then(function(){return load("inpvc.app.js");}).catch(function(error){var box=document.getElementById("inpvc-status");if(box){box.className="inpvc-status bad";box.textContent=error.message||String(error);}});}
  window.InPVCBootstrap={boot:boot,connectorReady:connectorReady};if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
