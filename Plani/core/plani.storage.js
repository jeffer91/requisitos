/* =========================================================
Nombre completo: plani.storage.js
Ruta o ubicación: /Requisitos/Plani/core/plani.storage.js
Función o funciones:
- Encapsular lectura y escritura local del módulo Plani.
- Guardar borradores por período y tipo de documento.
- Evitar acceso directo repetido a localStorage desde otros archivos.
Con qué se conecta:
- plani.constants.js
- plani.state.js
- ../frontend/plani.app.js
========================================================= */
(function(window){
  "use strict";

  var memory = {};

  function constants(){return window.PlaniConstants || {};}
  function text(value){return String(value == null ? "" : value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){return JSON.parse(JSON.stringify(value == null ? null : value));}

  function keys(){
    var cfg = constants();
    return cfg.STORAGE_KEYS || {root:"requisitos.plani.v1", draft:"requisitos.plani.draft.v1"};
  }

  function canUseLocalStorage(){
    try{
      var k = "__plani_storage_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    }catch(error){
      return false;
    }
  }

  function safeParse(raw, fallback){
    try{return raw ? JSON.parse(raw) : fallback;}catch(error){return fallback;}
  }

  function readRaw(key){
    if(canUseLocalStorage()){
      return localStorage.getItem(key);
    }
    return memory[key] || "";
  }

  function writeRaw(key, value){
    if(canUseLocalStorage()){
      localStorage.setItem(key, value);
      return true;
    }
    memory[key] = value;
    return true;
  }

  function removeRaw(key){
    if(canUseLocalStorage()){
      localStorage.removeItem(key);
      return true;
    }
    delete memory[key];
    return true;
  }

  function readRoot(){
    return safeParse(readRaw(keys().root), {version:1, drafts:{}, updatedAt:null});
  }

  function writeRoot(root){
    root = root || {version:1, drafts:{}};
    root.version = root.version || 1;
    root.updatedAt = now();
    writeRaw(keys().root, JSON.stringify(root));
    return clone(root);
  }

  function draftKey(periodId, documentType){
    return [text(periodId || "SIN_PERIODO"), text(documentType || "SIN_DOCUMENTO")].join("::");
  }

  function readDraft(periodId, documentType){
    var root = readRoot();
    var key = draftKey(periodId, documentType);
    return clone((root.drafts || {})[key] || null);
  }

  function writeDraft(periodId, documentType, data){
    var root = readRoot();
    var key = draftKey(periodId, documentType);
    root.drafts = root.drafts || {};
    root.drafts[key] = Object.assign({}, clone(data || {}), {savedAt:now()});
    writeRoot(root);
    return clone(root.drafts[key]);
  }

  function clearDraft(periodId, documentType){
    var root = readRoot();
    var key = draftKey(periodId, documentType);
    root.drafts = root.drafts || {};
    delete root.drafts[key];
    writeRoot(root);
    return true;
  }

  function clearAll(){
    removeRaw(keys().root);
    return true;
  }

  window.PlaniStorage = {
    readRoot:readRoot,
    writeRoot:writeRoot,
    readDraft:readDraft,
    writeDraft:writeDraft,
    clearDraft:clearDraft,
    clearAll:clearAll,
    draftKey:draftKey,
    canUseLocalStorage:canUseLocalStorage
  };
})(window);
