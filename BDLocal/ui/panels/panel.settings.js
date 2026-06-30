/* =========================================================
Nombre completo: panel.settings.js
Ruta: /BDLocal/ui/panels/panel.settings.js
Función:
- Renderizar ajustes reales de bases.
- Permitir activar, pausar, guardar y probar cada conexión.
- Guardar ajustes en localStorage y BDLocal/app_config cuando está disponible.
========================================================= */
(function(window, document){
  "use strict";

  var IDS = ["bdlocal", "firebase", "supabase", "excel", "googleSheets"];
  var LABELS = { bdlocal:"BL / BDLocal", firebase:"Firebase", supabase:"Supabase", excel:"Excel", googleSheets:"Google Sheets" };

  function esc(value){ return String(value == null ? "" : value).replace(/[&<>\"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];}); }
  function api(){ return window.BDLConnSettings; }
  function get(id){ return api() ? api().get(id) : { id:id, enabled:false }; }
  function configured(id){ return api() ? api().isConfigured(id) : false; }

  function statusText(id, s){
    s = s || get(id);
    if(id === "bdlocal"){ return "Siempre activo"; }
    if(!s.enabled){ return "Pausado"; }
    if(configured(id)){ return "Configurado"; }
    return "Activo, falta configuración";
  }

  function field(id, key, label, placeholder){
    var s = get(id);
    var value = s[key] || "";
    return '<label class="bl-setting-field"><span>'+esc(label)+'</span><input data-conn-input="'+esc(id)+'" data-key="'+esc(key)+'" type="text" value="'+esc(value)+'" placeholder="'+esc(placeholder || "")+'"></label>';
  }

  function card(id){
    var s = get(id);
    var checked = s.enabled ? "checked" : "";
    var locked = id === "bdlocal" ? "disabled checked" : checked;
    var fields = "";
    if(id === "firebase"){
      fields = field(id,"projectId","Project ID","utet-4387a") + field(id,"apiKey","API key","") + field(id,"authDomain","Auth domain","") + field(id,"appId","App ID","");
    }else if(id === "supabase"){
      fields = field(id,"url","URL del proyecto","https://xxxxx.supabase.co") + field(id,"anonKey","Anon key","");
    }else if(id === "excel"){
      fields = field(id,"filePrefix","Prefijo del archivo","requisitos_cierre_dia") + field(id,"folderName","Referencia/carpeta","Ejemplo: Respaldos Requisitos");
    }else if(id === "googleSheets"){
      fields = field(id,"sheetId","Sheet ID","ID de la hoja") + field(id,"webAppUrl","Apps Script Web App URL","https://script.google.com/macros/s/...");
    }else{
      fields = '<div class="bl-panel-note">BL es la base local principal. No se puede pausar desde aquí.</div>';
    }
    return '<article class="bl-setting-card" data-conn-card="'+esc(id)+'">'
      + '<div class="bl-setting-head"><div><h3>'+esc(LABELS[id] || id)+'</h3><p>'+esc(statusText(id,s))+'</p></div>'
      + '<label class="bl-switch"><input data-conn-enabled="'+esc(id)+'" type="checkbox" '+locked+'><span>Activo</span></label></div>'
      + '<div class="bl-setting-fields">'+fields+'</div>'
      + '<div class="bl-continuity-actions"><button class="bl-btn primary" type="button" data-conn-save="'+esc(id)+'">Guardar</button><button class="bl-btn light" type="button" data-conn-test="'+esc(id)+'">Probar</button><button class="bl-btn light" type="button" data-conn-pause="'+esc(id)+'" '+(id === "bdlocal" ? "disabled" : "")+'>Pausar</button></div>'
      + '<pre class="bl-setting-output" id="blSettingOut_'+esc(id)+'">Sin cambios.</pre>'
      + '</article>';
  }

  function collect(id){
    var current = get(id);
    var enabledNode = document.querySelector('[data-conn-enabled="'+id+'"]');
    var data = Object.assign({}, current);
    data.enabled = id === "bdlocal" ? true : !!(enabledNode && enabledNode.checked);
    Array.prototype.slice.call(document.querySelectorAll('[data-conn-input="'+id+'"]')).forEach(function(input){ data[input.getAttribute("data-key")] = input.value.trim(); });
    return data;
  }

  function output(id, value){
    var box = document.getElementById("blSettingOut_" + id);
    if(!box){ return; }
    try{ box.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); }catch(error){ box.textContent = String(value); }
  }

  function save(id){
    if(!api()){ output(id,{ ok:false, error:"BDLConnSettings no está disponible" }); return; }
    var saved = api().save(id, collect(id));
    render();
    output(id,{ ok:true, guardado:api().publicView(id) });
    if(window.BLToast){ window.BLToast.show("Ajustes", LABELS[id] + " guardado."); }
    if(window.BLPanelStatus){ window.BLPanelStatus.check(); }
    return saved;
  }

  function pause(id){
    if(id === "bdlocal"){ return; }
    if(!api()){ output(id,{ ok:false, error:"BDLConnSettings no está disponible" }); return; }
    api().setEnabled(id, false);
    render();
    output(id,{ ok:true, estado:"pausado" });
    if(window.BLToast){ window.BLToast.show("Ajustes", LABELS[id] + " pausado."); }
    if(window.BLPanelStatus){ window.BLPanelStatus.check(); }
  }

  function test(id){
    output(id,"Probando conexión...");
    var registry = window.BDLConnRegistry;
    var conn = registry && registry.get ? registry.get(id) : null;
    if(!conn || typeof conn.health !== "function"){ output(id,{ ok:false, error:"Conector no disponible" }); return; }
    Promise.resolve().then(function(){ return conn.health(); }).then(function(result){ output(id,result); if(window.BLPanelStatus){ window.BLPanelStatus.check(); } }).catch(function(error){ output(id,{ ok:false, error:error && error.message ? error.message : String(error) }); });
  }

  function bind(){
    Array.prototype.slice.call(document.querySelectorAll("[data-conn-save]")).forEach(function(btn){ btn.onclick = function(){ save(btn.getAttribute("data-conn-save")); }; });
    Array.prototype.slice.call(document.querySelectorAll("[data-conn-test]")).forEach(function(btn){ btn.onclick = function(){ test(btn.getAttribute("data-conn-test")); }; });
    Array.prototype.slice.call(document.querySelectorAll("[data-conn-pause]")).forEach(function(btn){ btn.onclick = function(){ pause(btn.getAttribute("data-conn-pause")); }; });
  }

  function render(){
    var box = document.getElementById("blSettingsSummary");
    if(!box){ return; }
    box.className = "bl-settings-grid";
    box.innerHTML = IDS.map(card).join("");
    bind();
  }

  window.addEventListener("bdlocal:connection-settings-changed", function(){ if(window.BLPanelStatus){ window.BLPanelStatus.check(); } });
  window.BLPanelSettings = { render: render, save: save, test: test, pause: pause };
})(window, document);