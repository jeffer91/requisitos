/* =========================================================
Nombre completo: carga.period-global-bridge.js
Ruta: /Carga/carga.period-global-bridge.js
Función:
- Incorporar el período global en Carga cuando la caché del conector todavía no lo contiene.
- Reutilizar el evento oficial carga:periods-refreshed para actualizar el estado interno de CargaUI.
- Seleccionar el período global después de que los selectores estén listos.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-global-period-augmentation";
  var augmenting=false;
  var timer=null;

  function text(value){return String(value==null?"":value).trim();}
  function canonical(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function globalPeriod(){
    var api=window.BDLPeriodoGlobal||window.RequisitosPeriodoGlobal||null;
    try{
      var current=api&&typeof api.get==="function"?api.get():api&&typeof api.status==="function"?(api.status()||{}).period:null;
      var id=canonical(current&&(current.id||current.periodoId||current.value));
      if(!id){return null;}
      return {
        id:id,value:id,periodoId:id,periodoCanonicoId:id,
        label:text(current.label||current.periodoLabel||id),
        periodoLabel:text(current.label||current.periodoLabel||id),
        periodoCanonicoLabel:text(current.label||current.periodoLabel||id),
        source:"periodo_global"
      };
    }catch(error){return null;}
  }
  function periodsFromSelect(){
    var select=document.getElementById("cargaPeriodoSelect");
    var rows=[];
    Array.prototype.slice.call(select&&select.options||[]).forEach(function(option){
      var id=canonical(option.value);
      if(id){rows.push({id:id,value:id,periodoId:id,label:text(option.textContent||id),periodoLabel:text(option.textContent||id)});}
    });
    return rows;
  }
  function selectGlobal(period){
    var select=document.getElementById("cargaPeriodoSelect");
    if(!select||!period){return false;}
    var option=Array.prototype.slice.call(select.options||[]).find(function(item){return canonical(item.value)===period.id;});
    if(!option){return false;}
    if(canonical(select.value)!==period.id){
      select.value=option.value;
      try{select.dispatchEvent(new CustomEvent("change",{bubbles:true,detail:{periodoGlobal:true,periodoId:period.id,periodoLabel:period.label}}));}
      catch(error){select.dispatchEvent(new Event("change",{bubbles:true}));}
    }
    return canonical(select.value)===period.id;
  }
  function augment(){
    var period=globalPeriod();
    var select=document.getElementById("cargaPeriodoSelect");
    if(!period||!select){return false;}
    var exists=Array.prototype.some.call(select.options||[],function(option){return canonical(option.value)===period.id;});
    if(!exists&&!augmenting){
      var rows=periodsFromSelect();
      rows.push(period);
      augmenting=true;
      try{window.dispatchEvent(new CustomEvent("carga:periods-refreshed",{detail:{ok:true,source:"CargaPeriodGlobalBridge",periods:rows,total:rows.length}}));}
      finally{augmenting=false;}
    }
    return selectGlobal(period);
  }
  function retry(attempt){
    attempt=Math.max(0,Number(attempt||0));
    window.clearTimeout(timer);
    if(augment()){return;}
    if(attempt<100){timer=window.setTimeout(function(){retry(attempt+1);},200);}
  }
  function bind(){
    window.addEventListener("carga:connection-ready",function(){retry(0);});
    window.addEventListener("carga:periods-refreshed",function(){if(!augmenting){window.setTimeout(function(){retry(0);},0);}});
    window.addEventListener("requisitos:periodo-global-cambiado",function(){retry(0);});
    retry(0);
  }

  window.CargaPeriodGlobalBridge={version:VERSION,augment:augment,retry:retry};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind,{once:true});}else{bind();}
})(window,document);
