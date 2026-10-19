/* Defensas: avisos por WhatsApp personalizados, filtrados y manuales. */
(function(window,document){
 "use strict";
 var VERSION="1.0.0-filtered-manual",rows=[],selected=-1,focusBefore=null,busy=false;
 function el(id){return document.getElementById(id);}
 function txt(v){return String(v==null?"":v).replace(/\s+/g," ").trim();}
 function arr(v){return Array.isArray(v)?v:[];}
 function appState(){var a=window.DefartApp;return a&&typeof a.getState==="function"?a.getState():{};}
 function filters(s){s=s||{};return {
   periodId:s.periodId||"",division:s.division||"",career:s.career||"",
   sede:s.sede||"",status:s.status||"",search:s.search||"",
   sortKey:s.sortKey||"_nombre",sortDir:s.sortDir||"asc"
 };}
 var STATES=["Requisitos no cargados","Sin requisitos","Pendiente Art","Supletorio Art","Pendiente Def","Supletorio Def"];
 function eligible(r){return STATES.indexOf(txt(r&&r._estadoDefensa))>=0;}
 function issue(r){
   var st=txt(r&&r._estadoDefensa);
   if(st==="Sin requisitos"){
     var m=arr(r._missingRequirements).map(txt).filter(Boolean);
     return m.length?"Requisitos pendientes: "+m.slice(0,5).join(", ")+(m.length>5?" y otros.":"."):
       "Tiene requisitos de titulación pendientes de cumplimiento.";
   }
   if(st==="Requisitos no cargados")return "Los requisitos de titulación aún no constan cargados en el sistema.";
   if(st==="Pendiente Art")return "Está pendiente la calificación de su artículo académico.";
   if(st==="Supletorio Art")return "Su artículo académico requiere la evaluación supletoria correspondiente.";
   if(st==="Pendiente Def")return "Está pendiente el registro de la calificación de su defensa.";
   if(st==="Supletorio Def")return "Su defensa requiere la evaluación supletoria correspondiente.";
   return "";
 }
 function buildMessage(r){
   if(!eligible(r))return "";
   var name=txt(r._nombre||r.nombreCompleto||r.nombre);
   if(!name)return "";
   return [
     "Buen día, "+name+".","",
     "Le informo que su proceso de titulación aún no puede finalizar debido a la siguiente situación:","",
     issue(r),"",
     "Por favor, regularice su situación para continuar con el proceso.","",
     "Mgs. Jefferson Villarreal",
     "Coordinador de Titulación y Eficiencia Terminal","ITSQMET"
   ].join("\n");
 }
 function phone(r){
   var keys=["celular","Celular","telefonoMovil","TelefonoMovil","teléfono",
     "telefono","Telefono","móvil","movil","whatsapp","Whatsapp",
     "numeroCelular","numeroTelefono","telefonoEstudiante","telefonoPersonal"];
   var sources=[r,r&&r.contacto,r&&r.Contacto,r&&r.datosContacto,r&&r._contacto].filter(function(x){
     return x&&typeof x==="object"&&!Array.isArray(x);
   });
   for(var j=0;j<sources.length;j++)for(var i=0;i<keys.length;i++){
     var d=txt(sources[j][keys[i]]).replace(/\D/g,"");
     if(/^09\d{8}$/.test(d))return "593"+d.slice(1);
     if(/^5939\d{8}$/.test(d))return d;
     if(/^9\d{8}$/.test(d))return "593"+d;
     if(/^005939\d{8}$/.test(d))return d.slice(2);
   }
   return "";
 }
 function whatsappUrl(r,message){return "https://wa.me/"+phone(r)+"?text="+encodeURIComponent(message);}
 function notice(message){if(el("def-wa-notice"))el("def-wa-notice").textContent=message||"";}
 function select(i){
   if(i<0||i>=rows.length)return;
   selected=i;
   var r=rows[i],n=phone(r),message=buildMessage(r),link=el("def-wa-open");
   if(el("def-wa-selected"))el("def-wa-selected").textContent=txt(r._nombre);
   if(el("def-wa-selected-state"))el("def-wa-selected-state").textContent=txt(r._estadoDefensa);
   if(el("def-wa-message"))el("def-wa-message").value=message;
   if(link){
     link.href=whatsappUrl(r,message);
     link.textContent=n?"Abrir WhatsApp":"Elegir contacto en WhatsApp";
     link.setAttribute("aria-label","Abrir WhatsApp para "+txt(r._nombre));
   }
   if(el("def-wa-list"))Array.prototype.forEach.call(el("def-wa-list").querySelectorAll("[data-wa-index]"),function(b){
     var on=Number(b.getAttribute("data-wa-index"))===i;
     b.classList.toggle("is-active",on);b.setAttribute("aria-selected",String(on));
   });
   notice(n?"Se abrirá el chat sin enviar el mensaje.":"Sin celular válido: elija el contacto en WhatsApp o copie el mensaje.");
 }
 function show(found){
   var valid=arr(found);rows=valid.filter(function(r){return eligible(r)&&!!buildMessage(r);});
   selected=-1;
   var modal=el("def-wa-modal"),holder=el("def-wa-list");
   if(!modal||!holder)return;
   holder.textContent="";
   if(el("def-wa-summary"))el("def-wa-summary").textContent=rows.length+" estudiante(s) pendiente(s) de "+
     valid.length+" resultado(s) filtrado(s). No se incluyen los estados completos.";
   if(!rows.length){
     var empty=document.createElement("p");empty.textContent="No hay estudiantes con pendientes en estos filtros.";
     empty.className="def-wa-empty";holder.appendChild(empty);
     if(el("def-wa-selected"))el("def-wa-selected").textContent="Sin avisos pendientes";
     if(el("def-wa-selected-state"))el("def-wa-selected-state").textContent="";
     if(el("def-wa-message"))el("def-wa-message").value="";
     if(el("def-wa-copy"))el("def-wa-copy").disabled=true;
     if(el("def-wa-open")){el("def-wa-open").hidden=true;el("def-wa-open").removeAttribute("href");}
     notice("");
   }else{
     var frag=document.createDocumentFragment();
     rows.forEach(function(r,i){
       var b=document.createElement("button");b.type="button";b.className="def-wa-person";
       b.setAttribute("data-wa-index",String(i));b.setAttribute("role","option");
       var name=document.createElement("strong");name.textContent=txt(r._nombre);
       var status=document.createElement("small");status.textContent=txt(r._estadoDefensa);
       b.appendChild(name);b.appendChild(status);frag.appendChild(b);
     });
     holder.appendChild(frag);
     if(el("def-wa-copy"))el("def-wa-copy").disabled=false;
     if(el("def-wa-open"))el("def-wa-open").hidden=false;
     select(0);
   }
   focusBefore=document.activeElement;modal.hidden=false;modal.setAttribute("aria-hidden","false");
   if(el("def-wa-close"))el("def-wa-close").focus();
 }
 function close(){
   var m=el("def-wa-modal");if(m){m.hidden=true;m.setAttribute("aria-hidden","true");}
   if(focusBefore&&typeof focusBefore.focus==="function")focusBefore.focus();
 }
 function open(){
   if(busy)return;
   var s=appState(),bridge=window.DefartServiceBridge;
   if(!bridge||typeof bridge.getExportRows!=="function"){window.alert("No está disponible la consulta de Defensas.");return;}
   if(Object.keys(s.changes||{}).length){window.alert("Guarde primero los cambios de notas pendientes.");return;}
   if(s.data&&s.data.diagnostics&&s.data.diagnostics.ok===false){
     window.alert("Error de datos. Actualice Defensas e intente nuevamente.");return;
   }
   var o=filters(s),stamp=JSON.stringify(o),btn=el("def-btn-whatsapp");
   busy=true;if(btn){btn.disabled=true;btn.textContent="Preparando...";}
   Promise.resolve().then(function(){return bridge.getExportRows(o);}).then(function(data){
     if(JSON.stringify(filters(appState()))!==stamp){window.alert("Los filtros cambiaron. Inténtelo nuevamente.");return;}
     show(data);
   }).catch(function(err){window.alert("No se pudieron preparar los avisos: "+txt(err&&err.message||err));})
   .finally(function(){busy=false;if(btn){btn.disabled=false;btn.textContent="WhatsApp";}});
 }
 function copy(){
   var t=el("def-wa-message"),b=el("def-wa-copy");if(!t||!t.value)return;
   var task=window.navigator&&window.navigator.clipboard&&window.navigator.clipboard.writeText
     ?window.navigator.clipboard.writeText(t.value)
     :Promise.resolve().then(function(){t.focus();t.select();if(!document.execCommand||!document.execCommand("copy"))throw Error("Copia no disponible");});
   Promise.resolve(task).then(function(){
     if(b)b.textContent="Copiado";
     window.setTimeout(function(){if(b)b.textContent="Copiar mensaje";},1500);
   }).catch(function(){notice("No se pudo copiar. Seleccione el texto y cópielo manualmente.");});
 }
 function bind(){
   var btn=el("def-btn-whatsapp"),modal=el("def-wa-modal");if(!btn||!modal||btn.__boundWa)return;
   btn.__boundWa=true;btn.addEventListener("click",open);
   el("def-wa-close").addEventListener("click",close);
   el("def-wa-copy").addEventListener("click",copy);
   el("def-wa-list").addEventListener("click",function(event){
     var b=event.target.closest("[data-wa-index]");
     if(b)select(Number(b.getAttribute("data-wa-index")));
   });
   modal.addEventListener("click",function(event){if(event.target===modal)close();});
   document.addEventListener("keydown",function(event){if(event.key==="Escape"&&!modal.hidden){event.preventDefault();close();}});
 }
 window.DefartWhatsapp={version:VERSION,bind:bind,open:open,eligible:eligible,issue:issue,
   buildMessage:buildMessage,phone:phone,whatsappUrl:whatsappUrl};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);
 else bind();
})(window,document);
