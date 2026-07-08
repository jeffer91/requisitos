/* =========================================================
Nombre completo: tabla.history.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.history.js
Función:
- Historial local de mensajes de Tabla.
- Soporta WhatsApp, Telegram y correo.
- Entrega conteos por canal y último mensaje por estudiante.
========================================================= */
(function(window,document){
  "use strict";

  var STORAGE_KEY="tabla.mensajes.historial.v1";
  var LEGACY_KEY="tabla.telegram.historial.v1";
  var MAX_ITEMS=3000;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"").toLowerCase();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function now(){return new Date().toISOString();}
  function shortDate(value){try{return value?new Date(value).toLocaleString("es-EC"):"—";}catch(error){return text(value)||"—";}}
  function status(message,cls){var box=el("tabla-status");if(box){box.textContent=message;box.className="tabla-status "+(cls||"");}}

  function readRaw(key){
    try{var raw=window.localStorage?window.localStorage.getItem(key):"";var parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed:[];}catch(error){return [];}
  }

  function write(items){
    var list=(Array.isArray(items)?items:[]).slice(0,MAX_ITEMS);
    try{if(window.localStorage)window.localStorage.setItem(STORAGE_KEY,JSON.stringify(list));}catch(error){console.warn("[TablaHistory]",error);}
    return list;
  }

  function channel(value){
    var k=norm(value||"telegram");
    if(k==="wa"||k==="whatsapp")return "whatsapp";
    if(k==="tg"||k==="telegram")return "telegram";
    if(k==="mail"||k==="email"||k==="correo")return "mail";
    return k||"telegram";
  }

  function channelLabel(value){
    var c=channel(value);
    if(c==="whatsapp")return "WA";
    if(c==="telegram")return "TG";
    if(c==="mail")return "Mail";
    return c.toUpperCase();
  }

  function normalizeItem(item){
    item=item||{};
    return {
      id:item.id||("hist_"+Date.now()+"_"+Math.random().toString(16).slice(2)),
      fecha:item.fecha||now(),
      canal:channel(item.canal||item.channel||"telegram"),
      origen:item.origen||"tabla",
      modo:item.modo||"individual",
      tipoMensaje:item.tipoMensaje||item.tipo||"requisitos",
      tipoLabel:item.tipoLabel||"",
      cedula:text(item.cedula),
      nombre:text(item.nombre),
      carrera:text(item.carrera),
      periodo:text(item.periodo),
      correo:text(item.correo||item.email),
      telefono:text(item.telefono||item.celular||item.whatsapp),
      telegramUser:text(item.telegramUser),
      telegramChatId:text(item.telegramChatId||item.chatId),
      mensaje:text(item.mensaje),
      estado:text(item.estado)||"pendiente",
      error:text(item.error),
      loteId:text(item.loteId),
      messageId:item.messageId||item.telegramMessageId||null,
      telegramMessageId:item.telegramMessageId||null
    };
  }

  function read(){
    var current=readRaw(STORAGE_KEY);
    if(current.length)return current.map(normalizeItem);
    var legacy=readRaw(LEGACY_KEY);
    if(!legacy.length)return [];
    var migrated=legacy.map(function(item){item=item||{};item.canal=item.canal||"telegram";return normalizeItem(item);});
    write(migrated);
    return migrated;
  }

  function guardar(item){
    var list=read();
    var normalized=normalizeItem(item);
    list.unshift(normalized);
    write(list);
    render();
    try{window.dispatchEvent(new CustomEvent("tabla:history-updated",{detail:{item:normalized}}));}catch(error){}
    return normalized;
  }

  function guardarMuchos(items){
    var nuevos=(Array.isArray(items)?items:[]).map(normalizeItem);
    var list=nuevos.concat(read());
    write(list);
    render();
    try{window.dispatchEvent(new CustomEvent("tabla:history-updated",{detail:{items:nuevos}}));}catch(error){}
    return nuevos;
  }

  function limpiar(){write([]);render();status("Historial de mensajes limpiado.","ok");}
  function keyFromRow(row){row=row||{};return norm(row._cedula||row.cedula||row.numeroIdentificacion||row.numeroidentificacion||row.identificacion||"");}
  function studentKey(value){return norm(value);}

  function forStudent(rowOrCedula){
    var key=typeof rowOrCedula==="object"?keyFromRow(rowOrCedula):studentKey(rowOrCedula);
    if(!key)return [];
    return read().filter(function(item){return studentKey(item.cedula)===key;});
  }

  function countsForStudent(rowOrCedula){
    var out={whatsapp:0,telegram:0,mail:0,total:0,wa:0,tg:0,email:0};
    forStudent(rowOrCedula).forEach(function(item){var c=channel(item.canal);out.total+=1;out[c]=(out[c]||0)+1;});
    out.wa=out.whatsapp||0;out.tg=out.telegram||0;out.email=out.mail||0;
    return out;
  }

  function lastForStudent(rowOrCedula){
    var list=forStudent(rowOrCedula);
    if(!list.length)return null;
    list.sort(function(a,b){return String(b.fecha||"").localeCompare(String(a.fecha||""));});
    return list[0];
  }

  function lastLabel(rowOrCedula){
    var item=lastForStudent(rowOrCedula);
    if(!item)return "—";
    var date="";
    try{date=new Date(item.fecha).toLocaleDateString("es-EC",{day:"2-digit",month:"2-digit"});}catch(error){date=text(item.fecha).slice(0,10);}
    return "Últ: "+channelLabel(item.canal)+" · "+text(item.tipoLabel||item.tipoMensaje||"Msg")+" · "+date;
  }

  function exportJson(){
    var data=JSON.stringify(read(),null,2);
    try{navigator.clipboard&&navigator.clipboard.writeText&&navigator.clipboard.writeText(data);}catch(error){}
    status("Historial JSON preparado y copiado si el navegador lo permite.","ok");
  }

  function exportCsv(){
    var headers=["fecha","canal","modo","tipoMensaje","cedula","nombre","carrera","periodo","estado","error"];
    var lines=[headers.join(",")].concat(read().map(function(item){return headers.map(function(h){return '"'+text(item[h]).replace(/"/g,'""')+'"';}).join(",");}));
    try{navigator.clipboard&&navigator.clipboard.writeText&&navigator.clipboard.writeText(lines.join("\n"));}catch(error){}
    status("Historial CSV preparado y copiado si el navegador lo permite.","ok");
  }

  function resumen(list){
    var out={total:list.length,enviado:0,fallido:0,omitido:0,pendiente:0,whatsapp:0,telegram:0,mail:0};
    list.forEach(function(item){var k=item.estado||"pendiente",c=channel(item.canal);out[k]=(out[k]||0)+1;out[c]=(out[c]||0)+1;});
    return out;
  }

  function render(){
    var box=el("tabla-history-list"),sumBox=el("tabla-history-summary");
    if(!box&&!sumBox)return;
    var list=read(),sum=resumen(list);
    if(sumBox)sumBox.innerHTML='<span>Total: <strong>'+esc(sum.total)+'</strong></span><span>WA: <strong>'+esc(sum.whatsapp||0)+'</strong></span><span>TG: <strong>'+esc(sum.telegram||0)+'</strong></span><span>Mail: <strong>'+esc(sum.mail||0)+'</strong></span><span>Enviados: <strong>'+esc(sum.enviado||0)+'</strong></span>';
    if(!box)return;
    if(!list.length){box.innerHTML='<div class="empty">Aún no hay historial de mensajes.</div>';return;}
    var html='<table class="tabla-mini-table"><thead><tr><th>Fecha</th><th>Canal</th><th>Estudiante</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>';
    html+=list.slice(0,300).map(function(item){var cls=item.estado==="enviado"?"pill-ok":item.estado==="fallido"?"pill-bad":"pill-warn";return '<tr><td>'+esc(shortDate(item.fecha))+'</td><td><strong>'+esc(channelLabel(item.canal))+'</strong></td><td><strong>'+esc(item.nombre||"Estudiante")+'</strong><br><small>'+esc(item.cedula||"Sin cédula")+'</small></td><td>'+esc(item.tipoLabel||item.tipoMensaje)+'</td><td><span class="pill '+cls+'">'+esc(item.estado)+'</span></td></tr>';}).join("");
    html+='</tbody></table>';
    if(list.length>300)html+='<div class="tabla-mass-note">Mostrando 300 de '+list.length+' registros. Use exportar para ver todo.</div>';
    box.innerHTML=html;
  }

  function abrir(){var m=el("tabla-history-modal");render();if(m){m.hidden=false;m.setAttribute("aria-hidden","false");}}
  function cerrar(){var m=el("tabla-history-modal");if(m){m.hidden=true;m.setAttribute("aria-hidden","true");}}

  function bind(){
    var open=el("tabla-history-open"),close=el("tabla-history-close"),cancel=el("tabla-history-cancel"),clear=el("tabla-history-clear"),json=el("tabla-history-json"),csv=el("tabla-history-csv"),m=el("tabla-history-modal");
    if(open)open.addEventListener("click",abrir);
    if(close)close.addEventListener("click",cerrar);
    if(cancel)cancel.addEventListener("click",cerrar);
    if(clear)clear.addEventListener("click",function(){limpiar();});
    if(json)json.addEventListener("click",exportJson);
    if(csv)csv.addEventListener("click",exportCsv);
    if(m)m.addEventListener("click",function(event){if(event.target===m)cerrar();});
    document.addEventListener("keydown",function(event){if(event.key==="Escape"&&m&&!m.hidden)cerrar();});
  }

  function boot(){bind();render();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();

  window.TablaHistory={guardar:guardar,guardarMuchos:guardarMuchos,listar:read,limpiar:limpiar,exportJson:exportJson,exportCsv:exportCsv,abrir:abrir,cerrar:cerrar,render:render,forStudent:forStudent,countsForStudent:countsForStudent,lastForStudent:lastForStudent,lastLabel:lastLabel,channelLabel:channelLabel,channel:channel};
})(window,document);
