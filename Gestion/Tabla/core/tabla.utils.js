/* =========================================================
Nombre completo: tabla.utils.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/core/tabla.utils.js
Función o funciones:
- Reunir utilidades compartidas por todos los módulos de Tabla.
- Normalizar texto, cédulas, períodos, teléfonos, correos y alias.
- Proteger operaciones de JSON, clonación, HTML, fechas y temporizadores.
Con qué se conecta:
- tabla.constants.js
- Todos los módulos de Tabla.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";

  function text(value){
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function array(value){
    return Array.isArray(value)
      ? value
      : [];
  }

  function object(value){
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    )
      ? value
      : {};
  }

  function normalizeText(value){
    return text(value)
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function normalizeKey(value){
    return normalizeText(value)
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        ""
      );
  }

  function normalizeCedula(value){
    var clean = text(value).replace(
      /[^0-9A-Za-z]/g,
      ""
    );

    if(/^\d{9}$/.test(clean)){
      return "0" + clean;
    }

    return clean;
  }

  function normalizePhone(value){
    var clean = text(value).replace(
      /[^0-9]/g,
      ""
    );

    if(
      clean.length === 10 &&
      clean.charAt(0) === "0"
    ){
      return "593" + clean.slice(1);
    }

    if(
      clean.length === 9 &&
      clean.charAt(0) === "9"
    ){
      return "593" + clean;
    }

    return clean;
  }

  function normalizeEmail(value){
    return text(value).toLowerCase();
  }

  function isEmail(value){
    value = normalizeEmail(value);

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value
    );
  }

  function normalizeTelegramUser(value){
    value = text(value)
      .replace(
        /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i,
        ""
      )
      .replace(
        /^@+/,
        ""
      )
      .split(/[?/#]/)[0]
      .trim();

    return value;
  }

  function canonicalPeriodId(value){
    value = text(value);

    if(!value){
      return "";
    }

    var match = value.match(
      /^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/
    );

    if(match){
      return (
        match[1] +
        "-" +
        match[2] +
        "__" +
        match[3] +
        "-" +
        match[4]
      );
    }

    return value.replace(
      /_+/g,
      "__"
    );
  }

  function samePeriod(a, b){
    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);

    return (
      !b ||
      (
        !!a &&
        (
          a === b ||
          normalizeKey(a) ===
            normalizeKey(b)
        )
      )
    );
  }

  function periodIdOf(item){
    item = item || {};

    if(typeof item !== "object"){
      return canonicalPeriodId(item);
    }

    return canonicalPeriodId(
      item._periodoId ||
      item.periodoCanonicoId ||
      item.periodoId ||
      item.periodId ||
      item.ultimoPeriodoId ||
      item.idPeriodo ||
      item._bl2PeriodoId ||
      item.id ||
      item.value ||
      item.key ||
      ""
    );
  }

  function periodLabelOf(item){
    item = item || {};

    if(typeof item !== "object"){
      return text(item);
    }

    return text(
      item._periodo ||
      item.periodoCanonicoLabel ||
      item.periodoLabel ||
      item.periodLabel ||
      item.label ||
      item.nombre ||
      item.name ||
      item.descripcion ||
      item.periodo ||
      item.Periodo ||
      periodIdOf(item)
    );
  }

  function escapeHtml(value){
    return text(value)
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /\"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  function safeParse(value, fallback){
    try{
      if(
        value == null ||
        value === ""
      ){
        return fallback;
      }

      var parsed =
        typeof value === "string"
          ? JSON.parse(value)
          : value;

      return parsed == null
        ? fallback
        : parsed;
    }catch(error){
      return fallback;
    }
  }

  function safeStringify(value, fallback){
    try{
      return JSON.stringify(value);
    }catch(error){
      return fallback == null
        ? ""
        : String(fallback);
    }
  }

  function clone(value){
    if(
      value == null ||
      typeof value !== "object"
    ){
      return value;
    }

    if(
      typeof window.structuredClone ===
      "function"
    ){
      try{
        return window.structuredClone(
          value
        );
      }catch(error){}
    }

    return safeParse(
      safeStringify(
        value,
        "null"
      ),
      value
    );
  }

  function pick(
    item,
    aliases,
    fallback
  ){
    item = object(item);
    aliases = array(aliases);

    for(
      var i = 0;
      i < aliases.length;
      i += 1
    ){
      var alias = aliases[i];

      if(
        Object.prototype
          .hasOwnProperty
          .call(item, alias)
      ){
        var direct = item[alias];

        if(
          direct != null &&
          text(direct) !== ""
        ){
          return direct;
        }
      }
    }

    var keys = Object.keys(item);
    var wanted =
      Object.create(null);

    aliases.forEach(function(alias){
      wanted[
        normalizeKey(alias)
      ] = true;
    });

    for(
      var j = 0;
      j < keys.length;
      j += 1
    ){
      if(
        wanted[
          normalizeKey(keys[j])
        ]
      ){
        var value = item[keys[j]];

        if(
          value != null &&
          text(value) !== ""
        ){
          return value;
        }
      }
    }

    return fallback;
  }

  function uniqueBy(
    items,
    keyGetter
  ){
    var seen =
      Object.create(null);

    var output = [];

    array(items).forEach(
      function(item, index){
        var key =
          typeof keyGetter === "function"
            ? keyGetter(
                item,
                index
              )
            : item;

        key = text(key);

        if(!key){
          key =
            "__index__" +
            index;
        }

        if(seen[key]){
          return;
        }

        seen[key] = true;
        output.push(item);
      }
    );

    return output;
  }

  function sortText(
    items,
    getter
  ){
    return array(items)
      .slice()
      .sort(function(a, b){
        var av =
          typeof getter === "function"
            ? getter(a)
            : a;

        var bv =
          typeof getter === "function"
            ? getter(b)
            : b;

        return text(av).localeCompare(
          text(bv),
          "es",
          {
            sensitivity: "base"
          }
        );
      });
  }

  function clamp(
    value,
    min,
    max
  ){
    value = Number(value);
    min = Number(min);
    max = Number(max);

    if(!isFinite(value)){
      value = min;
    }

    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function toPromise(value){
    return (
      value &&
      typeof value.then === "function"
    )
      ? value
      : Promise.resolve(value);
  }

  function debounce(fn, delay){
    var timer = null;
    var lastArgs = null;
    var lastContext = null;

    function debounced(){
      lastArgs = arguments;
      lastContext = this;

      if(timer){
        window.clearTimeout(timer);
      }

      timer =
        window.setTimeout(
          function(){
            var args = lastArgs;
            var context = lastContext;

            timer = null;
            lastArgs = null;
            lastContext = null;

            fn.apply(
              context,
              args
            );
          },
          Number(delay) || 0
        );
    }

    debounced.cancel =
      function(){
        if(timer){
          window.clearTimeout(
            timer
          );

          timer = null;
        }

        lastArgs = null;
        lastContext = null;
      };

    debounced.flush =
      function(){
        if(!timer){
          return;
        }

        window.clearTimeout(
          timer
        );

        timer = null;

        var args = lastArgs;
        var context = lastContext;

        lastArgs = null;
        lastContext = null;

        fn.apply(
          context,
          args || []
        );
      };

    return debounced;
  }

  function sleep(milliseconds){
    return new Promise(
      function(resolve){
        window.setTimeout(
          resolve,
          Math.max(
            0,
            Number(milliseconds) || 0
          )
        );
      }
    );
  }

  function contains(
    haystack,
    needle
  ){
    needle =
      normalizeText(needle)
        .toLowerCase();

    if(!needle){
      return true;
    }

    return normalizeText(
      haystack
    )
      .toLowerCase()
      .indexOf(needle) >= 0;
  }

  function stableKey(parts){
    return array(parts)
      .map(function(part){
        if(
          part &&
          typeof part === "object"
        ){
          return safeStringify(
            part,
            ""
          );
        }

        return text(part);
      })
      .join("|");
  }

  function openWindow(url){
    var opened = window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

    try{
      if(opened){
        opened.opener = null;
      }
    }catch(error){}

    return !!opened;
  }

  function copyText(value){
    value = text(value);

    if(
      window.navigator &&
      window.navigator.clipboard &&
      typeof window.navigator
        .clipboard
        .writeText === "function"
    ){
      return window.navigator
        .clipboard
        .writeText(value)
        .then(function(){
          return true;
        });
    }

    return new Promise(
      function(resolve, reject){
        var area =
          window.document
            .createElement(
              "textarea"
            );

        area.value = value;

        area.setAttribute(
          "readonly",
          "readonly"
        );

        area.style.position =
          "fixed";

        area.style.opacity =
          "0";

        window.document.body
          .appendChild(area);

        area.select();

        try{
          var ok =
            window.document
              .execCommand(
                "copy"
              );

          window.document.body
            .removeChild(area);

          if(ok){
            resolve(true);
          }else{
            reject(
              new Error(
                "No se pudo copiar el texto."
              )
            );
          }
        }catch(error){
          window.document.body
            .removeChild(area);

          reject(error);
        }
      }
    );
  }

  window.TablaUtils = {
    version: VERSION,

    text: text,
    array: array,
    object: object,

    normalizeText:
      normalizeText,

    normalizeKey:
      normalizeKey,

    normalizeCedula:
      normalizeCedula,

    normalizePhone:
      normalizePhone,

    normalizeEmail:
      normalizeEmail,

    isEmail:
      isEmail,

    normalizeTelegramUser:
      normalizeTelegramUser,

    canonicalPeriodId:
      canonicalPeriodId,

    samePeriod:
      samePeriod,

    periodIdOf:
      periodIdOf,

    periodLabelOf:
      periodLabelOf,

    escapeHtml:
      escapeHtml,

    safeParse:
      safeParse,

    safeStringify:
      safeStringify,

    clone:
      clone,

    pick:
      pick,

    uniqueBy:
      uniqueBy,

    sortText:
      sortText,

    clamp:
      clamp,

    nowIso:
      nowIso,

    toPromise:
      toPromise,

    debounce:
      debounce,

    sleep:
      sleep,

    contains:
      contains,

    stableKey:
      stableKey,

    openWindow:
      openWindow,

    copyText:
      copyText
  };
})(window);