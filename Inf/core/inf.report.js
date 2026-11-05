/* Constructor de borrador: sin cifras, accesos a la base, ni exportación oficial. */
(function (window) {
  "use strict";
  function build() {
    var catalog = window.InfCatalog, registry = window.InfRegistry;
    if (!catalog || !registry) { throw new Error("Catálogo o plantillas de Inf no disponibles."); }
    var missing = registry.missingChapters();
    if (missing.length) { throw new Error("Faltan plantillas de capítulos: " + missing.join(", ")); }
    var blocks = 0, completed = 0;
    function decorate(node) {
      var content = registry.textFor(node.number);
      var children = (node.sections || []).map(decorate);
      var leaf = children.length === 0;
      if (leaf) { blocks += 1; if (content.trim()) { completed += 1; } }
      return {
        number: node.number, title: node.title, content: content,
        status: !leaf ? "CONTENEDOR" : content.trim() ? "TEXTO_CARGADO" : "PENDIENTE",
        sections: children
      };
    }
    var chapters = catalog.chapters.map(decorate);
    return {
      ok: true, title: "Informe Final del Proceso de Titulación",
      unidad: "Unidad de Titulación y Eficiencia Terminal",
      documentType: "INF", documentCode: null,
      format: "APA 7 con portada institucional INF",
      isDraft: true, canExport: false, canExportDraft: true, dataConnected: false,
      chapters: chapters, coverage: {
        chapters: chapters.length, blocks: blocks, completed: completed,
        pending: blocks - completed
      }
    };
  }
  /* PDF progresivo: incluir exclusivamente nodos con texto incorporado y
     sus antecesores. Los capítulos restantes siguen en el índice de pantalla,
     pero no interrumpen ni rellenan con contenido ficticio la exportación. */
  function buildAvailable() {
    var all = build();
    function available(node) {
      var children = (node.sections || []).map(available).filter(Boolean);
      if (!node.content.trim() && !children.length) { return null; }
      return Object.assign({}, node, { sections: children });
    }
    var chapters = all.chapters.map(available).filter(Boolean);
    var included = chapters.map(function (chapter) { return chapter.number; });
    var excluded = all.chapters.filter(function (chapter) {
      return included.indexOf(chapter.number) < 0;
    }).map(function (chapter) {
      return {number: chapter.number, title: chapter.title};
    });
    return Object.assign({}, all, {
      chapters: chapters, partial: true, canExportDraft: chapters.length > 0,
      includedChapters: included, excludedChapters: excluded,
      coverage: Object.assign({}, all.coverage, { includedChapters: chapters.length })
    });
  }
  window.InfReport = Object.freeze({ build: build, buildAvailable: buildAvailable });
})(window);
