(function(window){
  "use strict";

  var S = window.BDLSyncConfig;
  if(!S){ throw new Error("BDLSyncConfig debe cargarse antes de BDLSyncFirebase."); }

  function firestore(){
    if(window.firebase && typeof window.firebase.firestore === "function"){
      return window.firebase.firestore();
    }
    if(window.db && typeof window.db.collection === "function"){
      return window.db;
    }
    throw new Error("Firebase Firestore no está disponible.");
  }

  function collection(name){
    return firestore().collection(name);
  }

  function docIdFromItem(item){
    return String(item.idRegistro || item.datos && (item.datos.idEstudiantePeriodo || item.datos.numeroIdentificacion) || item.id || "");
  }

  function saveItem(item){
    var col = item.tabla === "periodos" ? S.collections.periodos : S.collections.estudiantes;
    var id = docIdFromItem(item);
    if(!id){ return Promise.reject(new Error("Registro sin id para sincronizar.")); }
    var data = Object.assign({}, item.datos || {}, { updatedAt: S.now(), ultimaSincronizacion: S.now() });
    return collection(col).doc(id).set(data, { merge: true });
  }

  function listUpdated(collectionName, since, limit){
    var ref = collection(collectionName);
    if(since){ ref = ref.where("updatedAt", ">", since); }
    ref = ref.limit(Number(limit || S.limites.loteBajada));
    return ref.get().then(function(snapshot){
      var rows = [];
      snapshot.forEach(function(doc){
        rows.push(Object.assign({ _docId: doc.id }, doc.data() || {}));
      });
      return rows;
    });
  }

  window.BDLSyncFirebase = {
    firestore: firestore,
    saveItem: saveItem,
    listUpdated: listUpdated
  };
})(window);
