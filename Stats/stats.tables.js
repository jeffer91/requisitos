/* =========================================================
Nombre completo: stats.tables.js
Ruta o ubicación: /Requisitos/Stats/stats.tables.js
Función o funciones:
- Hacer ordenables las tablas de Stats al presionar sus encabezados.
- Soportar ordenamiento por texto, número y porcentaje.
- Reaplicar ordenamiento después de cada renderizado dinámico.
- Mantener estado visual ascendente / descendente en encabezados.
Con qué se conecta:
- stats.html
- stats.css
- stats.app.js
- stats.students.js
========================================================= */
(function(window,document){
  "use strict";

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es");}
  function number(value){
    var raw=text(value).replace(/%/g,"").replace(/\s/g,"");
    if(raw.indexOf(",")>=0&&raw.indexOf(".")>=0)raw=raw.replace(/\./g,"").replace(",",".");
    else if(raw.indexOf(",")>=0)raw=raw.replace(",",".");
    raw=raw.replace(/[^0-9.\-]/g,"");
    var parsed=Number(raw);
    return isFinite(parsed)?parsed:0;
  }

  function cellValue(cell,type){
    if(!cell)return "";
    var value=cell.getAttribute("data-sort");
    if(value==null||value==="")value=cell.textContent;
    type=type||"text";
    if(type==="number"||type==="percent")return number(value);
    return norm(value);
  }

  function clearHeaders(table,active){
    Array.prototype.forEach.call(table.querySelectorAll("thead th"),function(th){
      if(th!==active){th.removeAttribute("aria-sort");th.classList.remove("sort-asc","sort-desc");}
    });
  }

  function compareRows(a,b,index,type,dir){
    var av=cellValue(a.children[index],type);
    var bv=cellValue(b.children[index],type);
    var result=0;
    if(type==="number"||type==="percent")result=av-bv;
    else result=String(av).localeCompare(String(bv),"es",{numeric:true,sensitivity:"base"});
    if(result===0)result=norm(a.textContent).localeCompare(norm(b.textContent),"es",{numeric:true,sensitivity:"base"});
    return dir==="desc"?-result:result;
  }

  function sortTable(table,index,type,dir){
    var tbody=table.tBodies&&table.tBodies[0];
    if(!tbody)return;
    var rows=Array.prototype.slice.call(tbody.rows);
    rows.sort(function(a,b){return compareRows(a,b,index,type,dir);});
    rows.forEach(function(row){tbody.appendChild(row);});
  }

  function bindTable(table){
    if(!table||table.getAttribute("data-sortable-bound")==="true")return;
    var headers=table.querySelectorAll("thead th");
    Array.prototype.forEach.call(headers,function(th,index){
      th.setAttribute("role","button");
      th.setAttribute("tabindex","0");
      th.classList.add("stats-sort-head");

      function activate(){
        var type=th.getAttribute("data-sort-type")||"text";
        var current=th.getAttribute("aria-sort");
        var dir=current==="ascending"?"desc":"asc";
        clearHeaders(table,th);
        th.setAttribute("aria-sort",dir==="asc"?"ascending":"descending");
        th.classList.toggle("sort-asc",dir==="asc");
        th.classList.toggle("sort-desc",dir==="desc");
        sortTable(table,index,type,dir);
      }

      th.addEventListener("click",activate);
      th.addEventListener("keydown",function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();activate();}});
    });
    table.setAttribute("data-sortable-bound","true");
  }

  function bindAll(root){root=root||document;Array.prototype.forEach.call(root.querySelectorAll('table[data-sortable="true"], table.stats-sortable-table'),bindTable);}
  function reset(table){if(!table)return;table.removeAttribute("data-sortable-bound");Array.prototype.forEach.call(table.querySelectorAll("thead th"),function(th){th.removeAttribute("aria-sort");th.classList.remove("sort-asc","sort-desc");});bindTable(table);}

  window.StatsTables={bindTable:bindTable,bindAll:bindAll,sortTable:sortTable,reset:reset};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){bindAll(document);});
  else bindAll(document);
})(window,document);
