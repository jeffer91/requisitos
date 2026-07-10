(function(window){
  "use strict";

  window.CargaConfig = {
    version: "1.0.0",
    maxPreviewRows: 100,
    defaultBatchSize: 250,
    acceptedExtensions: ["xlsx", "xls", "csv", "txt", "json"],
    estados: {
      idle: "idle",
      reading: "reading",
      mapping: "mapping",
      validating: "validating",
      ready: "ready",
      committing: "committing",
      done: "done",
      error: "error"
    },
    tiposOrigen: {
      archivo: "archivo",
      clipboard: "clipboard",
      firebase: "firebase",
      manual: "manual"
    },
    now: function(){ return new Date().toISOString(); }
  };
})(window);
