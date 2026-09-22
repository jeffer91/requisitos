/* =========================================================
Nombre completo: cr-def.render.js
Ruta: /Cr-def/cr-def.render.js
Función:
- Decorar el cronograma real de 9 columnas.
- Resaltar programados, sin cupo y conflictos sin depender de columnas internas.
- Mantener alertas en tooltip.
========================================================= */
(function(window,document){
  "use strict";

  function $(selector){return document.querySelector(selector);}
  function txt(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function app(){return window.CR_DEF_APP||null;}
  function state(){return app()&&app().state?app().state:null;}
  function rowKey(row){row=row||{};return [row.periodoId,row.cedula,row.intento||1].map(txt).join("__");}

  function buildMap(){
    var st=state(),map=Object.create(null);
    if(!st||!Array.isArray(st.rows))return map;
    st.rows.forEach(function(row){map[rowKey(row)]=row;});
    return map;
  }

  function decorateRow(tr,row){
    if(!tr||!row||tr.classList.contains("cr-empty-row")||tr.classList.contains("cr-career-row"))return;
    tr.classList.remove("cr-row--programado","cr-row--sin-cupo","cr-row--conflicto","cr-row--danger","cr-row--warn");
    if(row.estadoClave==="conflicto")tr.classList.add("cr-row--conflicto");
    else if(!txt(row.dia)||!txt(row.hora)||row.estadoClave==="sin-cupo")tr.classList.add("cr-row--sin-cupo");
    else if(row.estadoClave==="programado")tr.classList.add("cr-row--programado");
    if(Array.isArray(row.alertas)&&row.alertas.length)tr.title=row.alertas.join("\n");
  }

  function decorate(){
    var body=$("[data-cr-tabla-body]");
    if(!body)return;
    var map=buildMap();
    Array.prototype.slice.call(body.querySelectorAll("tr[data-cr-row-key]")).forEach(function(tr){
      decorateRow(tr,map[txt(tr.getAttribute("data-cr-row-key"))]);
    });
  }

  function start(){
    var body=$("[data-cr-tabla-body]");
    if(!body)return;
    var timer=null;
    new MutationObserver(function(){
      clearTimeout(timer);
      timer=setTimeout(decorate,30);
    }).observe(body,{childList:true,subtree:true});
    decorate();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);
  else start();
})(window,document);
