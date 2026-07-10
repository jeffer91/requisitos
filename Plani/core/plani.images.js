/* =========================================================
Nombre completo: plani.images.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.images.js
Funcion:
- Leer imagenes seleccionadas como data URL para vista previa y futuro documento.
- Mantener el manejo de imagenes separado de recursos generales.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}

  function isImage(file){
    return !!(file && text(file.type).indexOf("image/") === 0);
  }

  function readAsDataUrl(file){
    return new Promise(function(resolve, reject){
      if(!isImage(file)){reject(new Error("El archivo no es una imagen valida."));return;}
      var reader = new FileReader();
      reader.onload = function(){resolve(String(reader.result || ""));};
      reader.onerror = function(){reject(reader.error || new Error("No se pudo leer la imagen."));};
      reader.readAsDataURL(file);
    });
  }

  async function normalizeImage(file, sectionId){
    var base = window.PlaniAssets && window.PlaniAssets.normalizeFile ? window.PlaniAssets.normalizeFile(file, sectionId) : {};
    base.kind = "IMAGE";
    base.dataUrl = await readAsDataUrl(file);
    base.alt = text(file && file.name);
    return base;
  }

  function renderImage(asset){
    if(!asset || !asset.dataUrl){return "";}
    return '<figure class="plani-doc-figure"><img src="' + asset.dataUrl + '" alt="' + text(asset.alt || asset.name) + '"><figcaption>' + text(asset.caption || asset.name || '') + '</figcaption></figure>';
  }

  window.PlaniImages = {isImage:isImage, readAsDataUrl:readAsDataUrl, normalizeImage:normalizeImage, renderImage:renderImage};
})(window);
