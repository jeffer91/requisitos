/* Paquete ZIP con subcarpetas por sección y archivos globales. */
(function(window){
  "use strict";var U=window.InPVCUtils;
  function requireZip(){if(!window.JSZip){throw new Error("La biblioteca JSZip no está disponible.");}return window.JSZip;}
  function bytes(value){return value&&typeof value.arrayBuffer==="function"?value.arrayBuffer():Promise.resolve(value);}
  function filename(ctx){return U.slug('Informe_PVC_'+(ctx.metadata.periodoLabel||ctx.metadata.periodoId))+'_Completo.zip';}
  function create(ctx,sections){sections=sections&&sections.length?sections:ctx.sections;var zip=new (requireZip())(),chain=Promise.resolve();sections.forEach(function(section){chain=chain.then(function(){var folder=zip.folder(section.folder);folder.file(U.slug(section.title)+'.doc',window.InPVCWord.build(ctx,[section],section.title));return window.InPVCPdf.blob(ctx,[section],section.title).then(bytes).then(function(pdf){folder.file(U.slug(section.title)+'.pdf',pdf);});});});return chain.then(function(){zip.file(window.InPVCWord.filename(ctx,"Completo"),window.InPVCWord.build(ctx,sections,"Informe final del proceso de titulación PVC"));return window.InPVCPdf.blob(ctx,sections,"Informe final del proceso de titulación PVC");}).then(bytes).then(function(pdf){zip.file(window.InPVCPdf.filename(ctx,"Completo"),pdf);return zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});});}
  function download(ctx,sections){return create(ctx,sections).then(function(blob){U.download(blob,filename(ctx));return {ok:true,filename:filename(ctx)};});}
  window.InPVCZip={create:create,download:download,filename:filename};
})(window);
