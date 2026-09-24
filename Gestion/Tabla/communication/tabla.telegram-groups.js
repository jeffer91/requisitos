/* =========================================================
Nombre completo: tabla.telegram-groups.js
Ruta: /Gestion/Tabla/communication/tabla.telegram-groups.js
Función:
- Mostrar en un popup los grupos de Telegram configurados por carrera y período.
- Priorizar la carrera actualmente filtrada en Tabla.
- Permitir abrir o copiar cada enlace.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0-apr-sep-2026-groups";
  var U = window.TablaUtils || {};

  var GROUPS = [
    {career:"Administración de Empresas", short:"Administración-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+DOjMPnHIfQ84ZjA5"},
    {career:"Contabilidad", short:"Contabilidad-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+0GqaC_5_4pE5Nzlh"},
    {career:"Desarrollo de Software", short:"Software-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+0ZCQ3X8nGQtlYzkx"},
    {career:"Diseño Multimedia", short:"Multimedia-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+Y-XN4akZ3zIzMTJh"},
    {career:"Educación Básica", short:"Básica-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+7GYfY8VrC6A1Yjdh"},
    {career:"Educación Inicial", short:"Inicial-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+2m0JpNoTe3UwMGZh"},
    {career:"Enfermería", short:"Enfermería-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+nIs3soXW1SExYzJh"},
    {career:"Estética Integral", short:"Estética-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+UMJXHH7FUtE2ZDlh"},
    {career:"Gestión del Talento Humano", short:"Talento-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+cfH1JJv7KaY0NDVh"},
    {career:"Marketing Digital y Comercio Electrónico", short:"MKT-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+CWrgFTkP8Ew4MDUx"},
    {career:"Mecánica Automotriz", short:"Mecánica-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+kHCHbl4e8L1hOTEx"},
    {career:"Procesamiento en Alimentos", short:"Alimentos-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+IfUV2HtlJ_BkMWJh"},
    {career:"Redes y Telecomunicaciones", short:"Redes-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+1IheiY8p2p85ODIx"},
    {career:"Seguridad Ciudadana y Orden Público Online", short:"Seguridad-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+Arnz3hESy0JhNWFh"},
    {career:"Seguridad y Prevención de Riesgos Laborales", short:"Riesgos-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+MkvUebnRxjQxMDgx"},
    {career:"Ventas Online", short:"Ventas-Abr-2026-Sept-2026", periodId:"2026-04__2026-09", url:"https://t.me/+tIVfnxG2uO43ZWQx"}
  ];

  function el(id){
    return document.getElementById(id);
  }

  function text(value){
    return U.text
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function key(value){
    return U.normalizeKey
      ? U.normalizeKey(value)
      : text(value)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "");
  }

  function samePeriod(a, b){
    if(!b){ return true; }
    if(U.samePeriod){ return U.samePeriod(a, b); }
    return key(a) === key(b);
  }

  function appState(){
    try{
      if(window.TablaApp && typeof window.TablaApp.getState === "function"){
        return window.TablaApp.getState() || {};
      }
    }catch(error){}
    return {};
  }

  function visibleGroups(){
    var current = appState();
    var periodId = text(current.periodId);
    var career = key(current.career);

    var list = GROUPS.filter(function(item){
      return !periodId || samePeriod(item.periodId, periodId);
    });

    if(career){
      list.sort(function(a, b){
        var am = key(a.career) === career ? 0 : 1;
        var bm = key(b.career) === career ? 0 : 1;
        if(am !== bm){ return am - bm; }
        return a.career.localeCompare(b.career, "es", {sensitivity:"base"});
      });
    }else{
      list.sort(function(a, b){
        return a.career.localeCompare(b.career, "es", {sensitivity:"base"});
      });
    }

    return list;
  }

  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function render(){
    var listBox = el("tabla-telegram-groups-list");
    var search = el("tabla-telegram-groups-search");
    var meta = el("tabla-telegram-groups-meta");

    if(!listBox){ return false; }

    var current = appState();
    var q = key(search && search.value);
    var currentCareer = key(current.career);
    var groups = visibleGroups().filter(function(item){
      return !q || key(item.career + " " + item.short).indexOf(q) >= 0;
    });

    if(meta){
      meta.textContent = current.periodId
        ? (
            (current.periodLabel || current.periodId) +
            (current.career ? " · " + current.career : "")
          )
        : "Grupos configurados";
    }

    if(!groups.length){
      listBox.innerHTML =
        '<div class="empty">No hay grupos configurados para los filtros actuales.</div>';
      return true;
    }

    listBox.innerHTML = groups.map(function(item){
      var featured = currentCareer && key(item.career) === currentCareer;
      return (
        '<article class="tabla-telegram-group' + (featured ? ' is-featured' : '') + '">' +
          '<div class="tabla-telegram-group-main">' +
            '<strong>' + esc(item.career) + '</strong>' +
            '<small>' + esc(item.short) + '</small>' +
          '</div>' +
          '<div class="tabla-telegram-group-actions">' +
            '<button type="button" data-tg-group-open="' + esc(item.url) + '">Abrir</button>' +
            '<button type="button" data-tg-group-copy="' + esc(item.url) + '">Copiar</button>' +
          '</div>' +
        '</article>'
      );
    }).join("");

    return true;
  }

  function open(){
    var modal = el("tabla-telegram-groups-modal");
    if(!modal){ return false; }

    var search = el("tabla-telegram-groups-search");
    if(search){ search.value = ""; }

    render();
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");

    if(search){
      window.setTimeout(function(){
        try{ search.focus(); }catch(error){}
      }, 0);
    }

    return true;
  }

  function close(){
    var modal = el("tabla-telegram-groups-modal");
    if(!modal){ return false; }
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    return true;
  }

  function openUrl(url){
    url = text(url);
    if(!url){ return false; }

    if(U.openWindow){
      return !!U.openWindow(url);
    }

    return !!window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyUrl(url){
    url = text(url);
    if(!url){ return false; }

    try{
      if(U.copyText){
        await U.copyText(url);
      }else if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(url);
      }else{
        throw new Error("Portapapeles no disponible.");
      }

      if(
        window.TablaRenderSummary &&
        typeof window.TablaRenderSummary.status === "function"
      ){
        window.TablaRenderSummary.status("Enlace de Telegram copiado.", "ok");
      }
      return true;
    }catch(error){
      return false;
    }
  }

  function bind(){
    var openButton = el("tabla-telegram-groups-open");
    var closeButton = el("tabla-telegram-groups-close");
    var cancelButton = el("tabla-telegram-groups-cancel");
    var search = el("tabla-telegram-groups-search");
    var modal = el("tabla-telegram-groups-modal");
    var list = el("tabla-telegram-groups-list");

    if(openButton && openButton.getAttribute("data-bound") !== "1"){
      openButton.setAttribute("data-bound", "1");
      openButton.addEventListener("click", open);
    }

    [closeButton, cancelButton].forEach(function(button){
      if(button && button.getAttribute("data-bound") !== "1"){
        button.setAttribute("data-bound", "1");
        button.addEventListener("click", close);
      }
    });

    if(search && search.getAttribute("data-bound") !== "1"){
      search.setAttribute("data-bound", "1");
      search.addEventListener("input", render);
    }

    if(list && list.getAttribute("data-bound") !== "1"){
      list.setAttribute("data-bound", "1");
      list.addEventListener("click", function(event){
        var openNode = event.target.closest("[data-tg-group-open]");
        var copyNode = event.target.closest("[data-tg-group-copy]");

        if(openNode){
          openUrl(openNode.getAttribute("data-tg-group-open"));
        }else if(copyNode){
          copyUrl(copyNode.getAttribute("data-tg-group-copy"));
        }
      });
    }

    if(modal && modal.getAttribute("data-bound") !== "1"){
      modal.setAttribute("data-bound", "1");
      modal.addEventListener("click", function(event){
        if(event.target === modal){ close(); }
      });
    }

    document.addEventListener("keydown", function(event){
      if(event.key === "Escape" && modal && !modal.hidden){
        close();
      }
    });
  }

  function boot(){
    bind();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.TablaTelegramGroups = {
    version: VERSION,
    groups: GROUPS.slice(),
    open: open,
    close: close,
    render: render,
    visibleGroups: visibleGroups
  };
})(window, document);
