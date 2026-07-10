/* =========================================================
Nombre completo: stats.sections.js
Ruta o ubicación: /Requisitos/Stats/stats.sections.js
Función o funciones:
- Controlar la navegación lateral de Stats.
- Mostrar solo la sección seleccionada por clic.
- Ocultar todas las demás secciones para evitar que se mezclen al bajar.
- Mantener compatibilidad con renderizados existentes de stats.app.js.
Con qué se conecta:
- stats.html
- stats.app.js
========================================================= */
(function (window, document) {
  "use strict";

  var DEFAULT_SECTION = "stats-resumen-section";
  var STORAGE_KEY = "REQ_STATS_ACTIVE_SECTION_V1";
  var initialized = false;

  function text(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function injectStyles() {
    if (document.getElementById("stats-sections-style")) return;

    var style = document.createElement("style");
    style.id = "stats-sections-style";
    style.textContent = [
      ".stats-main > .stats-section.is-stats-section-hidden{display:none!important}",
      ".stats-side a.is-active{background:#dbeafe;color:#1d4ed8;border-color:#bfdbfe;font-weight:950}",
      ".stats-section.stats-subsection-filter > .stats-card:not(.stats-subsection-active){display:none!important}",
      ".stats-section.stats-subsection-filter{grid-template-columns:1fr!important}",
      ".stats-section.is-stats-section-active{animation:statsSectionIn .14s ease-out}",
      "@keyframes statsSectionIn{from{opacity:.45;transform:translateY(4px)}to{opacity:1;transform:none}}"
    ].join("\n");

    document.head.appendChild(style);
  }

  function links() {
    return Array.prototype.slice.call(document.querySelectorAll(".stats-side a[href^='#']"));
  }

  function mainSections() {
    return Array.prototype.slice.call(document.querySelectorAll(".stats-main > .stats-section"));
  }

  function cleanHash(hash) {
    return text(hash || "").replace(/^#/, "");
  }

  function targetFromId(id) {
    id = cleanHash(id);
    if (!id) return null;
    return document.getElementById(id);
  }

  function routeExists(id) {
    return !!targetFromId(id);
  }

  function initialSectionId() {
    var fromHash = cleanHash(window.location.hash);
    if (routeExists(fromHash)) return fromHash;

    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (routeExists(saved)) return saved;
    } catch (error) {}

    return DEFAULT_SECTION;
  }

  function resetSubsectionFilters() {
    mainSections().forEach(function (section) {
      section.classList.remove("stats-subsection-filter");
      section.querySelectorAll(".stats-subsection-active").forEach(function (node) {
        node.classList.remove("stats-subsection-active");
      });
    });
  }

  function setLinkState(activeId) {
    links().forEach(function (link) {
      var id = cleanHash(link.getAttribute("href"));
      var isActive = id === activeId;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function showOnlyMainSection(section) {
    mainSections().forEach(function (item) {
      var active = item === section;
      item.classList.toggle("is-stats-section-hidden", !active);
      item.classList.toggle("is-stats-section-active", active);
      item.setAttribute("aria-hidden", active ? "false" : "true");
    });
  }

  function applySubsectionRule(activeId, target, mainSection) {
    resetSubsectionFilters();

    if (!mainSection) return;

    if (activeId === "stats-periodos-section") {
      mainSection.classList.add("stats-subsection-filter");
      target.classList.add("stats-subsection-active");
      return;
    }

    if (activeId === "stats-carreras-section") {
      var cards = Array.prototype.slice.call(mainSection.querySelectorAll(":scope > .stats-card"));
      var carreraCard = cards.find(function (card) {
        return card.id !== "stats-periodos-section";
      });

      if (carreraCard) {
        mainSection.classList.add("stats-subsection-filter");
        carreraCard.classList.add("stats-subsection-active");
      }
    }
  }

  function setActiveSection(id, options) {
    options = options || {};
    id = cleanHash(id) || DEFAULT_SECTION;

    var target = targetFromId(id) || targetFromId(DEFAULT_SECTION);
    if (!target) return;

    var mainSection = target.classList.contains("stats-section")
      ? target
      : target.closest(".stats-section");

    if (!mainSection) return;

    showOnlyMainSection(mainSection);
    applySubsectionRule(id, target, mainSection);
    setLinkState(id);

    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch (error) {}

    if (!options.silentHash) {
      try {
        window.history.replaceState(null, "", "#" + id);
      } catch (error) {}
    }

    if (options.scroll !== false) {
      try {
        document.querySelector(".stats-main").scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        try { window.scrollTo(0, 0); } catch (innerError) {}
      }
    }
  }

  function bind() {
    if (initialized) return;
    initialized = true;

    injectStyles();
    document.body.classList.add("stats-single-section-mode");

    links().forEach(function (link) {
      link.addEventListener("click", function (event) {
        var id = cleanHash(link.getAttribute("href"));
        if (!id) return;

        event.preventDefault();
        setActiveSection(id, { scroll: true });
      });
    });

    window.addEventListener("hashchange", function () {
      setActiveSection(cleanHash(window.location.hash), {
        silentHash: true,
        scroll: true
      });
    });

    setActiveSection(initialSectionId(), {
      silentHash: true,
      scroll: false
    });
  }

  function boot() {
    bind();

    // Reaplica la sección activa después de renderizados grandes de stats.app.js.
    window.setTimeout(function () {
      setActiveSection(initialSectionId(), {
        silentHash: true,
        scroll: false
      });
    }, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.StatsSections = {
    setActive: setActiveSection,
    current: function () {
      try {
        return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_SECTION;
      } catch (error) {
        return DEFAULT_SECTION;
      }
    }
  };
})(window, document);
