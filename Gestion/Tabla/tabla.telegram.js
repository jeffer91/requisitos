/* =========================================================
Nombre completo: tabla.telegram.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.telegram.js
Función o funciones:
- Controlar el contacto individual por Telegram desde la pantalla Tabla.
- Abrir un modal compacto por estudiante.
- Generar vista previa usando TablaMessage.
- Copiar el mensaje y abrir Telegram cuando exista usuario o chat disponible.
- Enviar mensaje individual por bot mediante TablaTelegramApi.
- Registrar resultados en el historial local de Tabla.
Con qué se conecta:
- tabla.core.js
- tabla.message.js
- tabla.telegram-api.js
- tabla.history.js
- tabla.app.js
- tabla.css
========================================================= */
(function(window,document){
  "use strict";

  var state={row:null,type:"requisitos",sending:false};

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  function status(message,cls){
    var box=el("tabla-status");
    if(box){box.textContent=message;box.className="tabla-status "+(cls||"");}
  }

  function info(row){
    if(window.TablaCore&&typeof window.TablaCore.telegramInfo==="function")return window.TablaCore.telegramInfo(row||{});
    return {user:text(row&&row._telegramUser),chatId:text(row&&row._telegramChatId),hasTelegram:!!(row&&(row._telegramUser||row._telegramChatId)),canSendByBot:!!(row&&row._telegramChatId)};
  }

  function url(row){
    if(window.TablaCore&&typeof window.TablaCore.telegramUrl==="function")return window.TablaCore.telegramUrl(row||{});
    var tg=info(row);
    if(tg.user)return "https://t.me/"+encodeURIComponent(tg.user.replace(/^@+/,""));
    if(tg.chatId)return "tg://user?id="+encodeURIComponent(tg.chatId);
    return "";
  }

  function datos(row){
    if(window.TablaMessage&&typeof window.TablaMessage.datosEstudiante==="function")return window.TablaMessage.datosEstudiante(row||{});
    return {nombre:text(row&&row._nombres)||"estudiante",cedula:text(row&&row._cedula),carrera:text(row&&row._carrera),periodo:text(row&&row._periodo)};
  }

  function generarMensaje(){
    if(!state.row)return "";
    var tipo=el("tabla-tg-tipo")?el("tabla-tg-tipo").value:state.type;
    var textoLibre=el("tabla-tg-texto")?el("tabla-tg-texto").value:"";
    state.type=tipo;
    if(window.TablaMessage&&typeof window.TablaMessage.generarMensaje==="function"){
      return window.TablaMessage.generarMensaje(state.row,tipo,{texto:textoLibre});
    }
    return textoLibre||"Estimado/a estudiante, reciba un cordial saludo.";
  }

  function registrarHistorial(estado,error,telegramMessageId){
    if(!state.row||!window.TablaHistory||typeof window.TablaHistory.guardar!=="function")return;
    var d=datos(state.row);
    var tg=info(state.row);
    window.TablaHistory.guardar({
      modo:"individual",
      tipoMensaje:state.type,
      cedula:d.cedula,
      nombre:d.nombre,
      carrera:d.carrera,
      periodo:d.periodo,
      telegramUser:tg.user,
      telegramChatId:tg.chatId,
      mensaje:generarMensaje(),
      estado:estado,
      error:error||"",
      telegramMessageId:telegramMessageId||null
    });
  }

  function actualizarInfo(){
    if(!state.row)return;
    var d=datos(state.row);
    var tg=info(state.row);
    var title=el("tabla-tg-title"), meta=el("tabla-tg-meta"), tgBox=el("tabla-tg-dato"), warn=el("tabla-tg-warning"), send=el("tabla-tg-send");
    if(title)title.textContent="Telegram individual";
    if(meta)meta.innerHTML="<strong>"+esc(d.nombre)+"</strong> · "+esc(d.cedula||"Sin cédula")+" · "+esc(d.carrera||"Sin carrera")+" · "+esc(d.periodo||"Sin período");
    if(tgBox)tgBox.textContent=tg.chatId?"Chat ID: "+tg.chatId:(tg.user?"Usuario: @"+tg.user:"Sin Telegram registrado");
    if(warn){
      if(tg.canSendByBot)warn.textContent="Listo para envío por bot. Revise la vista previa antes de enviar.";
      else if(tg.user)warn.textContent="Tiene usuario de Telegram, pero no chatId. Puede abrir el perfil y copiar el mensaje.";
      else warn.textContent="Este estudiante no tiene Telegram registrado. Puede copiar el mensaje para usar otro canal.";
    }
    if(send)send.disabled=!tg.canSendByBot||state.sending;
  }

  function actualizarPreview(){
    var preview=el("tabla-tg-preview");
    if(preview)preview.value=generarMensaje();
  }

  async function copiarTexto(value){
    var msg=text(value);
    if(!msg)return false;
    if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(msg);return true;}
    var area=document.createElement("textarea");
    area.value=msg;area.setAttribute("readonly","readonly");area.style.position="fixed";area.style.left="-9999px";
    document.body.appendChild(area);area.select();var ok=document.execCommand("copy");document.body.removeChild(area);return ok;
  }

  async function copiarMensaje(){
    var msg=generarMensaje();
    await copiarTexto(msg);
    status("Mensaje de Telegram copiado.","ok");
    return msg;
  }

  async function abrirTelegram(){
    var link=url(state.row);
    await copiarMensaje();
    if(!link){status("El estudiante no tiene Telegram registrado. El mensaje quedó copiado.","warn");return;}
    window.open(link,"_blank","noopener,noreferrer");
    status("Telegram abierto y mensaje copiado.","ok");
  }

  async function enviarPorBot(){
    if(!state.row||state.sending)return;
    var tg=info(state.row);
    var msg=generarMensaje();
    var d=datos(state.row);
    if(!tg.chatId){status("No se puede enviar por bot: falta chatId de Telegram.","warn");return;}
    if(!window.TablaTelegramApi||typeof window.TablaTelegramApi.enviarMensajeTelegram!=="function"){
      status("No está disponible la API segura de Telegram.","warn");return;
    }
    if(!confirm("¿Enviar este mensaje por Telegram a " + (d.nombre||"estudiante") + "?"))return;
    try{
      state.sending=true;actualizarInfo();
      status("Enviando Telegram a "+(d.nombre||"estudiante")+"...","warn");
      var result=await window.TablaTelegramApi.enviarMensajeTelegram(tg.chatId,msg);
      registrarHistorial("enviado","",result&&result.telegramMessageId);
      status("Mensaje enviado por Telegram a "+(d.nombre||"estudiante")+".","ok");
    }catch(error){
      console.error("[TablaTelegram]",error);
      registrarHistorial("fallido",error&&error.message?error.message:String(error));
      status(error&&error.message?error.message:String(error),"warn");
    }finally{
      state.sending=false;actualizarInfo();
    }
  }

  function toggleTextoLibre(){
    var tipo=el("tabla-tg-tipo")?el("tabla-tg-tipo").value:"requisitos";
    var box=el("tabla-tg-texto-wrap");
    var label=el("tabla-tg-texto-label");
    if(box)box.hidden=tipo==="requisitos";
    if(label)label.textContent=tipo==="cronograma"?"Cronograma o información manual":"Mensaje libre";
  }

  function abrir(row){
    state.row=row||null;
    state.type="requisitos";
    state.sending=false;
    if(el("tabla-tg-tipo"))el("tabla-tg-tipo").value="requisitos";
    if(el("tabla-tg-texto"))el("tabla-tg-texto").value="";
    toggleTextoLibre();actualizarInfo();actualizarPreview();
    var modal=el("tabla-telegram-modal");
    if(modal){modal.hidden=false;modal.setAttribute("aria-hidden","false");}
  }

  function cerrar(){
    var modal=el("tabla-telegram-modal");
    if(modal){modal.hidden=true;modal.setAttribute("aria-hidden","true");}
    state.row=null;
  }

  function bind(){
    var tipo=el("tabla-tg-tipo"), texto=el("tabla-tg-texto"), cerrarBtn=el("tabla-tg-close"), cancelarBtn=el("tabla-tg-cancel"), copiarBtn=el("tabla-tg-copy"), abrirBtn=el("tabla-tg-open"), sendBtn=el("tabla-tg-send");
    if(tipo)tipo.addEventListener("change",function(){toggleTextoLibre();actualizarPreview();actualizarInfo();});
    if(texto)texto.addEventListener("input",actualizarPreview);
    if(cerrarBtn)cerrarBtn.addEventListener("click",cerrar);
    if(cancelarBtn)cancelarBtn.addEventListener("click",cerrar);
    if(copiarBtn)copiarBtn.addEventListener("click",function(){copiarMensaje();});
    if(abrirBtn)abrirBtn.addEventListener("click",function(){abrirTelegram();});
    if(sendBtn)sendBtn.addEventListener("click",function(){enviarPorBot();});
    var modal=el("tabla-telegram-modal");
    if(modal)modal.addEventListener("click",function(event){if(event.target===modal)cerrar();});
    document.addEventListener("keydown",function(event){if(event.key==="Escape"&&modal&&!modal.hidden)cerrar();});
  }

  function boot(){bind();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();

  window.TablaTelegram={abrir:abrir,cerrar:cerrar,generarMensaje:generarMensaje,copiarMensaje:copiarMensaje,abrirTelegram:abrirTelegram,enviarPorBot:enviarPorBot,info:info,url:url};
})(window,document);
