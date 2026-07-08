/* =========================================================
Nombre completo: tabla.history.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.history.js
Función:
- Historial local de mensajes de Tabla.
- Soporta WhatsApp, Telegram y correo.
- Entrega conteos por canal y último mensaje por estudiante.
- Versión corregida para evitar cuelgues: lee localStorage una sola vez,
  mantiene caché en memoria e índice por cédula.
========================================================= */
(function(window,document){
  "use strict";

  var STORAGE_KEY="tabla.mensajes.historial.v1";
  var LEGACY_KEY="tabla.telegram.historial.v1";
  var MAX_ITEMS=3000;
  var cache={loaded:false,list:[],byStudent:{},version:0};
  var renderTimer=null;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"").toLowerCase();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function now(){return new Date().toISOString();}
  function shortDate(value){try{return value?new Date(value).toLocaleString("es-EC"):"—";}catch(error){return text(value)||"—";}}
  function status(message,cls){var box=el("tabla-status");if(box){box.textContent=message;box.className="tabla-status "+(cls||"");}}

  function readRaw(key){
    try{
      var raw=window.localStorage?window.localStorage.getItem(key):"";
      var parsed=raw?JSON.parse(raw):[];
      return Array.isArray(parsed)?parsed:[];
    }catch(error){
      return [];
    }
  }

  function writeRaw(key,value){
    try{
      if(window.localStorage){
        window.localStorage.setItem(key,JSON.stringify(value||[]));
      }
    }catch(error){
      status("No se pudo guardar el historial local. Revise espacio del navegador.","warn");
    }
  }

  function download(filename,content,type){
    try{
      var blob=new Blob([content],{type:type||"text/plain;charset=utf-8"});
      var a=document.createElement("a");
      a.href=URL.createObjectURL(blob);
      a.download=filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){
        URL.revokeObjectURL(a.href);
        if(a.parentNode)a.parentNode.removeChild(a);
      },1000);
    }catch(error){}
  }

  function copy(texto){
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(texto);
      }
    }catch(error){}
  }

  function channel(value){
    var c=norm(value);
    if(c==="wa"||c==="wsp"||c==="whatsapp")return "whatsapp";
    if(c==="tg"||c==="telegram")return "telegram";
    if(c==="mail"||c==="email"||c==="correo"||c==="correoelectronico")return "mail";
    return c||"telegram";
  }

  function channelLabel(value){
    var c=channel(value);
    if(c==="whatsapp")return "WA";
    if(c==="telegram")return "TG";
    if(c==="mail")return "Mail";
    return c||"—";
  }

  function studentKey(value){return norm(value);}

  function keyFromRow(row){
    row=row||{};
    return studentKey(
      row._cedula||
      row.cedula||
      row.Cedula||
      row.numeroIdentificacion||
      row.NumeroIdentificacion||
      row.identificacion||
      row.Identificacion||
      ""
    );
  }

  function itemStudentKey(item){
    item=item||{};
    return studentKey(
      item.cedula||
      item.identificacion||
      item.numeroIdentificacion||
      item._cedula||
      ""
    );
  }

  function normalizeEstado(value){
    var s=norm(value||"preparado");
    if(s==="enviado"||s==="sent"||s==="ok")return "enviado";
    if(s==="fallido"||s==="error"||s==="failed")return "fallido";
    if(s==="omitido"||s==="skip"||s==="skipped")return "omitido";
    if(s==="pendiente"||s==="pending")return "pendiente";
    if(s==="preparado"||s==="prepared")return "preparado";
    return text(value)||"preparado";
  }

  function normalizeItem(item){
    item=item||{};

    var canal=channel(item.canal||item.channel||item.tipoCanal||item.medio);
    var fecha=text(item.fecha||item.date||item.createdAt||item.actualizadoEn||item.enviadoEn)||now();
    var cedula=text(item.cedula||item.identificacion||item.numeroIdentificacion||item._cedula);
    var tipo=text(item.tipoMensaje||item.tipo||item.type||item.messageType||"requisitos");

    return {
      id:text(item.id)||("hist-"+fecha+"-"+Math.random().toString(36).slice(2,8)),
      fecha:fecha,
      canal:canal,
      modo:text(item.modo||item.mode||"individual"),
      tipoMensaje:tipo,
      tipoLabel:text(item.tipoLabel||item.label||tipo),
      cedula:cedula,
      nombre:text(item.nombre||item.nombres||item.estudiante||item.name||"Estudiante"),
      carrera:text(item.carrera||item._carrera),
      periodo:text(item.periodo||item.periodoLabel||item._periodo),
      correo:text(item.correo||item.email||item.mail),
      telefono:text(item.telefono||item.celular||item.whatsapp),
      telegramUser:text(item.telegramUser||item.usuarioTelegram||item.telegram),
      telegramChatId:text(item.telegramChatId||item.chatIdTelegram||item.chatId),
      mensaje:text(item.mensaje||item.message||item.texto),
      estado:normalizeEstado(item.estado||item.status),
      error:text(item.error||item.errorMessage),
      loteId:text(item.loteId||item.batchId),
      messageId:item.messageId||item.telegramMessageId||null,
      telegramMessageId:item.telegramMessageId||null
    };
  }

  function sortList(list){
    return (list||[]).sort(function(a,b){
      return String(b.fecha||"").localeCompare(String(a.fecha||""));
    });
  }

  function rebuildIndex(){
    var index={};

    cache.list.forEach(function(item){
      var key=itemStudentKey(item);
      if(!key)return;

      if(!index[key]){
        index[key]={
          items:[],
          counts:{whatsapp:0,telegram:0,mail:0,total:0,wa:0,tg:0,email:0},
          last:null,
          lastLabel:"—"
        };
      }

      index[key].items.push(item);
      index[key].counts.total+=1;
      index[key].counts[item.canal]=(index[key].counts[item.canal]||0)+1;

      if(!index[key].last||String(item.fecha||"").localeCompare(String(index[key].last.fecha||""))>0){
        index[key].last=item;
      }
    });

    Object.keys(index).forEach(function(key){
      var counts=index[key].counts;
      var last=index[key].last;

      counts.wa=counts.whatsapp||0;
      counts.tg=counts.telegram||0;
      counts.email=counts.mail||0;

      if(last){
        var date="";
        try{
          date=new Date(last.fecha).toLocaleDateString("es-EC",{day:"2-digit",month:"2-digit"});
        }catch(error){
          date=text(last.fecha).slice(0,10);
        }

        index[key].lastLabel="Últ: "+channelLabel(last.canal)+" · "+text(last.tipoLabel||last.tipoMensaje||"Msg")+" · "+date;
      }
    });

    cache.byStudent=index;
    cache.version+=1;
  }

  function ensureLoaded(){
    if(cache.loaded)return;

    var current=readRaw(STORAGE_KEY);
    var legacy=[];
    var migrated=false;

    if(current.length){
      cache.list=current.map(normalizeItem);
    }else{
      legacy=readRaw(LEGACY_KEY);

      if(legacy.length){
        cache.list=legacy.map(function(item){
          item=item||{};
          item.canal=item.canal||"telegram";
          return normalizeItem(item);
        });

        migrated=true;
      }else{
        cache.list=[];
      }
    }

    cache.list=sortList(cache.list).slice(0,MAX_ITEMS);
    cache.loaded=true;
    rebuildIndex();

    if(migrated){
      writeRaw(STORAGE_KEY,cache.list);
    }
  }

  function write(list){
    cache.list=sortList((Array.isArray(list)?list:[]).map(normalizeItem)).slice(0,MAX_ITEMS);
    cache.loaded=true;
    rebuildIndex();
    writeRaw(STORAGE_KEY,cache.list);
  }

  function read(){
    ensureLoaded();
    return cache.list.slice();
  }

  function notify(detail){
    try{
      window.dispatchEvent(new CustomEvent("tabla:history-updated",{detail:detail||{}}));
    }catch(error){}
  }

  function renderIfOpenSoon(){
    if(renderTimer)clearTimeout(renderTimer);

    renderTimer=setTimeout(function(){
      renderTimer=null;

      var modal=el("tabla-history-modal");
      if(modal&&!modal.hidden)render();
    },80);
  }

  function guardar(item){
    ensureLoaded();

    var normalized=normalizeItem(item);
    cache.list.unshift(normalized);
    write(cache.list);
    renderIfOpenSoon();
    notify({item:normalized});

    return normalized;
  }

  function guardarMuchos(items){
    ensureLoaded();

    var nuevos=(Array.isArray(items)?items:[]).map(normalizeItem);

    write(nuevos.concat(cache.list));
    renderIfOpenSoon();
    notify({items:nuevos});

    return nuevos;
  }

  function limpiar(){
    write([]);
    render();
    status("Historial de mensajes limpiado.","ok");
    notify({clear:true});
  }

  function forStudent(rowOrCedula){
    ensureLoaded();

    var key=typeof rowOrCedula==="object"?keyFromRow(rowOrCedula):studentKey(rowOrCedula);

    if(!key||!cache.byStudent[key])return [];

    return cache.byStudent[key].items.slice();
  }

  function countsForStudent(rowOrCedula){
    ensureLoaded();

    var key=typeof rowOrCedula==="object"?keyFromRow(rowOrCedula):studentKey(rowOrCedula);
    var empty={whatsapp:0,telegram:0,mail:0,total:0,wa:0,tg:0,email:0};

    if(!key||!cache.byStudent[key])return empty;

    return Object.assign({},empty,cache.byStudent[key].counts);
  }

  function lastForStudent(rowOrCedula){
    ensureLoaded();

    var key=typeof rowOrCedula==="object"?keyFromRow(rowOrCedula):studentKey(rowOrCedula);

    if(!key||!cache.byStudent[key])return null;

    return cache.byStudent[key].last||null;
  }

  function lastLabel(rowOrCedula){
    ensureLoaded();

    var key=typeof rowOrCedula==="object"?keyFromRow(rowOrCedula):studentKey(rowOrCedula);

    if(!key||!cache.byStudent[key])return "—";

    return cache.byStudent[key].lastLabel||"—";
  }

  function preloadForRows(rows){
    ensureLoaded();
    return {version:cache.version,total:cache.list.length};
  }

  function resumen(list){
    var out={
      total:list.length,
      enviado:0,
      fallido:0,
      omitido:0,
      pendiente:0,
      preparado:0,
      whatsapp:0,
      telegram:0,
      mail:0
    };

    list.forEach(function(item){
      var estado=item.estado||"pendiente";
      var canal=channel(item.canal);

      out[estado]=(out[estado]||0)+1;
      out[canal]=(out[canal]||0)+1;
    });

    return out;
  }

  function csvCell(value){
    return '"'+text(value).replace(/"/g,'""')+'"';
  }

  function toCsv(list){
    var headers=[
      "fecha",
      "canal",
      "modo",
      "tipoMensaje",
      "tipoLabel",
      "cedula",
      "nombre",
      "carrera",
      "periodo",
      "correo",
      "telefono",
      "telegramUser",
      "telegramChatId",
      "estado",
      "error",
      "loteId",
      "messageId"
    ];

    var lines=[headers.join(",")];

    (list||[]).forEach(function(item){
      lines.push(headers.map(function(key){
        return csvCell(item[key]);
      }).join(","));
    });

    return lines.join("\n");
  }

  function exportJson(){
    var data=JSON.stringify(read(),null,2);

    copy(data);
    download("tabla-historial-mensajes.json",data,"application/json;charset=utf-8");
    status("Historial JSON exportado.","ok");
  }

  function exportCsv(){
    var data=toCsv(read());

    copy(data);
    download("tabla-historial-mensajes.csv",data,"text/csv;charset=utf-8");
    status("Historial CSV exportado.","ok");
  }

  function render(){
    ensureLoaded();

    var box=el("tabla-history-list");
    var sumBox=el("tabla-history-summary");
    var list=cache.list;
    var sum=resumen(list);

    if(sumBox){
      sumBox.innerHTML=
        '<span>Total: <strong>'+esc(sum.total)+'</strong></span>'+
        '<span>WA: <strong>'+esc(sum.whatsapp||0)+'</strong></span>'+
        '<span>TG: <strong>'+esc(sum.telegram||0)+'</strong></span>'+
        '<span>Mail: <strong>'+esc(sum.mail||0)+'</strong></span>'+
        '<span>Preparados: <strong>'+esc(sum.preparado||0)+'</strong></span>'+
        '<span>Enviados: <strong>'+esc(sum.enviado||0)+'</strong></span>';
    }

    if(!box)return;

    if(!list.length){
      box.innerHTML='<div class="empty">Aún no hay historial de mensajes.</div>';
      return;
    }

    var html='<table class="tabla-mini-table"><thead><tr><th>Fecha</th><th>Canal</th><th>Estudiante</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>';

    html+=list.slice(0,300).map(function(item){
      var cls=item.estado==="enviado"?"pill-ok":(item.estado==="fallido"?"pill-bad":"pill-warn");

      return '<tr>'+
        '<td>'+esc(shortDate(item.fecha))+'</td>'+
        '<td><strong>'+esc(channelLabel(item.canal))+'</strong></td>'+
        '<td><strong>'+esc(item.nombre||"Estudiante")+'</strong><br><small>'+esc(item.cedula||"Sin cédula")+'</small></td>'+
        '<td>'+esc(item.tipoLabel||item.tipoMensaje)+'</td>'+
        '<td><span class="pill '+cls+'">'+esc(item.estado||"pendiente")+'</span></td>'+
      '</tr>';
    }).join("");

    html+='</tbody></table>';

    if(list.length>300){
      html+='<div class="tabla-mass-note">Mostrando 300 de '+esc(list.length)+' registros. Use exportar para ver todo.</div>';
    }

    box.innerHTML=html;
  }

  function abrir(){
    var modal=el("tabla-history-modal");

    render();

    if(modal){
      modal.hidden=false;
      modal.setAttribute("aria-hidden","false");
    }
  }

  function cerrar(){
    var modal=el("tabla-history-modal");

    if(modal){
      modal.hidden=true;
      modal.setAttribute("aria-hidden","true");
    }
  }

  function bind(){
    var open=el("tabla-history-open");
    var close=el("tabla-history-close");
    var cancel=el("tabla-history-cancel");
    var clear=el("tabla-history-clear");
    var json=el("tabla-history-json");
    var csv=el("tabla-history-csv");
    var modal=el("tabla-history-modal");

    if(open)open.addEventListener("click",abrir);
    if(close)close.addEventListener("click",cerrar);
    if(cancel)cancel.addEventListener("click",cerrar);
    if(clear)clear.addEventListener("click",function(){limpiar();});
    if(json)json.addEventListener("click",exportJson);
    if(csv)csv.addEventListener("click",exportCsv);

    if(modal){
      modal.addEventListener("click",function(event){
        if(event.target===modal)cerrar();
      });
    }

    document.addEventListener("keydown",function(event){
      if(event.key==="Escape"&&modal&&!modal.hidden)cerrar();
    });
  }

  function boot(){
    ensureLoaded();
    bind();
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot);
  }else{
    boot();
  }

  window.TablaHistory={
    read:read,
    list:read,
    guardar:guardar,
    guardarMuchos:guardarMuchos,
    limpiar:limpiar,
    forStudent:forStudent,
    countsForStudent:countsForStudent,
    lastForStudent:lastForStudent,
    lastLabel:lastLabel,
    preloadForRows:preloadForRows,
    render:render,
    abrir:abrir,
    cerrar:cerrar,
    exportJson:exportJson,
    exportCsv:exportCsv,
    channel:channel,
    channelLabel:channelLabel,
    _cache:function(){
      ensureLoaded();
      return {total:cache.list.length,version:cache.version};
    }
  };
})(window,document);