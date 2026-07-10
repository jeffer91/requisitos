/* =========================================================
Nombre completo: ficha.export.js
Ruta o ubicación: /Requisitos/Ficha/ficha.export.js
Función o funciones:
- Exportar o copiar la ficha individual.
- Copiar texto con Clipboard API cuando exista.
- Usar respaldo con textarea cuando el navegador no permite clipboard.
Con qué se conecta:
- ficha.app.js
========================================================= */
(function(window, document){
  "use strict";

  function text(value){
    return String(value == null ? "" : value);
  }

  function safeName(name){
    return String(name || "archivo")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .trim() || "archivo";
  }

  function download(name, content, type){
    var blob = new Blob([text(content)], {
      type:type || "text/plain;charset=utf-8"
    });

    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");

    a.href = url;
    a.download = safeName(name);
    a.style.display = "none";

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(function(){
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function exportJson(row){
    download(
      "ficha-estudiante.json",
      JSON.stringify(row || {}, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function fallbackCopy(value){
    return new Promise(function(resolve, reject){
      var area = document.createElement("textarea");

      area.value = text(value);
      area.setAttribute("readonly", "readonly");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      area.style.top = "0";

      document.body.appendChild(area);
      area.focus();
      area.select();

      try{
        var ok = document.execCommand("copy");
        area.remove();

        if(ok){
          resolve(true);
        }else{
          reject(new Error("No se pudo copiar al portapapeles."));
        }
      }catch(error){
        area.remove();
        reject(error);
      }
    });
  }

  function copyText(value){
    value = text(value);

    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(value).then(function(){
        return true;
      }).catch(function(){
        return fallbackCopy(value);
      });
    }

    return fallbackCopy(value);
  }

  function exportText(name, value){
    download(name || "ficha-estudiante.txt", value || "", "text/plain;charset=utf-8");
  }

  window.FichaExport = {
    download:download,
    exportJson:exportJson,
    exportText:exportText,
    copyText:copyText
  };
})(window, document);