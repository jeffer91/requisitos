/* =========================================================
Nombre completo: tabla.mass.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.mass.js
Función o funciones:
- Controlar el modal de Telegram masivo desde la pantalla Tabla.
- Usar los estudiantes filtrados actualmente.
- Permitir selección manual, seleccionar con chatId para bot y limpiar selección.
- Generar vista previa del primer estudiante seleccionado.
- Preparar y enviar lote por API segura de Telegram.
- Registrar resultados del lote en el historial local, incluyendo omitidos por falta de chatId.
Con qué se conecta:
- tabla.core.js
- tabla.message.js
- tabla.selection.js
- tabla.telegram-api.js
- tabla.history.js
- tabla.app.js
- tabla.css
========================================================= */
(function(window,document){
  "use strict";

  var state={rows:[],filters:null,type:"requisitos",prepared:null,sending:false};

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function status(message,cls){var box=el("tabla-status");if(box){box.textContent=message;box.className="tabla-status "+(cls||"");}}

  function modal(){return el("tabla-mass-modal");}
  function selection(){return window.TablaSelection;}
  function message(){return window.TablaMessage;}

  function generarMensaje(row){
    var tipo=el("tabla-mass-tipo")?el("tabla-mass-tipo").value:state.type;
    var textoLibre=el("tabla-mass-texto")?el("tabla-mass-texto").value:"";
    state.type=tipo;
    if(message()&&typeof message().generarMensaje==="function")return message().generarMensaje(row,tipo,{texto:textoLibre});
    return textoLibre||"Estimado/a estudiante, reciba un cordial saludo.";
  }

  function toggleTexto(){
    var tipo=el("tabla-mass-tipo")?el("tabla-mass-tipo").value:"requisitos";
    var wrap=el("tabla-mass-texto-wrap"), label=el("tabla-mass-texto-label");
    if(wrap)wrap.hidden=tipo==="requisitos";
    if(label)label.textContent=tipo==="cronograma"?"Cronograma o información general":"Mensaje libre";
  }

  function renderSummary(){
    if(!selection())return;
    var s=selection().summary();
    var box=el("tabla-mass-summary");
    if(box){
      box.innerHTML=[
        '<span>Total: <strong>'+esc(s.total)+'</strong></span>',
        '<span>Con Telegram: <strong>'+esc(s.conTelegram)+'</strong></span>',
        '<span>Con chatId: <strong>'+esc(s.conChatId||0)+'</strong></span>',
        '<span>Seleccionados: <strong>'+esc(s.seleccionados)+'</strong></span>',
        '<span>Listos para bot: <strong>'+esc(s.seleccionadosConChatId||0)+'</strong></span>'
      ].join("");
    }
    var meta=el("tabla-mass-meta");
    if(meta)meta.textContent="Se usarán los estudiantes filtrados actualmente. Para envío por bot solo entran los que tienen chatId.";
  }

  function rowTelegramInfo(row){return (selection()&&selection().telegramInfo)?selection().telegramInfo(row):{user:row._telegramUser,chatId:row._telegramChatId,hasTelegram:!!(row._telegramUser||row._telegramChatId),canSendByBot:!!row._telegramChatId};}
  function rowTelegramLabel(row){
    var tg=rowTelegramInfo(row);
    if(tg.chatId)return "Chat ID";
    if(tg.user)return "@"+tg.user+" · sin chatId";
    return "Sin Telegram";
  }
  function rowTelegramClass(row){
    var tg=rowTelegramInfo(row);
    if(tg.chatId)return "pill-ok";
    if(tg.user)return "pill-warn";
    return "pill-bad";
  }

  function renderList(){
    if(!selection())return;
    var data=selection().getState();
    var rows=data.rows;
    var selected=data.selected;
    var box=el("tabla-mass-list");
    if(!box)return;
    if(!rows.length){box.innerHTML='<div class="empty">No hay estudiantes filtrados para preparar envío.</div>';return;}
    var limit=300;
    var html='<table class="tabla-mini-table"><thead><tr><th></th><th>Estudiante</th><th>Carrera</th><th>Estado</th><th>Telegram</th></tr></thead><tbody>';
    html+=rows.slice(0,limit).map(function(row){
      var key=row._tablaSelectionKey;
      var checked=selected[key]?"checked":"";
      var estado=row._estadoGeneral&&row._estadoGeneral.label?row._estadoGeneral.label:"—";
      var tgClass=rowTelegramClass(row);
      return '<tr><td><input class="tabla-mass-check" type="checkbox" data-mass-key="'+esc(key)+'" '+checked+' /></td><td><strong>'+esc(row._nombres||"Estudiante")+'</strong><br><small>'+esc(row._cedula||"Sin cédula")+'</small></td><td>'+esc(row._carrera||"—")+'</td><td>'+esc(estado)+'</td><td><span class="pill '+tgClass+'">'+esc(rowTelegramLabel(row))+'</span></td></tr>';
    }).join("");
    html+='</tbody></table>';
    if(rows.length>limit)html+='<div class="tabla-mass-note">Mostrando '+limit+' de '+rows.length+' estudiantes filtrados. La selección completa se conserva.</div>';
    box.innerHTML=html;
  }

  function renderPreview(){
    if(!selection())return;
    var preview=el("tabla-mass-preview");
    var rows=selection().selectedRows();
    if(!preview)return;
    if(!rows.length){preview.value="Seleccione al menos un estudiante para generar la vista previa.";return;}
    preview.value=generarMensaje(rows[0]);
  }

  function refresh(){renderSummary();renderList();renderPreview();state.prepared=null;}

  function abrir(rows,filters){
    state.rows=Array.isArray(rows)?rows.slice():[];
    state.filters=filters||null;
    state.type="requisitos";
    state.prepared=null;
    state.sending=false;
    if(selection())selection().create(state.rows,{selectWithBot:true});
    if(el("tabla-mass-tipo"))el("tabla-mass-tipo").value="requisitos";
    if(el("tabla-mass-texto"))el("tabla-mass-texto").value="";
    if(el("tabla-mass-confirm"))el("tabla-mass-confirm").checked=false;
    toggleTexto();refresh();
    var m=modal();if(m){m.hidden=false;m.setAttribute("aria-hidden","false");}
  }

  function cerrar(){var m=modal();if(m){m.hidden=true;m.setAttribute("aria-hidden","true");}}

  async function copiarPreview(){
    var preview=el("tabla-mass-preview");
    var value=preview?preview.value:"";
    if(!value)return;
    if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(value);
    else{
      var area=document.createElement("textarea");area.value=value;area.setAttribute("readonly","readonly");area.style.position="fixed";area.style.left="-9999px";document.body.appendChild(area);area.select();document.execCommand("copy");document.body.removeChild(area);
    }
    status("Vista previa masiva copiada.","ok");
  }

  function omitidoSinChatId(row){
    var tg=selection().telegramInfo(row);
    return {
      cedula:row._cedula||"",
      nombre:row._nombres||"",
      carrera:row._carrera||"",
      periodo:row._periodo||"",
      telegramUser:tg.user||"",
      telegramChatId:tg.chatId||"",
      mensaje:generarMensaje(row),
      estado:"omitido",
      error:"Sin chatId para envío por bot"
    };
  }

  function prepararLote(){
    if(!selection())return null;
    var confirmBox=el("tabla-mass-confirm");
    if(confirmBox&&!confirmBox.checked){status("Confirme la revisión antes de preparar el lote masivo.","warn");return null;}
    var selected=typeof selection().selectedWithBot==="function"?selection().selectedWithBot():selection().selectedWithTelegram();
    var sinChatId=typeof selection().selectedWithoutBot==="function"?selection().selectedWithoutBot():selection().selectedWithoutTelegram();
    if(!selected.length){status("No hay estudiantes seleccionados con chatId para envío por bot.","warn");return null;}
    var lote=selected.map(function(row){
      var tg=selection().telegramInfo(row);
      return {
        cedula:row._cedula||"",
        nombre:row._nombres||"",
        carrera:row._carrera||"",
        periodo:row._periodo||"",
        telegramUser:tg.user||"",
        telegramChatId:tg.chatId||"",
        mensaje:generarMensaje(row),
        estado:"pendiente"
      };
    });
    var omitidos=sinChatId.map(omitidoSinChatId);
    state.prepared={tipo:state.type,total:lote.length,sinChatId:sinChatId.length,lote:lote,omitidosSinChatId:omitidos,creadoEn:new Date().toISOString()};
    status("Lote preparado: "+lote.length+" mensaje(s) con chatId. Omitidos por falta de chatId: "+sinChatId.length+".","ok");
    return state.prepared;
  }

  function guardarHistorialMasivo(resultado,prepared){
    if(!window.TablaHistory||typeof window.TablaHistory.guardarMuchos!=="function")return;
    var loteId="lote_"+Date.now();
    var tipo=prepared&&prepared.tipo?prepared.tipo:state.type;
    var items=[];
    function add(list,estado){
      (Array.isArray(list)?list:[]).forEach(function(item){
        items.push({
          modo:"masivo",
          tipoMensaje:tipo,
          loteId:loteId,
          cedula:item.cedula||"",
          nombre:item.nombre||"",
          carrera:item.carrera||"",
          periodo:item.periodo||"",
          telegramUser:item.telegramUser||"",
          telegramChatId:item.telegramChatId||item.chatId||"",
          mensaje:item.mensaje||"",
          estado:estado,
          error:item.error||"",
          telegramMessageId:item.telegramMessageId||null
        });
      });
    }
    add(resultado&&resultado.enviados,"enviado");
    add(resultado&&resultado.fallidos,"fallido");
    add(resultado&&resultado.omitidos,"omitido");
    add(prepared&&prepared.omitidosSinChatId,"omitido");
    if(items.length)window.TablaHistory.guardarMuchos(items);
  }

  async function enviarLote(){
    if(state.sending)return;
    var prepared=state.prepared||prepararLote();
    if(!prepared)return;
    if(!window.TablaTelegramApi||typeof window.TablaTelegramApi.enviarLoteTelegram!=="function"){
      status("No está disponible la API segura de Telegram.","warn");return;
    }
    if(!confirm("¿Enviar " + prepared.total + " mensaje(s) por Telegram?"))return;
    try{
      state.sending=true;
      status("Enviando lote de Telegram: "+prepared.total+" mensaje(s)...","warn");
      var resultado=await window.TablaTelegramApi.enviarLoteTelegram(prepared.lote);
      state.prepared.resultado=resultado;
      guardarHistorialMasivo(resultado,prepared);
      var omitidosTotal=(resultado.resumen.omitidos||0)+(prepared.omitidosSinChatId?prepared.omitidosSinChatId.length:0);
      status("Telegram masivo finalizado. Enviados: "+resultado.resumen.enviados+", fallidos: "+resultado.resumen.fallidos+", omitidos: "+omitidosTotal+".",resultado.resumen.fallidos?"warn":"ok");
    }catch(error){
      console.error("[TablaMass]",error);
      status(error&&error.message?error.message:String(error),"warn");
    }finally{
      state.sending=false;
    }
  }

  function bind(){
    var m=modal();
    var tipo=el("tabla-mass-tipo"), texto=el("tabla-mass-texto"), close=el("tabla-mass-close"), cancel=el("tabla-mass-cancel"), all=el("tabla-mass-select-all"), tg=el("tabla-mass-select-tg"), clear=el("tabla-mass-clear"), copy=el("tabla-mass-copy"), prepare=el("tabla-mass-prepare"), send=el("tabla-mass-send"), list=el("tabla-mass-list");
    if(tipo)tipo.addEventListener("change",function(){toggleTexto();renderPreview();state.prepared=null;});
    if(texto)texto.addEventListener("input",function(){renderPreview();state.prepared=null;});
    if(close)close.addEventListener("click",cerrar);
    if(cancel)cancel.addEventListener("click",cerrar);
    if(all)all.addEventListener("click",function(){selection().selectAll();refresh();});
    if(tg)tg.addEventListener("click",function(){if(selection().selectWithBot)selection().selectWithBot();else selection().selectWithTelegram();refresh();});
    if(clear)clear.addEventListener("click",function(){selection().clear();refresh();});
    if(copy)copy.addEventListener("click",function(){copiarPreview();});
    if(prepare)prepare.addEventListener("click",function(){prepararLote();});
    if(send)send.addEventListener("click",function(){enviarLote();});
    if(list)list.addEventListener("change",function(event){var check=event.target.closest?event.target.closest("[data-mass-key]"):null;if(!check)return;selection().toggle(check.getAttribute("data-mass-key"),check.checked);state.prepared=null;renderSummary();renderPreview();});
    if(m)m.addEventListener("click",function(event){if(event.target===m)cerrar();});
    document.addEventListener("keydown",function(event){if(event.key==="Escape"&&m&&!m.hidden)cerrar();});
  }

  function boot(){bind();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();

  window.TablaMass={abrir:abrir,cerrar:cerrar,refresh:refresh,prepararLote:prepararLote,enviarLote:enviarLote,getPrepared:function(){return state.prepared;},getState:function(){return Object.assign({},state);}};
})(window,document);
