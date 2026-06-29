/* =========================================================
Nombre completo: tabla.history.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.history.js
Función o funciones:
- Guardar historial local de envíos de Telegram desde Tabla.
- Registrar envíos individuales, masivos, fallidos y omitidos.
- Mostrar historial en modal consultable.
- Exportar historial a JSON o CSV.
Con qué se conecta:
- tabla.telegram.js
- tabla.mass.js
- tabla.html
- tabla.css
========================================================= */
(function(window,document){
  "use strict";

  var STORAGE_KEY="tabla.telegram.historial.v1";
  var MAX_ITEMS=2000;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function now(){return new Date().toISOString();}
  function shortDate(value){
    var raw=text(value);
    if(!raw)return "—";
    try{return new Date(raw).toLocaleString("es-EC");}catch(error){return raw;}
  }
  function status(message,cls){var box=el("tabla-status");if(box){box.textContent=message;box.className="tabla-status "+(cls||"");}}
  function read(){
    try{
      var raw=window.localStorage?window.localStorage.getItem(STORAGE_KEY):"";
      var parsed=raw?JSON.parse(raw):[];
      return Array.isArray(parsed)?parsed:[];
    }catch(error){return [];}
  }
  function write(items){
    var list=(Array.isArray(items)?items:[]).slice(0,MAX_ITEMS);
    try{if(window.localStorage)window.localStorage.setItem(STORAGE_KEY,JSON.stringify(list));}catch(error){console.warn("[TablaHistory]",error);}
    return list;
  }
  function normalizeItem(item){
    item=item||{};
    return {
      id:item.id||("hist_"+Date.now()+"_"+Math.random().toString(16).slice(2)),
      fecha:item.fecha||now(),
      canal:"telegram",
      origen:item.origen||"tabla",
      modo:item.modo||"individual",
      tipoMensaje:item.tipoMensaje||item.tipo||"requisitos",
      cedula:text(item.cedula),
      nombre:text(item.nombre),
      carrera:text(item.carrera),
      periodo:text(item.periodo),
      telegramUser:text(item.telegramUser),
      telegramChatId:text(item.telegramChatId||item.chatId),
      mensaje:text(item.mensaje),
      estado:text(item.estado)||"pendiente",
      error:text(item.error),
      loteId:text(item.loteId),
      telegramMessageId:item.telegramMessageId||null
    };
  }
  function guardar(item){
    var list=read();
    var normalized=normalizeItem(item);
    list.unshift(normalized);
    write(list);
    render();
    return normalized;
  }
  function guardarMuchos(items){
    var nuevos=(Array.isArray(items)?items:[]).map(normalizeItem);
    var list=nuevos.concat(read());
    write(list);
    render();
    return nuevos;
  }
  function limpiar(){write([]);render();status("Historial de Telegram limpiado.","ok");}
  function exportJson(){
    var data=read();
    var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
    download(blob,"tabla-telegram-historial.json");
  }
  function csvCell(value){return '"'+text(value).replace(/"/g,'""')+'"';}
  function exportCsv(){
    var headers=["fecha","modo","tipoMensaje","cedula","nombre","carrera","periodo","telegramUser","telegramChatId","estado","error","mensaje"];
    var lines=[headers.join(",")].concat(read().map(function(item){return headers.map(function(h){return csvCell(item[h]);}).join(",");}));
    var blob=new Blob([lines.join("\n")],{type:"text/csv;charset=utf-8"});
    download(blob,"tabla-telegram-historial.csv");
  }
  function download(blob,name){
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  }
  function resumen(list){
    var out={total:list.length,enviado:0,fallido:0,omitido:0,pendiente:0};
    list.forEach(function(item){var k=item.estado||"pendiente";out[k]=(out[k]||0)+1;});
    return out;
  }
  function render(){
    var box=el("tabla-history-list");
    var sumBox=el("tabla-history-summary");
    if(!box&&!sumBox)return;
    var list=read();
    var sum=resumen(list);
    if(sumBox){sumBox.innerHTML='<span>Total: <strong>'+esc(sum.total)+'</strong></span><span>Enviados: <strong>'+esc(sum.enviado||0)+'</strong></span><span>Fallidos: <strong>'+esc(sum.fallido||0)+'</strong></span><span>Omitidos: <strong>'+esc(sum.omitido||0)+'</strong></span>';}
    if(!box)return;
    if(!list.length){box.innerHTML='<div class="empty">Aún no hay historial de Telegram.</div>';return;}
    var html='<table class="tabla-mini-table"><thead><tr><th>Fecha</th><th>Estudiante</th><th>Tipo</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>';
    html+=list.slice(0,300).map(function(item){
      var cls=item.estado==="enviado"?"pill-ok":item.estado==="fallido"?"pill-bad":"pill-warn";
      return '<tr><td>'+esc(shortDate(item.fecha))+'</td><td><strong>'+esc(item.nombre||"Estudiante")+'</strong><br><small>'+esc(item.cedula||"Sin cédula")+'</small></td><td>'+esc(item.modo)+" / "+esc(item.tipoMensaje)+'</td><td><span class="pill '+cls+'">'+esc(item.estado)+'</span></td><td>'+esc(item.error||item.telegramUser||item.telegramChatId||"—")+'</td></tr>';
    }).join("");
    html+='</tbody></table>';
    if(list.length>300)html+='<div class="tabla-mass-note">Mostrando 300 de '+list.length+' registros. Use exportar para ver todo.</div>';
    box.innerHTML=html;
  }
  function abrir(){var m=el("tabla-history-modal");render();if(m){m.hidden=false;m.setAttribute("aria-hidden","false");}}
  function cerrar(){var m=el("tabla-history-modal");if(m){m.hidden=true;m.setAttribute("aria-hidden","true");}}
  function bind(){
    var open=el("tabla-history-open"), close=el("tabla-history-close"), cancel=el("tabla-history-cancel"), clear=el("tabla-history-clear"), json=el("tabla-history-json"), csv=el("tabla-history-csv"), m=el("tabla-history-modal");
    if(open)open.addEventListener("click",abrir);
    if(close)close.addEventListener("click",cerrar);
    if(cancel)cancel.addEventListener("click",cerrar);
    if(clear)clear.addEventListener("click",function(){if(confirm("¿Limpiar todo el historial local de Telegram?"))limpiar();});
    if(json)json.addEventListener("click",exportJson);
    if(csv)csv.addEventListener("click",exportCsv);
    if(m)m.addEventListener("click",function(event){if(event.target===m)cerrar();});
    document.addEventListener("keydown",function(event){if(event.key==="Escape"&&m&&!m.hidden)cerrar();});
  }
  function boot(){bind();render();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();

  window.TablaHistory={guardar:guardar,guardarMuchos:guardarMuchos,listar:read,limpiar:limpiar,exportJson:exportJson,exportCsv:exportCsv,abrir:abrir,cerrar:cerrar,render:render};
})(window,document);
