(function(window){
  "use strict";

  function read(text){
    var rows = window.CargaReaderTXT ? window.CargaReaderTXT.parse(text || "") : [];
    return Promise.resolve({ rows: rows, fileName: "pegado", origen: "clipboard" });
  }

  window.CargaReaderClipboard = { read: read };
})(window);
