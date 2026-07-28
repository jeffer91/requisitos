/* =========================================================
Nombre completo: maq-menu.js
Ruta o ubicación: /Maqueta/maq-menu.js
Función o funciones:
- Renderizar el menú superior fijo.
- Abrir Carga por defecto.
- Mostrar nombres completos y consistentes en cada módulo.
- Mantener una sola entrada Centro de datos.
========================================================= */
(function(window,document){
  "use strict";
  var DEFAULT_ORDER=[
    {tipo:"modulo",moduloId:"carga_excel",etiqueta:"Carga"},
    {tipo:"modulo",moduloId:"baselocal",etiqueta:"Centro de datos"},
    {tipo:"modulo",moduloId:"tabla_principal",etiqueta:"Tabla"},
    {tipo:"modulo",moduloId:"ficha_estudiante",etiqueta:"Ficha"},
    {tipo:"modulo",moduloId:"stat_main",etiqueta:"Estadísticas"},
    {tipo:"modulo",moduloId:"coordi",etiqueta:"Coordi"},
    {tipo:"modulo",moduloId:"global",etiqueta:"Global"},
    {tipo:"modulo",moduloId:"modulo_reporte",etiqueta:"Reportes"},
    {tipo:"modulo",moduloId:"defart",etiqueta:"Defensas"},
    {tipo:"modulo",moduloId:"ncomplex",etiqueta:"Ncomplex"},
    {tipo:"modulo",moduloId:"cr_def",etiqueta:"Cr-def"},
    {tipo:"modulo",moduloId:"titulacion",etiqueta:"InPVC"}
  ];
  var state={items:[],initial:"carga_excel",rendered:false,started:false,boundCore:false};
  var floating=null,owner=null;
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function getConfig(){return window.MAQ_CONFIG_SERVICE||{};}
  function getCore(){return window.MAQ_CORE||{};}
  function getRegistry(){return window.MAQ_MODULOS_REGISTRY||{};}
  function status(value){var node=document.getElementById("maq-status-text");if(node){node.textContent=value;}}
  function nav(){return document.getElementById("maq-main-menu");}
  function closeSub(){if(floating&&floating.parentNode){floating.parentNode.removeChild(floating);}floating=null;owner=null;}
  function positionSub(button){if(!floating||!button){return;}var rect=button.getBoundingClientRect();floating.style.left=Math.round(rect.left)+"px";floating.style.top=Math.round(rect.bottom+8)+"px";}
  function normalizeItems(items){return Array.isArray(items)&&items.length?items:clone(DEFAULT_ORDER);}
  function findMenuIdByModule(moduleId){var target=String(moduleId||"");function walk(items){for(var i=0;i<items.length;i+=1){var item=items[i];if(item.tipo==="modulo"&&item.moduloId===target){return "menu_"+target;}if(item.tipo==="grupo"){var found=walk(item.hijos||[]);if(found){return found;}}}return null;}return walk(state.items);}
  function activeByMenuId(id){document.querySelectorAll(".maq-menu-item").forEach(function(button){button.classList.toggle("maq-active",button.dataset.menuId===id);});}
  function moduleInfo(item){var registry=getRegistry();try{return registry&&typeof registry.buscarPorId==="function"?registry.buscarPorId(item&&item.moduloId):null;}catch(error){console.warn("[MAQ_MENU] No se pudo leer registro de módulo",error);return null;}}
  function navigate(moduleId,attempt){attempt=attempt||0;var core=getCore();if(core&&core.router&&typeof core.router.navegarPorModuloId==="function"){core.router.navegarPorModuloId(moduleId);return true;}if(attempt<20){setTimeout(function(){navigate(moduleId,attempt+1);},100);return false;}status("Módulo no pudo abrirse: "+moduleId);return false;}
  function openModule(item){if(!item||item.tipo!=="modulo"||!item.moduloId){return;}closeSub();activeByMenuId("menu_"+item.moduloId);navigate(item.moduloId,0);}
  function submenu(group,button){closeSub();var box=document.createElement("div");box.className="maq-submenu";(group.hijos||[]).forEach(function(child){var module=moduleInfo(child);var option=document.createElement("div");option.className="maq-submenu-item";option.innerHTML="<span>"+child.etiqueta+"</span>"+(module&&module.estado!=="activo"?'<span class="maq-submenu-pill">pendiente</span>':"");option.addEventListener("click",function(event){event.stopPropagation();openModule(child);});box.appendChild(option);});box.addEventListener("mouseleave",closeSub);document.body.appendChild(box);floating=box;owner=button;positionSub(button);}
  function menuButton(item){var button=document.createElement("button");button.type="button";button.className="maq-menu-item";button.textContent=item.etiqueta||item.moduloId||item.id;button.dataset.menuId=item.tipo==="grupo"?"grp_"+item.id:"menu_"+item.moduloId;var module=moduleInfo(item);if(module&&module.estado!=="activo"){button.classList.add("maq-pending");}if(item.tipo==="grupo"){button.classList.add("maq-menu-item-has-sub");button.addEventListener("mouseenter",function(){submenu(item,button);});button.addEventListener("click",function(event){event.stopPropagation();submenu(item,button);});}else{button.addEventListener("click",function(){openModule(item);});}return button;}
  function render(items){var container=nav();if(!container){return false;}state.items=normalizeItems(items);container.innerHTML="";state.items.forEach(function(item){container.appendChild(menuButton(item));});state.rendered=true;return true;}
  function bindCoreEvents(){var core=getCore();if(core&&core.bus&&typeof core.bus.on==="function"&&!state.boundCore){state.boundCore=true;core.bus.on("modulo:cambiado",function(payload){activeByMenuId(findMenuIdByModule(payload&&payload.moduloId));});}}
  function startDefault(){render(clone(DEFAULT_ORDER));bindCoreEvents();activeByMenuId("menu_"+state.initial);navigate(state.initial,0);}
  function init(){if(state.started){return;}state.started=true;state.initial="carga_excel";startDefault();var config=getConfig();if(!config||typeof config.obtenerConfigEfectiva!=="function"||typeof config.construirItemsMenu!=="function"){return;}config.obtenerConfigEfectiva().then(function(result){var items=normalizeItems(config.construirItemsMenu(result));state.initial=result&&result.moduloInicial||"carga_excel";render(items);bindCoreEvents();activeByMenuId("menu_"+state.initial);}).catch(function(error){console.warn("[MAQ_MENU] Configuración no disponible, se usa menú base",error);render(clone(DEFAULT_ORDER));});}
  document.addEventListener("click",closeSub);window.addEventListener("resize",function(){if(floating&&owner){positionSub(owner);}});
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
  window.MAQ_MENU={inicializarMenu:init,renderizarMenu:render,abrirModulo:openModule};
})(window,document);
