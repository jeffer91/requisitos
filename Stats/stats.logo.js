/* Logo configurable y persistente para PDF de Estadísticas (sin cargar a servidores). */
(function(window,document){
"use strict";
var KEY="itsqmet:requisitos:stats:report-logo:v1";
var DEFAULT_LOGO="../Global/assets/branding/logo-instituto.png";
var MAX_FILE=5*1024*1024,MAX_DATA=900000,pending=null,bound=false,selectionRevision=0;
function el(id){return document.getElementById(id);}
function stored(){
  try{
    var raw=window.localStorage.getItem(KEY),obj=raw?JSON.parse(raw):null;
    if(obj&&typeof obj.dataUrl==="string"&&obj.dataUrl.length<MAX_DATA&&/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(obj.dataUrl)){return obj;}
  }catch(e){console.warn("[StatsLogo] No fue posible leer la imagen guardada.",e);}
  return null;
}
function getDataUrl(){var obj=stored();return obj?obj.dataUrl:null;}
function getPdfSource(){return getDataUrl()||DEFAULT_LOGO;}
function status(message,error){var node=el("stats-logo-message");if(node){node.textContent=message||"";node.classList.toggle("is-error",!!error);}}
function preview(src){
  var image=el("stats-logo-preview"),hint=el("stats-logo-hint");
  if(image){image.hidden=!src;if(src){image.src=src;}else{image.removeAttribute("src");}}
  if(hint){hint.hidden=!!src;}
}
function refreshButton(){var button=el("stats-logo-button");if(button){var has=!!getDataUrl();button.classList.toggle("is-set",has);button.title=has?"Cambiar logo guardado para los PDF":"Cargar logo para los PDF de Estadísticas";}}
function open(){
  var dialog=el("stats-logo-dialog");if(!dialog){return;}
  selectionRevision+=1;
  pending=null;var file=el("stats-logo-file"),save=el("stats-logo-save");
  if(file){file.value="";}if(save){save.disabled=true;}
  preview(getDataUrl());
  status(getDataUrl()?"Logo guardado en este equipo. Puedes reemplazarlo.":"Selecciona un PNG, JPG o WEBP (máximo 5 MB).",false);
  if(!dialog.open){dialog.showModal();}
}
function close(){selectionRevision+=1;pending=null;var dialog=el("stats-logo-dialog");if(dialog&&dialog.open){dialog.close();}}
function convert(file){
  return new Promise(function(resolve,reject){
    if(!file||["image/png","image/jpeg","image/webp"].indexOf(file.type)<0){reject(new Error("Selecciona un archivo PNG, JPG o WEBP."));return;}
    if(file.size>MAX_FILE){reject(new Error("La imagen no puede superar 5 MB."));return;}
    var url=URL.createObjectURL(file),image=new Image(),done=false;
    function cleanup(){if(!done){done=true;URL.revokeObjectURL(url);}}
    image.onload=function(){
      try{
        var w=image.naturalWidth,h=image.naturalHeight;if(!w||!h||w*h>50000000){throw new Error("La imagen no tiene dimensiones compatibles.");}
        var scale=Math.min(1,1400/w,650/h),canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
        var ctx=canvas.getContext("2d");if(!ctx){throw new Error("No se pudo procesar la imagen.");}
        ctx.fillStyle="#071a33";ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        var dataUrl=canvas.toDataURL("image/jpeg",.86);
        if(!/^data:image\/jpeg;base64,/.test(dataUrl)||dataUrl.length>=MAX_DATA){throw new Error("La imagen es demasiado grande después de procesarla.");}
        cleanup();resolve({dataUrl:dataUrl,filename:file.name,date:new Date().toISOString()});
      }catch(error){cleanup();reject(error);}
    };
    image.onerror=function(){cleanup();reject(new Error("No se pudo abrir la imagen."));};
    image.src=url;
  });
}
function onChoose(event){
  var file=event.target.files&&event.target.files[0],save=el("stats-logo-save");
  var revision=++selectionRevision;
  pending=null;if(save){save.disabled=true;}if(!file){return;}
  status("Preparando vista previa...",false);
  convert(file).then(function(value){
    if(revision!==selectionRevision){return;}
    pending=value;preview(value.dataUrl);
    status("Imagen lista: "+value.filename+". Haz clic en Guardar logo.",false);
    if(save){save.disabled=false;}
  }).catch(function(error){if(revision===selectionRevision){status(error.message||String(error),true);}});
}
function save(){
  if(!pending){status("Selecciona una imagen antes de guardar.",true);return;}
  try{
    window.localStorage.setItem(KEY,JSON.stringify(pending));
    if(!stored()){throw new Error("El almacenamiento no confirmó el cambio.");}
    pending=null;refreshButton();close();
  }catch(error){status("No se pudo guardar en este equipo: "+(error.message||String(error)),true);}
}
function install(){
  if(bound){return;}bound=true;
  var button=el("stats-logo-button"),file=el("stats-logo-file"),select=el("stats-logo-select"),saveButton=el("stats-logo-save");
  if(button){button.addEventListener("click",open);}
  if(select&&file){select.addEventListener("click",function(){file.click();});file.addEventListener("change",onChoose);}
  if(saveButton){saveButton.addEventListener("click",save);}
  ["stats-logo-close","stats-logo-cancel"].forEach(function(id){var node=el(id);if(node){node.addEventListener("click",close);}});
  refreshButton();
}
window.StatsLogo={getDataUrl:getDataUrl,getPdfSource:getPdfSource,open:open,install:install};
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",install);}else{install();}
})(window,document);
