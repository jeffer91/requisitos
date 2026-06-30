(function(window){
  "use strict";

  window.BDLSync = {
    config: window.BDLSyncConfig,
    queue: window.BDLSyncQueue,
    log: window.BDLSyncLog,
    firebase: window.BDLSyncFirebase,
    upload: window.BDLSyncUpload,
    download: window.BDLSyncDownload,
    engine: window.BDLSyncEngine,
    syncNow: function(options){ return window.BDLSyncEngine.syncNow(options || { manual:true }); },
    syncBackground: function(){ return window.BDLSyncEngine.syncBackground(); }
  };

  try{
    window.dispatchEvent(new CustomEvent("bdlocal:sync-ready", { detail:{ ready:true, at:new Date().toISOString() } }));
  }catch(error){}
})(window);
