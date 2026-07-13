/* =========================================================
Nombre completo: maq-utils.js
Ruta o ubicación: /Requisitos/Maqueta/maq-utils.js
Función o funciones:
- Centralizar utilidades de texto, estado y rutas.
- Guardar memoria rápida de navegación interna de Maqueta.
Con qué se conecta:
- maq-core.js
- maq-menu.js
========================================================= */
(function(window){
  "use strict";
  var NAV_KEYS={ultimoModuloId:"REQ_MAQ_ULTIMO_MODULO",anteriorModuloId:"REQ_MAQ_ANTERIOR_MODULO",historial:"REQ_MAQ_HISTORIAL",estadoPorModulo:"REQ_MAQ_ESTADO_MODULOS"};
  function text(v){return String(v==null?"":v).trim();}
  function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){console.warn("[MAQ_UTILS] No se pudo guardar",key,e);}}
  function read(key,fallback){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(e){return fallback;}}
  function esc(v){return text(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function status(msg){var el=document.getElementById("maq-status-text");if(el)el.textContent=text(msg)||"Listo";}
  function memory(msg){var el=document.getElementById("maq-memory-text");if(el)el.textContent=text(msg)||"Memoria activa";}
  function buildPendingUrl(moduleItem){var name=encodeURIComponent(text(moduleItem&&moduleItem.nombre)||"Módulo");var id=encodeURIComponent(text(moduleItem&&moduleItem.id)||"");var path=encodeURIComponent(text(moduleItem&&moduleItem.ruta)||"");return "maq-pendiente.html?name="+name+"&id="+id+"&path="+path;}
  function saveNavState(state){save(NAV_KEYS.historial,Object.assign({actualizadoEn:new Date().toISOString()},state||{}));}
  function readNavState(){return read(NAV_KEYS.historial,null);}
  window.MAQ_UTILS={NAV_KEYS:NAV_KEYS,text:text,save:save,read:read,esc:esc,escapeHtml:esc,status:status,memory:memory,buildPendingUrl:buildPendingUrl,saveNavState:saveNavState,readNavState:readNavState};
})(window);
