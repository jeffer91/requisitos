/* =========================================================
Nombre completo: maq-menu.js
Ruta o ubicación: /Requisitos/Maqueta/maq-menu.js
Función o funciones:
- Renderizar menú superior fijo.
- Manejar desplegable de Títulos.
- Abrir por defecto Carga.
- Mantener BL como centro de control de BDLocal y Firebase.
- Mostrar Ncomplex como pantalla independiente de notas.
- Mostrar Sacar N como pantalla independiente del menú principal.
Con qué se conecta:
- maq-config-service.js
- maq-core.js
- maq-modulos-registry.js
========================================================= */
(function(window,document){
  "use strict";
  var DEFAULT_ORDER=[
    {tipo:"modulo",moduloId:"carga_excel",etiqueta:"Carga"},
    {tipo:"modulo",moduloId:"baselocal",etiqueta:"BL"},
    {tipo:"modulo",moduloId:"tabla_principal",etiqueta:"tabla"},
    {tipo:"modulo",moduloId:"ficha_estudiante",etiqueta:"Ficha"},
    {tipo:"modulo",moduloId:"stat_main",etiqueta:"Stats"},
    {tipo:"modulo",moduloId:"coordi",etiqueta:"Coordi"},
    {tipo:"modulo",moduloId:"global",etiqueta:"Global"},
    {tipo:"modulo",moduloId:"modulo_reporte",etiqueta:"Repor"},
    {tipo:"modulo",moduloId:"defart",etiqueta:"Defensas"},
    {tipo:"modulo",moduloId:"ncomplex",etiqueta:"Ncomplex"},
    {tipo:"modulo",moduloId:"sacar_n",etiqueta:"Sacar N"},
    {tipo:"grupo",id:"titulos",etiqueta:"Titulos",hijos:[
      {tipo:"modulo",moduloId:"titulos_estudiante",etiqueta:"Estudiante"},
      {tipo:"modulo",moduloId:"titulos_admin",etiqueta:"Administrador"},
      {tipo:"modulo",moduloId:"titulos_coordinador",etiqueta:"Coordinador"}
    ]},
    {tipo:"modulo",moduloId:"titulacion",etiqueta:"Infor"}
  ];
  var state={items:[],initial:"carga_excel",rendered:false,started:false};var floating=null;var owner=null;
  function clone(value){return JSON.parse(JSON.stringify(value));}function getConfig(){return window.MAQ_CONFIG_SERVICE||{};}function getCore(){return window.MAQ_CORE||{};}function getRegistry(){return window.MAQ_MODULOS_REGISTRY||{};}function status(text){var el=document.getElementById("maq-status-text");if(el)el.textContent=text;}function nav(){return document.getElementById("maq-main-menu");}function closeSub(){if(floating&&floating.parentNode)floating.parentNode.removeChild(floating);floating=null;owner=null;}function posSub(btn){if(!floating||!btn)return;var r=btn.getBoundingClientRect();floating.style.left=Math.round(r.left)+"px";floating.style.top=Math.round(r.bottom+8)+"px";}
  function normalizeItems(items){return Array.isArray(items)&&items.length?items:clone(DEFAULT_ORDER);}function findMenuIdByModule(moduleId){var target=String(moduleId||"");function walk(items){for(var i=0;i<items.length;i++){var it=items[i];if(it.tipo==="modulo"&&it.moduloId===target)return "menu_"+target;if(it.tipo==="grupo"){var found=walk(it.hijos||[]);if(found)return found;}}return null;}return walk(state.items);}function activeByMenuId(id){document.querySelectorAll(".maq-menu-item").forEach(function(btn){btn.classList.toggle("maq-active",btn.dataset.menuId===id);});}
  function moduleInfo(item){var registry=getRegistry();try{if(registry&&typeof registry.buscarPorId==="function")return registry.buscarPorId(item&&item.moduloId);}catch(error){console.warn("[MAQ_MENU] No se pudo leer registro de módulo",error);}return null;}function navigate(moduleId, attempt){attempt=attempt||0;var core=getCore();if(core&&core.router&&typeof core.router.navegarPorModuloId==="function"){core.router.navegarPorModuloId(moduleId);return true;}if(attempt<20){setTimeout(function(){navigate(moduleId,attempt+1);},100);return false;}status("Módulo no pudo abrirse: "+moduleId);return false;}function openModule(item){if(!item||item.tipo!=="modulo"||!item.moduloId)return;closeSub();activeByMenuId("menu_"+item.moduloId);navigate(item.moduloId,0);}function submenu(group,btn){closeSub();var box=document.createElement("div");box.className="maq-submenu";(group.hijos||[]).forEach(function(child){var mod=moduleInfo(child);var opt=document.createElement("div");opt.className="maq-submenu-item";opt.innerHTML='<span>'+child.etiqueta+'</span>'+(mod&&mod.estado!=="activo"?'<span class="maq-submenu-pill">pendiente</span>':'');opt.addEventListener("click",function(ev){ev.stopPropagation();openModule(child);});box.appendChild(opt);});box.addEventListener("mouseleave",closeSub);document.body.appendChild(box);floating=box;owner=btn;posSub(btn);}function button(item){var btn=document.createElement("button");btn.type="button";btn.className="maq-menu-item";btn.textContent=item.etiqueta||item.moduloId||item.id;btn.dataset.menuId=item.tipo==="grupo"?"grp_"+item.id:"menu_"+item.moduloId;var mod=moduleInfo(item);if(mod&&mod.estado!=="activo")btn.classList.add("maq-pending");if(item.tipo==="grupo"){btn.classList.add("maq-menu-item-has-sub");btn.addEventListener("mouseenter",function(){submenu(item,btn);});btn.addEventListener("click",function(ev){ev.stopPropagation();submenu(item,btn);});}else{btn.addEventListener("click",function(){openModule(item);});}return btn;}
  function render(items){var navEl=nav();if(!navEl)return false;state.items=normalizeItems(items);navEl.innerHTML="";state.items.forEach(function(item){navEl.appendChild(button(item));});state.rendered=true;return true;}function bindCoreEvents(){var core=getCore();if(core&&core.bus&&typeof core.bus.on==="function"&&!state.boundCore){state.boundCore=true;core.bus.on("modulo:cambiado",function(payload){activeByMenuId(findMenuIdByModule(payload&&payload.moduloId));});}}function startDefault(){render(clone(DEFAULT_ORDER));bindCoreEvents();activeByMenuId("menu_"+state.initial);navigate(state.initial,0);}function init(){if(state.started)return;state.started=true;state.initial="carga_excel";startDefault();var config=getConfig();if(!config||typeof config.obtenerConfigEfectiva!=="function"||typeof config.construirItemsMenu!=="function"){return;}config.obtenerConfigEfectiva().then(function(cfg){var items=normalizeItems(config.construirItemsMenu(cfg));state.initial=(cfg&&cfg.moduloInicial)||"carga_excel";render(items);bindCoreEvents();activeByMenuId("menu_"+state.initial);}).catch(function(error){console.warn("[MAQ_MENU] Configuración no disponible, se usa menú base",error);render(clone(DEFAULT_ORDER));});}
  document.addEventListener("click",closeSub);window.addEventListener("resize",function(){if(floating&&owner)posSub(owner);});if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();window.MAQ_MENU={inicializarMenu:init,renderizarMenu:render,abrirModulo:openModule};
})(window,document);