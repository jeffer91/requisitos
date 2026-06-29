/* =========================================================
Nombre completo: tabla.telegram-api.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.telegram-api.js
Función o funciones:
- Enviar mensajes de Telegram desde Tabla sin exponer el token del bot en el frontend.
- Conectar con Netlify Functions mediante endpoint seguro.
- Enviar mensajes individuales y lotes masivos controlados.
- Reutilizar token administrativo guardado/configurado cuando exista.
- Preservar saltos de línea y formato del mensaje formal.
Con qué se conecta:
- Requisitos/Titulos/netlify/functions/ta-titulo-articulo-api-telegram.js
- tabla.telegram.js
- tabla.mass.js
========================================================= */
(function(window){
  "use strict";

  var BASE_FUNCTIONS_PATH="/.netlify/functions";
  var LOCAL_FUNCTIONS_URL_DEFAULT="http://127.0.0.1:8888/.netlify/functions";
  var BASE_FUNCTIONS_URL_KEY="tabla.telegram.baseFunctionsUrl";
  var ADMIN_TOKEN_KEY="ta.titulo.articulo.adminToken";
  var ENDPOINT_NAME="ta-titulo-articulo-api-telegram";
  var LOCAL_HOSTS={localhost:true,"127.0.0.1":true,"0.0.0.0":true,"::1":true};

  function clean(value){return String(value==null?"":value).replace(/\s+/g," ").trim();}
  function cleanMessage(value){return String(value==null?"":value).replace(/\r\n/g,"\n").replace(/\r/g,"\n").trim();}
  function normalizarBaseFunctionsUrl(value){
    var url=clean(value).replace(/\/+$/,"");
    if(!url)return "";
    if(url.endsWith(BASE_FUNCTIONS_PATH))return url;
    if(url.indexOf(BASE_FUNCTIONS_PATH+"/")>=0)return url.split(BASE_FUNCTIONS_PATH+"/")[0]+BASE_FUNCTIONS_PATH;
    return url+BASE_FUNCTIONS_PATH;
  }
  function getLocation(){return window.location||null;}
  function getStorage(key){try{return clean(window.localStorage&&window.localStorage.getItem(key));}catch(error){return "";}}
  function setStorage(key,value){try{if(window.localStorage)window.localStorage.setItem(key,value);}catch(error){}}
  function parametroUrl(){
    var names=Array.prototype.slice.call(arguments);
    var location=getLocation();
    if(!location||!location.search)return "";
    var params=new URLSearchParams(location.search);
    for(var i=0;i<names.length;i++){var value=clean(params.get(names[i]));if(value)return value;}
    return "";
  }
  function esArchivoLocal(){var location=getLocation();return location&&location.protocol==="file:";}
  function esHttpLocal(){var location=getLocation();return !!(location&&["http:","https:"].indexOf(location.protocol)>=0&&LOCAL_HOSTS[location.hostname]);}
  function esNetlifyDev(){var location=getLocation();return esHttpLocal()&&clean(location.port)==="8888";}
  function obtenerBaseConfigurada(){
    var desdeParametro=normalizarBaseFunctionsUrl(parametroUrl("tablaFunctionsUrl","functionsUrl","apiUrl","baseFunctionsUrl"));
    if(desdeParametro){setStorage(BASE_FUNCTIONS_URL_KEY,desdeParametro);return desdeParametro;}
    var desdeGlobal=normalizarBaseFunctionsUrl(window.TABLA_TELEGRAM_FUNCTIONS_URL||window.TA_TITULO_ARTICULO_FUNCTIONS_URL);
    if(desdeGlobal){setStorage(BASE_FUNCTIONS_URL_KEY,desdeGlobal);return desdeGlobal;}
    return normalizarBaseFunctionsUrl(getStorage(BASE_FUNCTIONS_URL_KEY));
  }
  function pedirBaseFunctionsUrl(){
    var ingresada=normalizarBaseFunctionsUrl(prompt("Ingrese la URL base de Netlify Functions para Telegram.\n\nEjemplos:\n1) Local: http://127.0.0.1:8888/.netlify/functions\n2) Publicada: https://tu-sitio.netlify.app/.netlify/functions",LOCAL_FUNCTIONS_URL_DEFAULT)||"");
    if(ingresada){setStorage(BASE_FUNCTIONS_URL_KEY,ingresada);return ingresada;}
    throw new Error("No se configuró la URL base de Netlify Functions.");
  }
  function obtenerBaseFunctionsPath(){
    if(esNetlifyDev())return BASE_FUNCTIONS_PATH;
    if(esArchivoLocal()||esHttpLocal())return obtenerBaseConfigurada()||pedirBaseFunctionsUrl();
    return BASE_FUNCTIONS_PATH;
  }
  function obtenerAdminToken(options){
    options=options||{};
    var desdeOptions=clean(options.adminToken);
    if(desdeOptions)return desdeOptions;
    var desdeParametro=clean(parametroUrl("taAdminToken","adminToken","tablaAdminToken"));
    if(desdeParametro){setStorage(ADMIN_TOKEN_KEY,desdeParametro);return desdeParametro;}
    var guardado=clean(getStorage(ADMIN_TOKEN_KEY));
    if(guardado)return guardado;
    var ingresado=clean(prompt("Ingrese el token administrativo para enviar Telegram.")||"");
    if(ingresado){setStorage(ADMIN_TOKEN_KEY,ingresado);return ingresado;}
    throw new Error("No se configuró el token administrativo.");
  }
  function endpoint(){return obtenerBaseFunctionsPath()+"/"+ENDPOINT_NAME;}
  async function leerJson(response){
    var raw=await response.text();
    if(!raw)return {};
    try{return JSON.parse(raw);}catch(error){return {ok:false,error:"La respuesta del servidor no tiene formato JSON válido."};}
  }
  async function llamar(action,payload,options){
    var response=await fetch(endpoint(),{
      method:"POST",
      headers:{"Content-Type":"application/json","x-ta-admin-token":obtenerAdminToken(options)},
      body:JSON.stringify({action:action,payload:payload||{}})
    });
    var data=await leerJson(response);
    if(!response.ok||data.ok===false)throw new Error(data.error||data.description||("Error HTTP "+response.status));
    return data;
  }
  function limpiarChatId(value){return clean(value).replace(/[^0-9-]/g,"");}
  async function enviarMensajeTelegram(chatId,mensaje,options){
    chatId=limpiarChatId(chatId);
    mensaje=cleanMessage(mensaje);
    if(!chatId)throw new Error("El estudiante no tiene chatId de Telegram para envío por bot.");
    if(!mensaje)throw new Error("El mensaje está vacío.");
    return llamar("enviarMensaje",{chatId:chatId,mensaje:mensaje},options);
  }
  async function enviarLoteTelegram(lista,options){
    var rows=Array.isArray(lista)?lista:[];
    var enviados=[],fallidos=[],omitidos=[];
    for(var i=0;i<rows.length;i++){
      var item=rows[i]||{};
      var chatId=limpiarChatId(item.telegramChatId||item.chatId||"");
      var mensaje=cleanMessage(item.mensaje||"");
      if(!chatId||!mensaje){omitidos.push(Object.assign({},item,{estado:"omitido",error:!chatId?"Sin chatId":"Mensaje vacío"}));continue;}
      try{
        var data=await enviarMensajeTelegram(chatId,mensaje,options);
        enviados.push(Object.assign({},item,{estado:"enviado",telegramMessageId:data.telegramMessageId||null}));
      }catch(error){
        fallidos.push(Object.assign({},item,{estado:"fallido",error:error&&error.message?error.message:String(error)}));
      }
    }
    return {ok:true,total:rows.length,enviados:enviados,fallidos:fallidos,omitidos:omitidos,resumen:{enviados:enviados.length,fallidos:fallidos.length,omitidos:omitidos.length}};
  }

  window.TablaTelegramApi={enviarMensajeTelegram:enviarMensajeTelegram,enviarLoteTelegram:enviarLoteTelegram,endpoint:endpoint,obtenerAdminToken:obtenerAdminToken};
})(window);
