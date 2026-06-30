(function(window, document){
  "use strict";

  var S = window.BDLSyncConfig;
  if(!S){ throw new Error("BDLSyncConfig debe cargarse antes de BDLSyncFirebase."); }

  var loading = null;
  var DEFAULT_CONFIG = {
    apiKey: "AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA",
    authDomain: "utet-4387a.firebaseapp.com",
    projectId: "utet-4387a",
    storageBucket: "utet-4387a.firebasestorage.app",
    messagingSenderId: "902848131454",
    appId: "1:902848131454:web:47f515eb6480834724c32f"
  };

  function scriptUrl(relative){ try{ return new URL(relative, document.currentScript ? document.currentScript.src : window.location.href).href; }catch(error){ return relative; } }
  function loadScript(url){
    return new Promise(function(resolve, reject){
      var existing = document.querySelector('script[src="' + url + '"]');
      if(existing && existing.dataset.ready === "true"){ resolve(); return; }
      if(existing){ existing.addEventListener("load", resolve); existing.addEventListener("error", function(){ reject(new Error("No se pudo cargar " + url)); }); return; }
      var script = document.createElement("script");
      script.src = url; script.async = false;
      script.onload = function(){ script.dataset.ready = "true"; resolve(); };
      script.onerror = function(){ reject(new Error("No se pudo cargar " + url)); };
      document.head.appendChild(script);
    });
  }
  function loadOptional(urls){
    var chain = Promise.resolve(false);
    urls.forEach(function(url){ chain = chain.then(function(done){ return done ? true : loadScript(url).then(function(){ return true; }).catch(function(){ return false; }); }); });
    return chain;
  }
  function readStoredConfig(){
    if(window.BDLConnSettings){
      var cfg = window.BDLConnSettings.get("firebase");
      if(cfg && cfg.enabled === false){ return { paused:true }; }
      if(cfg && (cfg.apiKey || cfg.projectId)){ return cfg; }
    }
    try{ var raw = window.localStorage.getItem("REQ_FIREBASE_CONFIG_V1") || window.localStorage.getItem("FIREBASE_CONFIG") || ""; return raw ? JSON.parse(raw) : null; }catch(error){ return null; }
  }
  function getConfig(){
    var stored = readStoredConfig();
    if(stored && stored.paused){ return stored; }
    return window.firebaseConfig || window.FIREBASE_CONFIG || stored || DEFAULT_CONFIG;
  }
  function initFromConfig(){
    if(!window.firebase){ return false; }
    if(window.firebase.apps && window.firebase.apps.length){ return true; }
    var cfg = getConfig();
    if(cfg && cfg.paused){ throw new Error("Firebase está pausado en Ajustes."); }
    if(cfg && cfg.apiKey && cfg.projectId){ window.firebase.initializeApp(cfg); return true; }
    return false;
  }
  function safeFirestore(){
    var cfg = getConfig();
    if(cfg && cfg.paused){ throw new Error("Firebase está pausado en Ajustes."); }
    if(window.db && typeof window.db.collection === "function"){ return window.db; }
    if(!window.firebase || typeof window.firebase.firestore !== "function"){ throw new Error("Firebase Firestore no está disponible."); }
    if(!initFromConfig()){ throw new Error("Firebase no está inicializado. Revise firebase-config.js."); }
    window.db = window.firebase.firestore();
    return window.db;
  }
  function ensureFirebase(){
    var cfg = getConfig();
    if(cfg && cfg.paused){ return Promise.reject(new Error("Firebase está pausado en Ajustes.")); }
    try{ return Promise.resolve(safeFirestore()); }catch(firstError){}
    if(loading){ return loading; }
    loading = loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js")
      .then(function(){ return loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"); })
      .then(function(){ return loadOptional([scriptUrl("../../firebase-config.js"), scriptUrl("../firebase-config.js"), scriptUrl("firebase-config.js")]); })
      .then(function(){ return safeFirestore(); });
    return loading;
  }
  function firestore(){ return safeFirestore(); }
  function docIdFromItem(item){ return String(item.idRegistro || item.datos && (item.datos.idEstudiantePeriodo || item.datos.numeroIdentificacion) || item.id || ""); }
  function saveItem(item){
    var col = item.tabla === "periodos" ? S.collections.periodos : S.collections.estudiantes;
    var id = docIdFromItem(item);
    if(!id){ return Promise.reject(new Error("Registro sin id para sincronizar.")); }
    var data = Object.assign({}, item.datos || {}, { updatedAt: S.now(), ultimaSincronizacion: S.now() });
    return ensureFirebase().then(function(db){ return db.collection(col).doc(id).set(data, { merge: true }); });
  }
  function normalizeCandidates(collectionName){
    if(Array.isArray(collectionName)){ return collectionName; }
    if(collectionName === S.collections.estudiantes){ return S.collectionCandidates.estudiantes || [collectionName]; }
    if(collectionName === S.collections.periodos){ return S.collectionCandidates.periodos || [collectionName]; }
    return [collectionName];
  }
  function readCollection(db, name, since, limit){
    var max = Number(limit || S.limites.loteBajada);
    var ref = db.collection(name);
    if(since){ return ref.where("updatedAt", ">", since).limit(max).get().catch(function(){ return db.collection(name).limit(max).get(); }); }
    return ref.limit(max).get();
  }
  function listUpdated(collectionName, since, limit){
    return ensureFirebase().then(function(db){
      var candidates = normalizeCandidates(collectionName), rows = [], seen = {}, chain = Promise.resolve();
      candidates.forEach(function(name){
        chain = chain.then(function(){ return readCollection(db, name, since, limit).then(function(snapshot){
          snapshot.forEach(function(doc){ var key = name + "__" + doc.id; if(!seen[key]){ seen[key] = true; rows.push(Object.assign({ _docId: doc.id, _collectionName: name }, doc.data() || {})); } });
        }).catch(function(error){ console.warn("[BDLSyncFirebase] No se pudo leer colección", name, error); }); });
      });
      return chain.then(function(){ return rows; });
    });
  }
  function deleteDoc(collectionName, docId){ return ensureFirebase().then(function(db){ return db.collection(collectionName).doc(String(docId)).delete(); }); }
  function setDoc(collectionName, docId, data){ return ensureFirebase().then(function(db){ return db.collection(collectionName).doc(String(docId)).set(data || {}, { merge:true }); }); }

  window.BDLSyncFirebase = { firestore: firestore, ensureFirebase: ensureFirebase, saveItem: saveItem, listUpdated: listUpdated, deleteDoc: deleteDoc, setDoc: setDoc };
})(window, document);