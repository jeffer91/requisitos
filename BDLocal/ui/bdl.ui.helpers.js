(function(window, document){
  "use strict";

  function one(selector, root){ return (root || document).querySelector(selector); }
  function all(selector, root){ return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function text(value){ return String(value == null ? "" : value); }
  function esc(value){ return text(value).replace(/[&<>'"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]; }); }
  function html(el, content){ if(el){ el.innerHTML = content || ""; } }
  function val(selector){ var el = typeof selector === "string" ? one(selector) : selector; return el ? el.value : ""; }
  function on(selector, event, handler){ var el = typeof selector === "string" ? one(selector) : selector; if(el){ el.addEventListener(event, handler); } }
  function badge(value){
    var v = text(value || "INCOMPLETO");
    var cls = v === "CUMPLE" || v === "ACTIVO" ? "ok" : (v === "NO CUMPLE" || v === "RETIRADO" ? "bad" : "warn");
    return '<span class="bdl-badge '+cls+'">'+esc(v)+'</span>';
  }
  function notify(message, type){
    var el = one("#bdlStatus");
    if(el){ el.textContent = message || ""; el.className = type === "error" ? "bdl-error" : "bdl-muted"; }
  }

  window.BDLUIH = { one:one, all:all, text:text, esc:esc, html:html, val:val, on:on, badge:badge, notify:notify };
})(window, document);
