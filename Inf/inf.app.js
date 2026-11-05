/* Vista de avance de plantillas: no consulta ni modifica datos académicos. */
(function (window, document) {
  "use strict";
  function element(tag, cls, value) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (value !== undefined) { node.textContent = value; }
    return node;
  }
  function makeNode(item, isChapter) {
    var li = element("li", isChapter ? "inf-chapter" : "inf-node");
    var line = element("div", "inf-line");
    line.appendChild(element("span", "inf-title", item.number + ". " + item.title));
    if (!item.sections.length) {
      line.appendChild(element("span", "inf-status" + (item.status === "TEXTO_CARGADO" ? " ready" : ""),
        item.status === "TEXTO_CARGADO" ? "Texto incorporado" : "Pendiente"));
    }
    li.appendChild(line);
    if (item.content && item.content.trim()) {
      li.appendChild(element("p", "inf-preview", item.content));
    }
    if (item.sections.length) {
      var nested = element("ol", "inf-nodes");
      item.sections.forEach(function (section) { nested.appendChild(makeNode(section, false)); });
      li.appendChild(nested);
    }
    return li;
  }
  function boot() {
    var status = document.getElementById("inf-status");
    var target = document.getElementById("inf-chapters");
    try {
      var report = window.InfReport.build();
      target.textContent = "";
      report.chapters.forEach(function (chapter) {
        target.appendChild(makeNode(chapter, true));
      });
      status.textContent = report.coverage.chapters + " capítulos · " +
        report.coverage.completed + " de " + report.coverage.blocks +
        " apartados con contenido · " + report.coverage.pending + " pendientes";
      window.InfApp = Object.freeze({ getDraft: function () { return window.InfReport.build(); } });
    } catch (error) {
      status.className = "inf-info error";
      status.textContent = "No se pudo preparar Inf: " + error.message;
    }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); }
  else { boot(); }
})(window, document);
