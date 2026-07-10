/* =========================================================
Nombre completo: tabla.actions.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.actions.js
Función:
- Acciones compactas de Tabla: selector de mensaje, último contacto,
  WhatsApp, Telegram y correo.
- Versión corregida para evitar cuelgues: carga módulos una sola vez,
  evita MutationObserver pesado y mejora filas con render programado.
========================================================= */
(function(window,document){
  "use strict";

  var TYPES=[
    ["requisitos","Falta req."],
    ["urgente","Urgente"],
    ["ultimo","Último aviso"],
    ["regularizar","Regularizar"],
    ["nota_articulo","Falta N-Art"],
    ["nota_defensa","Falta N-Def"],
    ["sin_articulo","Sin artículo"],
    ["no_aprueba","No aprueba"],
    ["perdio","Perdió"],
    ["alerta","Alerta"],
    ["libre","Personal"]
  ];

  var loaded={};
  var loading={};
  var booted=false;
  var enhanceTimer=null;
  var enhancing=false;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function status(message,cls){var box=el("tabla-status");if(box){box.textContent=message;box.className="tabla-status "+(cls||"");}}

  function scriptExists(src){
    return !!document.querySelector(
      'script[src="'+src+'"],script[src*="/'+src+'"],script[data-tabla-lazy="'+src+'"],script[data-tabla-actions="'+src+'"]'
    );
  }

  function load(src){
    if(loaded[src]||scriptExists(src)){
      loaded[src]=true;
      return Promise.resolve();
    }

    if(loading[src])return loading[src];

    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");

      script.src=src;
      script.async=false;
      script.setAttribute("data-tabla-lazy",src);

      script.onload=function(){
        loaded[src]=true;
        delete loading[src];
        resolve();
      };

      script.onerror=function(){
        delete loading[src];
        reject(new Error("No se pudo cargar "+src));
      };

      document.body.appendChild(script);
    });

    return loading[src];
  }

  function loads(list){
    return (list||[]).reduce(function(chain,src){
      return chain.then(function(){
        return load(src);
      });
    },Promise.resolve());
  }

  function needBase(){
    return loads(["tabla.message.js","tabla.history.js"]);
  }

  function needTelegram(){
    return loads(["tabla.message.js","tabla.history.js","tabla.telegram-api.js","tabla.telegram.js"]);
  }

  function appState(){
    return window.TablaApp&&TablaApp.getState?TablaApp.getState():{rows:[]};
  }

  function rowIndexFromNode(node){
    var tr=node&&node.closest?node.closest("tr"):null;

    if(!tr||!tr.parentNode)return -1;

    return Array.prototype.indexOf.call(tr.parentNode.children,tr);
  }

  function rowFor(node){
    var index=rowIndexFromNode(node);

    return (appState().rows||[])[index]||null;
  }

  function tipoFor(node){
    var tr=node&&node.closest?node.closest("tr"):null;
    var select=tr?tr.querySelector(".tabla-message-select"):null;

    return select?select.value:"requisitos";
  }

  function option(value,label,selected){
    return '<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(label)+'</option>';
  }

  function fillSelect(select){
    if(!select)return;
    if(select.getAttribute("data-actions-ready")==="1")return;

    select.innerHTML=TYPES.map(function(item){
      return option(item[0],item[1],item[0]==="requisitos");
    }).join("");

    select.setAttribute("data-actions-ready","1");
  }

  function emptyCounts(){
    return {wa:0,tg:0,email:0,whatsapp:0,telegram:0,mail:0,total:0};
  }

  function counts(row){
    if(window.TablaHistory&&TablaHistory.countsForStudent){
      return TablaHistory.countsForStudent(row);
    }

    return emptyCounts();
  }

  function last(row){
    if(window.TablaHistory&&TablaHistory.lastLabel){
      return TablaHistory.lastLabel(row);
    }

    return "—";
  }

  function button(channel,count,disabled){
    var cls=channel==="WA"?"action-whats":(channel==="TG"?"action-telegram":"action-mail");

    return '<button class="tabla-channel '+cls+'" type="button" '+(disabled?'disabled ':'')+'data-action-channel="'+esc(channel)+'">'+esc(channel)+' <small>'+esc(count||0)+'</small></button>';
  }

  function setCellHtml(cell,html){
    if(cell&&cell.innerHTML!==html){
      cell.innerHTML=html;
    }
  }

  function enhanceNow(){
    var wrap=el("tabla-table-wrap");
    var rows=appState().rows||[];
    var trs;

    if(!wrap||enhancing)return;

    enhancing=true;

    try{
      if(window.TablaHistory&&TablaHistory.preloadForRows){
        TablaHistory.preloadForRows(rows);
      }

      trs=wrap.querySelectorAll("tbody tr");

      Array.prototype.forEach.call(trs,function(tr,index){
        var row=rows[index];
        var c;
        var lastText;

        if(!row||!tr.children||tr.children.length<8)return;

        fillSelect(tr.querySelector(".tabla-message-select"));

        c=counts(row);
        lastText=last(row);

        setCellHtml(
          tr.children[4],
          '<span class="tabla-last-message" title="'+esc(lastText)+'">'+esc(lastText)+'</span>'
        );

        setCellHtml(
          tr.children[5],
          button("WA",c.wa||c.whatsapp||0,!text(row._celular))
        );

        setCellHtml(
          tr.children[6],
          button("TG",c.tg||c.telegram||0,false)
        );

        setCellHtml(
          tr.children[7],
          button("Mail",c.email||c.mail||0,!text(row._correo))
        );
      });
    }catch(error){
      console.warn("[TablaActions] No se pudieron mejorar las filas",error);
    }finally{
      enhancing=false;
    }
  }

  function enhance(delay){
    if(enhanceTimer)clearTimeout(enhanceTimer);

    enhanceTimer=setTimeout(function(){
      enhanceTimer=null;
      enhanceNow();
    },typeof delay==="number"?delay:40);
  }

  function message(row,tipo){
    if(window.TablaMessage&&TablaMessage.generarMensaje){
      return TablaMessage.generarMensaje(row,tipo,{texto:""});
    }

    return "Saludos, "+(row&&row._nombres?row._nombres:"estudiante")+". Desde el área de Titulación se informa que existen novedades en su proceso.";
  }

  function label(tipo){
    var found;

    if(window.TablaMessage&&TablaMessage.tipoLabel){
      return TablaMessage.tipoLabel(tipo);
    }

    found=TYPES.filter(function(item){
      return item[0]===tipo;
    })[0];

    return found?found[1]:tipo;
  }

  function record(row,channel,tipo,msg){
    var data;

    if(!window.TablaHistory||!TablaHistory.guardar)return;

    data=window.TablaMessage&&TablaMessage.datosEstudiante?TablaMessage.datosEstudiante(row):{};

    TablaHistory.guardar({
      canal:channel,
      modo:"individual",
      tipoMensaje:tipo,
      tipoLabel:label(tipo),
      cedula:data.cedula||row._cedula,
      nombre:data.nombre||row._nombres,
      carrera:data.carrera||row._carrera,
      periodo:data.periodo||row._periodo,
      correo:data.correo||row._correo,
      telefono:data.celular||row._celular,
      telegramUser:row._telegramUser,
      telegramChatId:row._telegramChatId,
      mensaje:msg,
      estado:"preparado"
    });
  }

  function normalizePhone(value){
    var phone=text(value).replace(/[^0-9]/g,"");

    if(phone.length===10&&phone.charAt(0)==="0"){
      phone="593"+phone.slice(1);
    }

    return phone;
  }

  function openWA(row,msg){
    var phone=normalizePhone(row&&row._celular);

    if(!phone){
      status("Sin celular registrado.","warn");
      return;
    }

    window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(msg),"_blank","noopener");
  }

  function openMail(row,tipo,msg){
    var email=text(row&&row._correo);
    var subject;

    if(!email){
      status("Sin correo registrado.","warn");
      return;
    }

    subject=window.TablaMessage&&TablaMessage.asunto?TablaMessage.asunto(row,tipo):"Proceso de titulación";

    window.open("mailto:"+encodeURIComponent(email)+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(msg),"_blank","noopener");
  }

  function handleClick(event){
    var btn=event.target&&event.target.closest?event.target.closest("[data-action-channel]"):null;
    var row;
    var channel;
    var tipo;

    if(!btn||btn.disabled)return;

    row=rowFor(btn);
    if(!row)return;

    channel=btn.getAttribute("data-action-channel");
    tipo=tipoFor(btn);
    btn.disabled=true;

    needBase().then(function(){
      var msg=message(row,tipo);

      if(channel==="WA"){
        record(row,"whatsapp",tipo,msg);
        openWA(row,msg);
        status("WhatsApp preparado.","ok");
      }else if(channel==="Mail"){
        record(row,"mail",tipo,msg);
        openMail(row,tipo,msg);
        status("Correo preparado.","ok");
      }else if(channel==="TG"){
        record(row,"telegram",tipo,msg);

        return needTelegram().then(function(){
          if(window.TablaTelegram&&TablaTelegram.abrir){
            TablaTelegram.abrir(row,tipo);
          }

          status("Telegram preparado.","ok");
        });
      }
    }).catch(function(error){
      console.error(error);
      status(error.message||"No se pudo preparar la acción.","warn");
    }).finally(function(){
      btn.disabled=false;
      enhance(120);
    });
  }

  function bindTable(){
    var wrap=el("tabla-table-wrap");

    if(!wrap||wrap.getAttribute("data-tabla-actions-bound")==="1")return;

    wrap.setAttribute("data-tabla-actions-bound","1");

    wrap.addEventListener("click",handleClick);

    wrap.addEventListener("change",function(event){
      if(event.target&&event.target.classList&&event.target.classList.contains("tabla-message-select")){
        enhance(80);
      }
    });
  }

  function boot(){
    if(booted)return;

    booted=true;

    bindTable();

    window.addEventListener("tabla:history-updated",function(){
      enhance(80);
    });

    window.addEventListener("bdlocal:legacy-ready",function(){
      enhance(120);
    });

    window.addEventListener("bdlocal:legacy-snapshot",function(){
      enhance(120);
    });

    window.addEventListener("requisitos:bl:snapshot-changed",function(){
      enhance(120);
    });

    needBase().then(function(){
      enhance(30);
    }).catch(function(){
      enhance(30);
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot);
  }else{
    boot();
  }

  window.TablaActions={
    enhance:enhance,
    enhanceNow:enhanceNow,
    boot:boot
  };
})(window,document);