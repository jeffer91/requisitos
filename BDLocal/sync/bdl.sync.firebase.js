(function(window, document){
  "use strict";

  var S = window.BDLSyncConfig;
  if(!S){ throw new Error("BDLSyncConfig debe cargarse antes de BDLSyncFirebase."); }

  var loading = null;

  function scriptUrl(relative){
    try{ return new URL(relative, document.currentScript ? document.currentScript.src : window.location.href).href; }catch(error){ return relative; }
  }

  function loadScript(url){
    return new Promise(function(resolve, reject){
      var existing = document.querySelector('script[src="' + url + '"]');
      if(existing){ resolve(); return; }
      var script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.onload = function(){ resolve(); };
      script.onerror = function(){ reject(new Error("No se pudo cargar " + url)); };
      document.head.appendChild(script);
    });
  }

  function loadOptional(urls){
    var chain = Promise.resolve(false);
    urls.forEach(function(url){
      chain = chain.then(function(done){
        if(done){ return true; }
        return loadScript(url).then(function(){ return true; }).catch(function(){ return false; });
      });
    });
    return chain;
  }

  function ensureFirebase(){
    if(window.db && typeof window.db.collection === "function"){ return Promise.resolve(window.db); }
    if(window.firebase && typeof window.firebase.firestore === "function"){
      try{ return Promise.resolve(window.firebase.firestore()); }catch(error){}
    }
    if(loading){ return loading; }

    loading = loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js")
      .then(function(){ return loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"); })
      .then(function(){
        return loadOptional([
          scriptUrl("../../../incorporaciones/sedes/js/firebase-config.js"),
          scriptUrl("../../incorporaciones/sedes/js/firebase-config.js"),
          scriptUrl("../firebase-config.js"),
          scriptUrl("firebase-config.js")
        ]);
      })
      .then(function(){
        if(window.db && typeof window.db.collection === "function"){ return window.db; }
        if(window.firebaseConfig && window.firebase && (!window.firebase.apps || !window.firebase.apps.length)){
          window.firebase.initializeApp(window.firebaseConfig);
        }
        if(window.FIREBASE_CONFIG && window.firebase && (!window.firebase.apps || !window.firebase.apps.length)){
          window.firebase.initializeApp(window.FIREBASE_CONFIG);
        }
        if(window.firebase && typeof window.firebase.firestore === "function"){
          return window.firebase.firestore();
        }
        throw new Error("Firebase Firestore no está disponible. Revise firebase-config.js.");
      });

    return loading;
  }

  function firestore(){
    if(window.db && typeof window.db.collection === "function"){ return window.db; }
    if(window.firebase && typeof window.firebase.firestore === "function"){ return window.firebase.firestore(); }
    throw new Error("Firebase Firestore no está disponible.");
  }

  function docIdFromItem(item){
    return String(item.idRegistro || item.datos && (item.datos.idEstudiantePeriodo || item.datos.numeroIdentificacion) || item.id || "");
  }

  function saveItem(item){
    var col = item.tabla === "periodos" ? S.collections.periodos : S.collections.estudiantes;
    var id = docIdFromItem(item);
    if(!id){ return Promise.reject(new Error("Registro sin id para sincronizar.")); }
    var data = Object.assign({}, item.datos || {}, { updatedAt: S.now(), ultimaSincronizacion: S.now() });
    return ensureFirebase().then(function(db){ return db.collection(col).doc(id).set(data, { merge: true }); });
  }

  function listUpdated(collectionName, since, limit){
    return ensureFirebase().then(function(db){
      var ref = db.collection(collectionName);
      if(since){ ref = ref.where("updatedAt", ">", since); }
      ref = ref.limit(Number(limit || S.limites.loteBajada));
      return ref.get().then(function(snapshot){
        var rows = [];
        snapshot.forEach(function(doc){ rows.push(Object.assign({ _docId: doc.id }, doc.data() || {})); });
        return rows;
      });
    });
  }

  window.BDLSyncFirebase = { firestore: firestore, ensureFirebase: ensureFirebase, saveItem: saveItem, listUpdated: listUpdated };
})(window, document);
