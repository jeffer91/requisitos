/* Formateador Markdown seguro. Las fuentes se conservan sin alterar. */
(function (window, document) {
  "use strict";
  function inline(target, content) {
    String(content).split(/(\*\*[^*]+\*\*)/g).forEach(function (part) {
      if (!part) { return; }
      if (part.startsWith("**") && part.endsWith("**")) {
        var bold = document.createElement("strong");
        bold.textContent = part.slice(2, -2);
        target.appendChild(bold);
      } else {
        target.appendChild(document.createTextNode(part));
      }
    });
  }
  function render(target, markdown) {
    target.textContent = "";
    var lines = [], list = null, type = "";
    function flush() {
      if (!lines.length) { return; }
      var p = document.createElement("p");
      inline(p, lines.join(" "));
      target.appendChild(p);
      lines = [];
    }
    String(markdown || "").replace(/\r\n?/g, "\n").split("\n").forEach(function (source) {
      var line = source.trim(), heading, item;
      if (!line) { flush(); return; }
      heading = line.match(/^(#{3,6})\s+(.+)$/);
      if (heading) {
        flush(); list = null; type = "";
        var title = document.createElement("h4");
        inline(title, heading[2]); target.appendChild(title);
        return;
      }
      item = line.match(/^([-*])\s+(.+)$/) || line.match(/^(\d+)\.\s+(.+)$/);
      if (item) {
        flush();
        var ordered = /^\d/.test(item[1]), newType = ordered ? "ol" : "ul";
        if (!list || type !== newType) {
          list = document.createElement(newType);
          target.appendChild(list); type = newType;
        }
        var li = document.createElement("li");
        if (ordered) { li.value = Number(item[1]); }
        inline(li, item[2]); list.appendChild(li);
        return;
      }
      list = null; type = "";
      lines.push(line);
    });
    flush();
  }
  window.InfMarkdown = Object.freeze({render:render});
})(window, document);
