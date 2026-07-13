/* =========================================================
Nombre completo: bl2.cloud-pull.safe.js
Ruta o ubicación: /BDLocal/bl2.cloud-pull.safe.js
Función o funciones:
- Ser la implementación principal para traer Google Sheets a Base Local.
- Permitir traer un período seleccionado.
- Consultar y traer automáticamente todos los períodos remotos.
- Proteger cambios locales pendientes y registros locales más recientes.
- Crear respaldos antes de importar.
- Ignorar tablas técnicas y conservar únicamente datos académicos.
- Enlazar los botones de descarga de Google Sheets y Firebase.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "3.2.0-all-periods-safe";
  var FETCH_TIMEOUT_MS = 120000;
  var PAUSE_KEY = "REQ_BDLOCAL_PAUSE_GOOGLE_PUSH";
  var LS_DIVISIONES = "carga.periodos.divisiones";
  var LS_PERIODOS = "carga.periodos.local";

  var pulling = false;
  var pullingAll = false;
  var enginePausedByPull = false;

  var ALLOWED_TABLES = {
    periodos:true,
    periodosDivisiones:true,
    estudiantes:true,
    matriculasPeriodo:true,
    requisitos:true,
    contactos:true,
    notas:true
  };

  var TECHNICAL_TABLES = {
    config:true,
    cambios:true,
    logs:true,
    resumen:true,
    errores:true,
    sync_meta:true,
    cacheViews:true,
    syncEstado:true,
    erroresValidacion:true,
    cambiosPendientes:true
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function now(){
    return new Date().toISOString();
  }

  function byId(name){
    return document.getElementById(name);
  }

  function core(){
    return window.BL2Core || null;
  }

  function db(){
    return window.BL2DB || null;
  }

  function sync(){
    return window.BL2Sync || null;
  }

  function outbox(){
    return window.BDLSyncOutbox || null;
  }

  function store(){
    return window.BDLocalConfigStore || null;
  }

  function manager(){
    return window.BDLocalSyncManager || null;
  }

  function config(){
    return window.BL2Config || {};
  }

  function stores(){
    return config().stores || {};
  }

  function normalize(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/\s+/g," ")
      .trim()
      .toLowerCase();
  }

  function key(value){
    return normalize(value)
      .replace(/[^a-z0-9]+/g,"_")
      .replace(/^_+|_+$/g,"");
  }

  function clone(value){
    try{
      return JSON.parse(JSON.stringify(value));
    }catch(error){
      return value;
    }
  }

  function escapeHtml(value){
    return text(value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function plain(value){
    return !!value &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function hasValue(value){
    if(value === undefined || value === null){
      return false;
    }

    if(typeof value === "string"){
      return text(value) !== "";
    }

    if(Array.isArray(value)){
      return value.length > 0;
    }

    return true;
  }

  function mergeNonEmpty(base,incoming){
    var output = plain(base) ? clone(base) : {};

    if(!plain(incoming)){
      return output;
    }

    Object.keys(incoming).forEach(function(name){
      var value = incoming[name];

      if(plain(value)){
        output[name] = mergeNonEmpty(
          plain(output[name]) ? output[name] : {},
          value
        );
      }else if(hasValue(value)){
        output[name] = clone(value);
      }
    });

    return output;
  }

  function hash(value){
    var source = typeof value === "string"
      ? value
      : JSON.stringify(value || {});

    var result = 2166136261;

    for(var index = 0; index < source.length; index += 1){
      result ^= source.charCodeAt(index);
      result +=
        (result << 1) +
        (result << 4) +
        (result << 7) +
        (result << 8) +
        (result << 24);
    }

    return (result >>> 0).toString(16);
  }

  function first(row,names){
    row = row || {};

    var wanted = (names || []).map(key);
    var rowKeys = Object.keys(row);

    for(var index = 0; index < rowKeys.length; index += 1){
      if(wanted.indexOf(key(rowKeys[index])) >= 0){
        return row[rowKeys[index]];
      }
    }

    return "";
  }

  function normalizeCedula(value){
    var rules = window.BDLRulesPersona;

    if(rules && typeof rules.normalizeCedula === "function"){
      return rules.normalizeCedula(value);
    }

    var utils = config().utils || {};

    if(typeof utils.normalizeCedula === "function"){
      return utils.normalizeCedula(value);
    }

    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");

    return /^\d{9}$/.test(raw)
      ? "0" + raw
      : raw;
  }

  function normalizePeriodId(value){
    value = text(value);

    if(!value){
      return "";
    }

    var match = value.match(
      /^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/
    );

    return match
      ? match[1] + "-" + match[2] + "__" +
        match[3] + "-" + match[4]
      : value.replace(/_+/g,"__");
  }

  function timestamp(row){
    var value = Date.parse(text(
      row && (
        row.updatedAt ||
        row.ultimaEdicionLocal ||
        row.fechaActualizacion ||
        row.fechaRegistro ||
        row.createdAt
      )
    ));

    return Number.isFinite(value) ? value : 0;
  }

  function log(message,level,data){
    try{
      var box = byId("bl2-log");

      if(box){
        var item = document.createElement("div");

        item.className =
          "bl2-log-item " +
          (level ? "is-" + level : "");

        item.innerHTML =
          "<strong>Google Sheets</strong>" +
          "<span>" +
          escapeHtml(message) +
          "</span>";

        box.insertBefore(item,box.firstChild);
      }
    }catch(error){}

    try{
      if(core() && typeof core().log === "function"){
        core().log(
          level === "error"
            ? "ERROR"
            : level === "warn"
              ? "WARN"
              : "INFO",
          message,
          data || {}
        ).catch(function(){});
      }
    }catch(error){}

    try{
      if(store() && typeof store().addLog === "function"){
        store().addLog(
          "cloud_pull_safe",
          message,
          level === "error"
            ? "error"
            : level === "warn"
              ? "warning"
              : "success",
          data || {}
        );
      }
    }catch(error){}
  }

  function progress(percent,detail){
    try{
      window.dispatchEvent(
        new CustomEvent("bl2:sync-progress",{
          detail:{
            target:"google",
            percent:Math.max(
              0,
              Math.min(100,Number(percent || 0))
            ),
            detail:detail || "",
            at:now()
          }
        })
      );
    }catch(error){}

    try{
      if(
        window.BDLocalConfigUI &&
        typeof window.BDLocalConfigUI.setProgress ===
        "function"
      ){
        window.BDLocalConfigUI.setProgress(
          percent > 0 && percent < 100,
          percent,
          detail || ""
        );
      }
    }catch(error){}
  }

  function emitFinished(summary){
    try{
      window.dispatchEvent(
        new CustomEvent("bl2:external-pull-finished",{
          detail:{
            target:"google",
            summary:summary,
            at:now()
          }
        })
      );
    }catch(error){}
  }

  function setStatus(name,message){
    var element = byId(name);

    if(element){
      element.textContent = message;
    }
  }

  function setBusy(busy){
    [
      "bl2-btn-fetch-firebase-config",
      "bl2-btn-pull-sheets",
      "bl2-btn-pull-sheets-all",
      "bl2-btn-clean-sheets-duplicates",
      "bl2-btn-push-google",
      "bl2-btn-push-firebase",
      "bl2-btn-pull-firebase",
      "bl2-btn-pull-firebase-all",
      "bl2-btn-push-supabase",
      "bl2-btn-sync-queue",
      "bl2-btn-load",
      "bl2-btn-sync-google",
      "bl2-btn-sync-firebase",
      "bl2-btn-period-save",
      "bl2-btn-refresh"
    ].forEach(function(name){
      var button = byId(name);

      if(button){
        button.disabled = !!busy;
      }
    });
  }

  function writeJson(name,value){
    try{
      window.localStorage.setItem(
        name,
        JSON.stringify(value)
      );
    }catch(error){}
  }

  function readJson(name,fallback){
    try{
      var value = JSON.parse(
        window.localStorage.getItem(name) || ""
      );

      return value == null ? fallback : value;
    }catch(error){
      return fallback;
    }
  }

  function pauseOutbound(period){
    pulling = true;
    window.BL2_GOOGLE_PUSH_PAUSED = true;

    writeJson(PAUSE_KEY,{
      paused:true,
      reason:"Traer Google Sheets: " + period.id,
      at:now()
    });

    if(
      window.BDLSyncV2 &&
      typeof window.BDLSyncV2.pause === "function" &&
      (
        !window.BDLSyncV2.isPaused ||
        !window.BDLSyncV2.isPaused()
      )
    ){
      window.BDLSyncV2.pause(
        "Importación Google Sheets en curso"
      );

      enginePausedByPull = true;
    }
  }

  function resumeOutbound(){
    pulling = false;
    window.BL2_GOOGLE_PUSH_PAUSED = false;

    try{
      window.localStorage.removeItem(PAUSE_KEY);
    }catch(error){}

    if(
      enginePausedByPull &&
      window.BDLSyncV2 &&
      typeof window.BDLSyncV2.resume === "function"
    ){
      window.BDLSyncV2.resume();
    }

    enginePausedByPull = false;
  }

  function selectedPeriod(){
    try{
      if(
        window.BL2App &&
        typeof window.BL2App.getSelectedPeriod ===
        "function"
      ){
        var selected =
          window.BL2App.getSelectedPeriod();

        if(selected && text(selected.id)){
          return {
            id:normalizePeriodId(selected.id),
            label:text(
              selected.label ||
              selected.id
            )
          };
        }
      }
    }catch(error){}

    var select = byId("bl2-period-select");
    var periodoId = normalizePeriodId(
      select && select.value
    );

    if(!periodoId){
      return null;
    }

    var label =
      select &&
      select.selectedOptions &&
      select.selectedOptions[0]
        ? text(
            select.selectedOptions[0].textContent
          )
        : periodoId;

    return {
      id:periodoId,
      label:label
    };
  }

  function availablePeriods(){
    var map = {};
    var select = byId("bl2-period-select");

    Array.prototype.slice.call(
      select && select.options || []
    ).forEach(function(option){
      var periodoId =
        normalizePeriodId(option.value);

      if(periodoId){
        map[periodoId] = {
          id:periodoId,
          label:text(
            option.textContent ||
            periodoId
          )
        };
      }
    });

    if(
      core() &&
      typeof core().getPeriods === "function"
    ){
      return core().getPeriods()
        .then(function(rows){
          (rows || []).forEach(function(row){
            var periodoId = normalizePeriodId(
              row.id ||
              row.periodoId ||
              row.periodoCanonicoId
            );

            if(periodoId){
              map[periodoId] = {
                id:periodoId,
                label:text(
                  row.label ||
                  row.periodoLabel ||
                  periodoId
                )
              };
            }
          });

          return Object.keys(map)
            .sort()
            .map(function(periodoId){
              return map[periodoId];
            });
        })
        .catch(function(){
          return Object.keys(map)
            .sort()
            .map(function(periodoId){
              return map[periodoId];
            });
        });
    }

    return Promise.resolve(
      Object.keys(map)
        .sort()
        .map(function(periodoId){
          return map[periodoId];
        })
    );
  }

  function ensurePeriodModal(){
    if(byId("bl2-pull-period-modal")){
      return;
    }

    var style = document.createElement("style");

    style.textContent =
      ".bl2-pull-modal{" +
        "position:fixed;" +
        "inset:0;" +
        "z-index:100000;" +
        "display:none;" +
        "align-items:center;" +
        "justify-content:center;" +
        "background:rgba(15,23,42,.46);" +
        "padding:18px" +
      "}" +
      ".bl2-pull-modal.is-open{display:flex}" +
      ".bl2-pull-card{" +
        "width:min(540px,96vw);" +
        "background:#fff;" +
        "border:1px solid #dbe3ef;" +
        "border-radius:20px;" +
        "box-shadow:0 25px 80px rgba(15,23,42,.28);" +
        "padding:18px;" +
        "display:grid;" +
        "gap:14px" +
      "}" +
      ".bl2-pull-card h2{" +
        "margin:0;" +
        "color:#172033;" +
        "font-size:20px" +
      "}" +
      ".bl2-pull-card p{" +
        "margin:0;" +
        "color:#64748b;" +
        "font-size:13px;" +
        "font-weight:700;" +
        "line-height:1.4" +
      "}" +
      ".bl2-pull-card label{" +
        "display:grid;" +
        "gap:6px;" +
        "font-size:12px;" +
        "font-weight:900" +
      "}" +
      ".bl2-pull-card select{" +
        "min-height:42px;" +
        "border:1px solid #dbe3ef;" +
        "border-radius:12px;" +
        "padding:8px 11px;" +
        "background:#fff" +
      "}" +
      ".bl2-pull-warning{" +
        "background:#fff7ed;" +
        "border:1px solid #fed7aa;" +
        "color:#9a3412;" +
        "border-radius:12px;" +
        "padding:10px;" +
        "font-size:12px;" +
        "font-weight:800;" +
        "line-height:1.4" +
      "}" +
      ".bl2-pull-actions{" +
        "display:flex;" +
        "justify-content:flex-end;" +
        "gap:9px" +
      "}" +
      ".bl2-pull-actions button{" +
        "min-height:38px;" +
        "border-radius:999px;" +
        "border:1px solid #dbe3ef;" +
        "background:#fff;" +
        "padding:0 14px;" +
        "font-weight:900;" +
        "cursor:pointer" +
      "}" +
      ".bl2-pull-actions .primary{" +
        "background:#3949e8;" +
        "border-color:#3949e8;" +
        "color:#fff" +
      "}";

    document.head.appendChild(style);

    var modal = document.createElement("section");

    modal.id = "bl2-pull-period-modal";
    modal.className = "bl2-pull-modal";

    modal.innerHTML =
      '<div class="bl2-pull-card" role="dialog" aria-modal="true">' +
        "<div>" +
          "<h2>Traer Google Sheets a Base Local</h2>" +
          "<p>Seleccione un período. Base Local no se borra y conserva cambios locales.</p>" +
        "</div>" +
        "<label>" +
          "Período" +
          '<select id="bl2-pull-period-select"></select>' +
        "</label>" +
        '<div class="bl2-pull-warning">' +
          "Se protegerán cambios pendientes, datos locales más recientes y tablas técnicas." +
        "</div>" +
        '<div class="bl2-pull-actions">' +
          '<button type="button" data-pull-cancel>Cancelar</button>' +
          '<button type="button" class="primary" data-pull-confirm>Continuar</button>' +
        "</div>" +
      "</div>";

    document.body.appendChild(modal);
  }

  function choosePeriod(){
    ensurePeriodModal();

    return availablePeriods().then(function(periods){
      if(!periods.length){
        throw new Error(
          "No existen períodos locales disponibles. Use Traer todo para detectarlos desde la base externa."
        );
      }

      return new Promise(function(resolve,reject){
        var modal =
          byId("bl2-pull-period-modal");

        var select =
          byId("bl2-pull-period-select");

        var active = selectedPeriod();

        select.innerHTML = periods.map(
          function(period){
            return (
              '<option value="' +
              escapeHtml(period.id) +
              '">' +
              escapeHtml(period.label) +
              " · " +
              escapeHtml(period.id) +
              "</option>"
            );
          }
        ).join("");

        if(active && active.id){
          select.value = active.id;
        }

        function close(){
          modal.classList.remove("is-open");
          modal.onclick = null;

          modal.querySelector(
            "[data-pull-cancel]"
          ).onclick = null;

          modal.querySelector(
            "[data-pull-confirm]"
          ).onclick = null;
        }

        modal.querySelector(
          "[data-pull-cancel]"
        ).onclick = function(){
          close();
          reject(
            new Error("Operación cancelada.")
          );
        };

        modal.querySelector(
          "[data-pull-confirm]"
        ).onclick = function(){
          var periodoId =
            normalizePeriodId(select.value);

          var found = periods.filter(
            function(period){
              return period.id === periodoId;
            }
          )[0];

          close();

          resolve(
            found || {
              id:periodoId,
              label:periodoId
            }
          );
        };

        modal.onclick = function(event){
          if(event.target === modal){
            close();
            reject(
              new Error("Operación cancelada.")
            );
          }
        };

        modal.classList.add("is-open");
      });
    });
  }

  function requireSheetsConfig(){
    if(
      !store() ||
      typeof store().getSheetsConfig !==
      "function"
    ){
      throw new Error(
        "La configuración de Google Sheets no está disponible."
      );
    }

    var cfg = store().getSheetsConfig({
      includeSecret:true
    }) || {};

    if(!cfg.enabled){
      throw new Error(
        "Google Sheets está desactivado."
      );
    }

    if(!text(cfg.appsScriptUrl)){
      throw new Error(
        "Falta la URL de Apps Script."
      );
    }

    if(!text(cfg.token)){
      throw new Error(
        "Falta el token de Apps Script."
      );
    }

    if(!text(cfg.spreadsheetId)){
      throw new Error(
        "Falta el ID de Google Sheets."
      );
    }

    return cfg;
  }

  function syncSheetsConfigToBL2(cfg){
    cfg = cfg || {};

    var tasks = [];

    if(
      sync() &&
      typeof sync().setGoogleScriptUrl ===
      "function" &&
      text(cfg.appsScriptUrl)
    ){
      tasks.push(
        sync().setGoogleScriptUrl(
          cfg.appsScriptUrl
        )
      );
    }

    if(
      db() &&
      typeof db().setSetting === "function"
    ){
      if(text(cfg.appsScriptUrl)){
        tasks.push(
          db().setSetting(
            "googleScriptUrl",
            text(cfg.appsScriptUrl)
          )
        );
      }

      if(text(cfg.spreadsheetId)){
        tasks.push(
          db().setSetting(
            "googleSpreadsheetId",
            text(cfg.spreadsheetId)
          )
        );
      }

      if(text(cfg.token)){
        tasks.push(
          db().setSetting(
            "googleToken",
            text(cfg.token)
          )
        );
      }
    }

    writeJson(
      "REQ_BDLOCAL_GOOGLE_SHEETS_CONFIG",
      {
        enabled:true,
        appsScriptUrl:text(cfg.appsScriptUrl),
        webAppUrl:text(cfg.appsScriptUrl),
        spreadsheetId:text(
          cfg.spreadsheetId
        ),
        token:text(cfg.token),
        sheetName:text(
          cfg.sheetName ||
          "Requisitos"
        ),
        updatedAt:now(),
        source:"BL2CloudPullSafe"
      }
    );

    return Promise.all(
      tasks.map(function(task){
        return Promise.resolve(task)
          .catch(function(){
            return null;
          });
      })
    );
  }

  function postJson(url,payload,timeoutMs){
    var controller =
      window.AbortController
        ? new AbortController()
        : null;

    var timer = controller
      ? window.setTimeout(function(){
          controller.abort();
        },Number(timeoutMs || FETCH_TIMEOUT_MS))
      : null;

    return fetch(url,{
      method:"POST",
      mode:"cors",
      redirect:"follow",
      headers:{
        "Content-Type":
          "text/plain;charset=utf-8"
      },
      body:JSON.stringify(payload || {}),
      signal:controller
        ? controller.signal
        : undefined
    }).then(function(response){
      return response.text()
        .then(function(raw){
          var data = {};

          try{
            data = raw
              ? JSON.parse(raw)
              : {};
          }catch(error){
            data = {
              ok:response.ok,
              raw:raw
            };
          }

          if(!response.ok){
            throw new Error(
              data.message ||
              data.error ||
              ("HTTP " + response.status)
            );
          }

          if(data && data.ok === false){
            var reason = text(
              data.error ||
              data.code ||
              data.message
            );

            if(
              reason.indexOf(
                "ACCION_NO_RECONOCIDA"
              ) >= 0
            ){
              throw new Error(
                "Apps Script está desactualizado y no reconoce la operación solicitada."
              );
            }

            throw new Error(
              reason ||
              "Apps Script respondió ok=false."
            );
          }

          return data;
        });
    }).catch(function(error){
      if(
        error &&
        error.name === "AbortError"
      ){
        throw new Error(
          "Tiempo agotado al leer Google Sheets."
        );
      }

      throw error;
    }).finally(function(){
      if(timer){
        window.clearTimeout(timer);
      }
    });
  }

  function requestPull(cfg,period){
    return postJson(
      cfg.appsScriptUrl,
      {
        action:"pull_bl2",
        target:"bdlocal",
        source:"BL2CloudPullSafe",
        mode:"pull_to_bdlocal",
        scope:"period",
        token:cfg.token,
        spreadsheetId:cfg.spreadsheetId,
        sheetName:
          cfg.sheetName ||
          "Requisitos",
        periodoId:period.id,
        periodoLabel:period.label,
        requestedAt:now()
      },
      FETCH_TIMEOUT_MS
    );
  }

  function requestRemotePeriods(cfg){
    return postJson(
      cfg.appsScriptUrl,
      {
        action:"pull_bl2",
        target:"bdlocal",
        source:"BL2CloudPullSafe",
        mode:"pull_to_bdlocal",
        scope:"periods",
        includeData:false,
        token:cfg.token,
        spreadsheetId:cfg.spreadsheetId,
        sheetName:
          cfg.sheetName ||
          "Requisitos",
        requestedAt:now()
      },
      FETCH_TIMEOUT_MS
    );
  }

  function requestCompact(cfg){
    return postJson(
      cfg.appsScriptUrl,
      {
        action:"compact_bl2",
        target:"google_sheets",
        source:"BL2CloudPullSafe",
        token:cfg.token,
        spreadsheetId:cfg.spreadsheetId,
        sheetName:
          cfg.sheetName ||
          "Requisitos",
        requestedAt:now()
      },
      FETCH_TIMEOUT_MS
    );
  }

  function normalizeTableKey(name){
    var map = {
      config:"config",
      periodos:"periodos",
      periodo:"periodos",
      periodosdivisiones:"periodosDivisiones",
      divisionesperiodo:"periodosDivisiones",
      estudiantes:"estudiantes",
      estudiante:"estudiantes",
      matriculasperiodo:"matriculasPeriodo",
      matriculas:"matriculasPeriodo",
      requisitos:"requisitos",
      requisito:"requisitos",
      contactos:"contactos",
      contacto:"contactos",
      notas:"notas",
      nota:"notas",
      cambios:"cambios",
      cambio:"cambios",
      cambiospendientes:"cambiosPendientes",
      logs:"logs",
      log:"logs",
      resumen:"resumen",
      errores:"errores",
      erroresvalidacion:"erroresValidacion",
      syncmeta:"sync_meta",
      syncestado:"syncEstado",
      cacheviews:"cacheViews"
    };

    return (
      map[key(name).replace(/_/g,"")] ||
      map[key(name)] ||
      name
    );
  }

  function extractTables(response){
    var tables = {};

    [
      response && response.tables,
      response &&
        response.data &&
        response.data.tables,
      response &&
        response.payload &&
        response.payload.tables,
      response && response.sheets,
      response && response.rowsBySheet
    ].forEach(function(root){
      if(
        !root ||
        typeof root !== "object" ||
        Array.isArray(root)
      ){
        return;
      }

      Object.keys(root).forEach(function(name){
        if(!Array.isArray(root[name])){
          return;
        }

        var mapped =
          normalizeTableKey(name);

        tables[mapped] =
          (tables[mapped] || [])
            .concat(root[name]);
      });
    });

    if(
      Array.isArray(
        response &&
        response.estudiantes
      )
    ){
      tables.estudiantes =
        (tables.estudiantes || [])
          .concat(response.estudiantes);
    }

    if(
      Array.isArray(
        response &&
        response.rows
      )
    ){
      tables.estudiantes =
        (tables.estudiantes || [])
          .concat(response.rows);
    }

    return tables;
  }

  function remotePeriods(response){
    var map = {};

    function add(value,label){
      var periodoId =
        normalizePeriodId(value);

      if(!periodoId){
        return;
      }

      map[periodoId] = {
        id:periodoId,
        label:text(label || periodoId)
      };
    }

    [
      response && response.periods,
      response && response.periodos,
      response &&
        response.data &&
        response.data.periods,
      response &&
        response.data &&
        response.data.periodos
    ].forEach(function(rows){
      if(!Array.isArray(rows)){
        return;
      }

      rows.forEach(function(row){
        if(typeof row === "string"){
          add(row,row);
          return;
        }

        add(
          row && (
            row.id ||
            row.periodoId ||
            row.periodoCanonicoId
          ),
          row && (
            row.label ||
            row.periodoLabel ||
            row.periodoCanonicoLabel
          )
        );
      });
    });

    var tables = extractTables(response);

    Object.keys(tables).forEach(function(name){
      (tables[name] || []).forEach(
        function(row){
          add(
            first(row,[
              "periodoId",
              "periodoCanonicoId",
              "idPeriodo",
              "periodId"
            ]),
            first(row,[
              "periodoLabel",
              "periodoCanonicoLabel",
              "periodo"
            ])
          );
        }
      );
    });

    return Object.keys(map)
      .sort()
      .map(function(periodoId){
        return map[periodoId];
      });
  }

  function ensurePeriod(row,period){
    row = Object.assign({},row || {});

    var periodoId = normalizePeriodId(
      first(row,[
        "periodoId",
        "periodoCanonicoId",
        "idPeriodo",
        "periodId",
        "PeriodoId"
      ]) || period.id
    );

    var periodoLabel = text(
      first(row,[
        "periodoLabel",
        "periodoCanonicoLabel",
        "periodo",
        "Periodo"
      ]) ||
      period.label ||
      periodoId
    );

    row.periodoId = periodoId;
    row.periodoCanonicoId = periodoId;
    row.periodoLabel = periodoLabel;
    row.periodoCanonicoLabel =
      periodoLabel;

    row.updatedAt = text(
      row.updatedAt ||
      row.fechaActualizacion ||
      row.fechaRegistro ||
      row.createdAt
    );

    return row;
  }

  function changeCedula(row){
    var payload =
      row &&
      (
        row.payload ||
        row.data ||
        row.registro
      ) ||
      {};

    return normalizeCedula(
      row &&
      (
        row.cedula ||
        row.numeroIdentificacion
      ) ||
      payload.cedula ||
      payload.numeroIdentificacion
    );
  }

  function pendingCedulas(periodoId){
    if(
      !outbox() ||
      typeof outbox().list !== "function"
    ){
      return Promise.resolve({});
    }

    return outbox().list({
      periodoId:periodoId
    }).then(function(rows){
      var map = {};

      (rows || []).forEach(function(row){
        var cedula = changeCedula(row);

        if(!cedula){
          return;
        }

        var open = [
          "google",
          "firebase",
          "supabase"
        ].some(function(target){
          return (
            typeof outbox().isDone !==
            "function" ||
            !outbox().isDone(row,target)
          );
        });

        if(open){
          map[cedula] = true;
        }
      });

      return map;
    }).catch(function(){
      return {};
    });
  }

  function buildDivisions(rows,period){
    var byPeriod = {};

    (rows || []).forEach(function(source){
      var row = ensurePeriod(
        source,
        period
      );

      var divisionName = text(
        first(row,[
          "division",
          "Division",
          "División",
          "nombreDivision",
          "NombreDivision",
          "nivel",
          "Nivel"
        ])
      );

      if(!row.periodoId || !divisionName){
        return;
      }

      var divisionId = key(divisionName);

      if(!byPeriod[row.periodoId]){
        byPeriod[row.periodoId] = {};
      }

      if(
        !byPeriod[row.periodoId][divisionId]
      ){
        byPeriod[row.periodoId][divisionId] = {
          id:divisionId,
          nombre:divisionName,
          carreras:[],
          updatedAt:now()
        };
      }

      var nombre = text(
        first(row,[
          "NombreCarrera",
          "nombreCarrera",
          "Carrera",
          "carrera"
        ])
      );

      var codigo = text(
        first(row,[
          "CodigoCarrera",
          "codigoCarrera",
          "CódigoCarrera"
        ])
      );

      if(nombre || codigo){
        byPeriod[row.periodoId][divisionId]
          .carreras.push({
            id:codigo || key(nombre),
            codigo:codigo,
            nombre:nombre || codigo
          });
      }
    });

    Object.keys(byPeriod).forEach(
      function(periodoId){
        Object.keys(
          byPeriod[periodoId]
        ).forEach(function(divisionId){
          var unique = {};

          byPeriod[periodoId][divisionId]
            .carreras.forEach(
              function(career){
                unique[career.id] = career;
              }
            );

          byPeriod[periodoId][divisionId]
            .carreras = Object.keys(unique)
              .map(function(id){
                return unique[id];
              });
        });
      }
    );

    return byPeriod;
  }

  function saveDivisions(divisions,period){
    var saved = readJson(
      LS_DIVISIONES,
      {}
    );

    var localPeriods = readJson(
      LS_PERIODOS,
      []
    );

    if(
      !saved ||
      typeof saved !== "object" ||
      Array.isArray(saved)
    ){
      saved = {};
    }

    if(!Array.isArray(localPeriods)){
      localPeriods = [];
    }

    var count = 0;
    var chain = Promise.resolve();

    Object.keys(divisions || {})
      .forEach(function(periodoId){
        var rows = Object.keys(
          divisions[periodoId]
        ).map(function(id){
          return divisions[periodoId][id];
        });

        count += rows.length;

        saved[periodoId] = {
          periodoId:periodoId,
          divisiones:rows,
          updatedAt:now(),
          source:"GoogleSheetsPullSafe"
        };

        var found = false;

        localPeriods = localPeriods.map(
          function(item){
            var currentId =
              normalizePeriodId(
                item.periodoId ||
                item.id
              );

            if(currentId !== periodoId){
              return item;
            }

            found = true;

            return Object.assign({},item,{
              id:periodoId,
              periodoId:periodoId,
              divisiones:rows,
              updatedAt:now()
            });
          }
        );

        if(!found){
          localPeriods.push({
            id:periodoId,
            periodoId:periodoId,
            label:period.label,
            periodoLabel:period.label,
            divisiones:rows,
            updatedAt:now()
          });
        }

        if(
          core() &&
          typeof core().savePeriod === "function"
        ){
          chain = chain.then(function(){
            return core().savePeriod({
              id:periodoId,
              periodoId:periodoId,
              label:
                periodoId === period.id
                  ? period.label
                  : periodoId,
              periodoLabel:
                periodoId === period.id
                  ? period.label
                  : periodoId,
              divisiones:rows,
              updatedAt:now()
            });
          });
        }
      });

    writeJson(LS_DIVISIONES,saved);
    writeJson(LS_PERIODOS,localPeriods);

    try{
      if(
        window.BLDivisionesService &&
        typeof window.BLDivisionesService.invalidate ===
        "function"
      ){
        window.BLDivisionesService.invalidate();
      }
    }catch(error){}

    return chain.then(function(){
      return count;
    });
  }

  function stableRowId(table,row,period){
    var existing = text(
      row.id ||
      row.key ||
      row.registroId
    );

    if(existing){
      return existing;
    }

    var cedula = normalizeCedula(
      first(row,[
        "cedula",
        "numeroIdentificacion",
        "NumeroIdentificacion",
        "Cédula",
        "Cedula"
      ])
    );

    var periodoId = normalizePeriodId(
      first(row,[
        "periodoId",
        "periodoCanonicoId",
        "idPeriodo",
        "periodId"
      ]) || period.id
    );

    if(table === "notas"){
      return (
        (cedula || "sin_cedula") +
        "__" +
        periodoId
      );
    }

    if(table === "requisitos"){
      var requirement = key(
        first(row,[
          "requisitoKey",
          "requisito",
          "Requisito",
          "nombre",
          "campo",
          "key"
        ]) || hash(row)
      );

      return (
        (cedula || "sin_cedula") +
        "__" +
        periodoId +
        "__" +
        requirement
      );
    }

    if(table === "contactos"){
      var kind = key(
        first(row,[
          "tipoKey",
          "tipo",
          "Tipo",
          "campo"
        ]) || "contacto"
      );

      return (
        (cedula || "sin_cedula") +
        "__" +
        periodoId +
        "__" +
        kind
      );
    }

    return (
      table +
      "__" +
      periodoId +
      "__" +
      (cedula || hash(row))
    );
  }

  function remoteStudents(tables,period){
    var source =
      (tables.estudiantes || [])
        .concat(
          tables.matriculasPeriodo || []
        );

    var map = {};

    source.forEach(function(item){
      var row = ensurePeriod(
        item,
        period
      );

      var cedula = normalizeCedula(
        first(row,[
          "cedula",
          "numeroIdentificacion",
          "NumeroIdentificacion",
          "Cédula",
          "Cedula"
        ])
      );

      if(
        !cedula ||
        row.periodoId !== period.id
      ){
        return;
      }

      row.cedula = cedula;
      row.numeroIdentificacion =
        row.numeroIdentificacion ||
        cedula;

      row.source =
        "google_sheets_pull";

      var current = map[cedula];

      if(!current){
        map[cedula] = row;
        return;
      }

      if(timestamp(row) >= timestamp(current)){
        map[cedula] =
          mergeNonEmpty(current,row);
      }else{
        map[cedula] =
          mergeNonEmpty(row,current);
      }

      map[cedula].updatedAt =
        timestamp(row) >= timestamp(current)
          ? row.updatedAt ||
            current.updatedAt
          : current.updatedAt ||
            row.updatedAt;
    });

    return Object.keys(map)
      .map(function(cedula){
        return map[cedula];
      });
  }

  function planStudents(
    tables,
    period,
    pendingMap,
    summary
  ){
    var remote =
      remoteStudents(tables,period);

    summary.duplicatesIgnored =
      Math.max(
        0,
        (tables.estudiantes || []).length +
        (tables.matriculasPeriodo || []).length -
        remote.length
      );

    return core().getStudents({
      periodoId:period.id
    }).catch(function(){
      return [];
    }).then(function(localRows){
      var localMap = {};

      (localRows || []).forEach(
        function(row){
          var cedula = normalizeCedula(
            row.cedula ||
            row.numeroIdentificacion
          );

          if(cedula){
            localMap[cedula] = row;
          }
        }
      );

      var apply = [];

      remote.forEach(function(row){
        var cedula = row.cedula;
        var local = localMap[cedula];

        if(pendingMap[cedula]){
          summary.protectedLocal += 1;
          return;
        }

        if(!local){
          row.updatedAt =
            row.updatedAt ||
            now();

          apply.push(row);
          return;
        }

        var remoteTime = timestamp(row);
        var localTime = timestamp(local);

        if(!remoteTime){
          summary.ambiguous += 1;
          return;
        }

        if(localTime > remoteTime){
          summary.localNewer += 1;
          return;
        }

        var merged =
          mergeNonEmpty(local,row);

        merged.cedula = cedula;

        merged.numeroIdentificacion =
          merged.numeroIdentificacion ||
          cedula;

        merged.periodoId = period.id;

        merged.periodoLabel =
          merged.periodoLabel ||
          period.label;

        merged.updatedAt =
          row.updatedAt ||
          local.updatedAt ||
          now();

        merged.source =
          "google_sheets_pull";

        apply.push(merged);
      });

      return apply;
    });
  }

  function saveRawBusinessTable(
    table,
    rows,
    period,
    pendingMap,
    summary
  ){
    if(
      !db() ||
      typeof db().bulkPut !== "function"
    ){
      return Promise.resolve(0);
    }

    var storeName =
      table === "requisitos"
        ? stores().requisitos || "requisitos"
        : table === "contactos"
          ? stores().contactos || "contactos"
          : stores().notas || "notas";

    var map = {};

    (rows || []).forEach(function(source){
      var row = ensurePeriod(
        source,
        period
      );

      if(row.periodoId !== period.id){
        return;
      }

      row.cedula = normalizeCedula(
        first(row,[
          "cedula",
          "numeroIdentificacion",
          "NumeroIdentificacion",
          "Cédula",
          "Cedula"
        ])
      );

      if(
        !row.cedula ||
        pendingMap[row.cedula]
      ){
        if(
          row.cedula &&
          pendingMap[row.cedula]
        ){
          summary.protectedRelated += 1;
        }

        return;
      }

      row.numeroIdentificacion =
        row.numeroIdentificacion ||
        row.cedula;

      row.id = stableRowId(
        table,
        row,
        period
      );

      row.source =
        "google_sheets_pull";

      map[row.id] = map[row.id]
        ? mergeNonEmpty(map[row.id],row)
        : row;
    });

    var prepared = Object.keys(map)
      .map(function(id){
        return map[id];
      });

    if(!prepared.length){
      return Promise.resolve(0);
    }

    return Promise.all(
      prepared.map(function(remote){
        return db().get(
          storeName,
          remote.id
        ).catch(function(){
          return null;
        }).then(function(local){
          if(!local){
            remote.updatedAt =
              remote.updatedAt ||
              now();

            return remote;
          }

          var remoteTime =
            timestamp(remote);

          var localTime =
            timestamp(local);

          if(!remoteTime){
            summary.ambiguousRelated += 1;
            return null;
          }

          if(localTime > remoteTime){
            summary.localNewerRelated += 1;
            return null;
          }

          var merged =
            mergeNonEmpty(local,remote);

          merged.id = remote.id;
          merged.cedula = remote.cedula;
          merged.periodoId = period.id;

          merged.updatedAt =
            remote.updatedAt ||
            local.updatedAt ||
            now();

          merged.source =
            "google_sheets_pull";

          return merged;
        });
      })
    ).then(function(items){
      items = items.filter(Boolean);

      if(!items.length){
        return 0;
      }

      return db().bulkPut(
        storeName,
        items
      ).then(function(result){
        return (result || []).length;
      });
    });
  }

  function markImportedChanges(changes){
    changes = Array.isArray(changes)
      ? changes
      : [];

    if(!changes.length){
      return Promise.resolve();
    }

    if(
      outbox() &&
      typeof outbox().markSynced === "function"
    ){
      var chain = Promise.resolve();

      [
        "google",
        "firebase",
        "supabase"
      ].forEach(function(target){
        chain = chain.then(function(){
          return outbox().markSynced(
            changes,
            target,
            {
              syncedAt:now(),
              source:"google_sheets_pull",
              imported:true
            }
          );
        });
      });

      return chain;
    }

    if(
      sync() &&
      typeof sync().markChanges === "function"
    ){
      return Promise.all(
        [
          "google",
          "firebase",
          "supabase"
        ].map(function(target){
          return sync().markChanges(
            changes,
            target,
            "SINCRONIZADO",
            {
              source:"google_sheets_pull",
              imported:true
            }
          );
        })
      );
    }

    return Promise.resolve();
  }

  function createSafetyBackup(period){
    var backup =
      window.BL2BackupV2 ||
      window.BL2Backup;

    return (
      backup &&
      typeof backup.createBackup ===
      "function"
    )
      ? backup.createBackup({
          scope:"period",
          periodoId:period.id,
          periodoLabel:period.label,
          type:"pre_google_sheets_pull"
        })
      : Promise.reject(
          new Error(
            "No se pudo crear el respaldo de seguridad."
          )
        );
  }

  function saveStudents(
    students,
    period,
    summary
  ){
    if(!students.length){
      return Promise.resolve();
    }

    return core().saveStudents(
      students,
      {
        normalized:false,
        periodoId:period.id,
        periodoLabel:period.label,
        source:"google_sheets_pull",
        markRetired:false,
        sync:false,
        localOnly:true,
        cloudSync:false,
        manualCloudSync:true,
        importResult:{
          advertencias:[],
          errores:[],
          duplicados:
            summary.duplicatesIgnored
        }
      }
    ).then(function(result){
      summary.guardados += Number(
        result.guardados || 0
      );

      summary.actualizados += Number(
        result.actualizados || 0
      );

      summary.sinCambios += Number(
        result.sinCambios || 0
      );

      summary.duplicados += Number(
        result.duplicados || 0
      );

      return markImportedChanges(
        result.changes
      );
    });
  }

  function createSummary(period){
    return {
      ok:true,
      periodoId:period.id,
      periodoLabel:period.label,
      totalEntrada:0,
      aplicables:0,
      guardados:0,
      actualizados:0,
      sinCambios:0,
      duplicados:0,
      duplicatesIgnored:0,
      protectedLocal:0,
      localNewer:0,
      ambiguous:0,
      protectedRelated:0,
      localNewerRelated:0,
      ambiguousRelated:0,
      divisionesImportadas:0,
      rawTables:{},
      importedTables:{},
      ignoredTables:{},
      startedAt:now(),
      finishedAt:"",
      message:""
    };
  }

  function pullSheetsToLocal(period,options){
    options = options || {};

    if(
      (pulling || pullingAll) &&
      !options.fromAll
    ){
      return Promise.resolve({
        ok:false,
        blocked:true,
        message:
          "Ya existe una descarga de Google Sheets en curso."
      });
    }

    if(!period || !text(period.id)){
      return Promise.reject(
        new Error(
          "Seleccione un período para traer Google Sheets."
        )
      );
    }

    if(
      !core() ||
      typeof core().saveStudents !==
      "function"
    ){
      return Promise.reject(
        new Error(
          "BL2Core.saveStudents no está disponible."
        )
      );
    }

    period = {
      id:normalizePeriodId(period.id),
      label:text(
        period.label ||
        period.id
      )
    };

    var cfg = requireSheetsConfig();
    var summary = createSummary(period);

    pauseOutbound(period);

    if(!options.fromAll){
      setBusy(true);
    }

    progress(
      options.fromAll
        ? Number(options.progressStart || 5)
        : 5,
      "Creando respaldo antes de traer " +
      period.label +
      "..."
    );

    return createSafetyBackup(period)
      .then(function(backup){
        summary.safetyBackupId =
          backup &&
          backup.record &&
          backup.record.id ||
          "";

        return syncSheetsConfigToBL2(cfg);
      })
      .then(function(){
        progress(
          options.fromAll
            ? Number(options.progressStart || 10)
            : 15,
          "Leyendo Google Sheets del período " +
          period.label +
          "..."
        );

        return Promise.all([
          requestPull(cfg,period),
          pendingCedulas(period.id)
        ]);
      })
      .then(function(values){
        var tables = extractTables(values[0]);
        var pendingMap = values[1] || {};
        var names = Object.keys(tables);

        if(!names.length){
          throw new Error(
            "Apps Script no devolvió tablas para importar."
          );
        }

        names.forEach(function(name){
          summary.rawTables[name] =
            (tables[name] || []).length;

          if(ALLOWED_TABLES[name]){
            summary.importedTables[name] =
              (tables[name] || []).length;
          }else{
            summary.ignoredTables[name] =
              (tables[name] || []).length;
          }
        });

        Object.keys(
          TECHNICAL_TABLES
        ).forEach(function(name){
          if(tables[name]){
            delete tables[name];
          }
        });

        summary.totalEntrada =
          (tables.estudiantes || []).length +
          (tables.matriculasPeriodo || []).length;

        var chain = Promise.resolve();

        if(
          core() &&
          typeof core().savePeriod ===
          "function"
        ){
          chain = chain.then(function(){
            return core().savePeriod({
              id:period.id,
              periodoId:period.id,
              label:period.label,
              periodoLabel:period.label,
              updatedAt:now(),
              source:"google_sheets_pull"
            });
          });
        }

        chain = chain.then(function(){
          return saveDivisions(
            buildDivisions(
              tables.periodosDivisiones || [],
              period
            ),
            period
          ).then(function(count){
            summary.divisionesImportadas =
              count;
          });
        });

        chain = chain.then(function(){
          return planStudents(
            tables,
            period,
            pendingMap,
            summary
          );
        }).then(function(students){
          summary.aplicables =
            students.length;

          progress(
            options.fromAll
              ? Number(options.progressEnd || 80)
              : 55,
            "Guardando cambios seguros de " +
            period.label +
            "..."
          );

          return saveStudents(
            students,
            period,
            summary
          );
        });

        [
          "requisitos",
          "contactos",
          "notas"
        ].forEach(function(table){
          chain = chain.then(function(){
            var rows = tables[table] || [];

            if(!rows.length){
              return null;
            }

            return saveRawBusinessTable(
              table,
              rows,
              period,
              pendingMap,
              summary
            ).then(function(count){
              summary.guardados += count;
            });
          });
        });

        return chain;
      })
      .then(function(){
        summary.finishedAt = now();

        summary.message =
          "Período " +
          period.label +
          " importado de forma segura.";

        if(
          store() &&
          typeof store().patchConfig ===
          "function"
        ){
          store().patchConfig({
            sheets:{
              connected:true,
              status:"ok",
              lastSyncAt:now(),
              lastError:"",
              lastPullPeriodId:
                period.id
            },
            bdlocal:{
              connected:true,
              status:"ok",
              lastTestAt:now()
            }
          });
        }

        if(!options.fromAll){
          progress(100,summary.message);

          setStatus(
            "bl2-google-status",
            "Importado: " +
            new Date().toLocaleString()
          );

          log(
            summary.message,
            "ok",
            summary
          );

          emitFinished(summary);
        }

        if(
          !options.skipRefresh &&
          window.BL2App &&
          typeof window.BL2App.refresh ===
          "function"
        ){
          return window.BL2App.refresh({
            force:true,
            reason:"google-period-pull"
          }).catch(function(){
            return null;
          }).then(function(){
            return summary;
          });
        }

        return summary;
      })
      .catch(function(error){
        if(
          store() &&
          typeof store().updateConnectionStatus ===
          "function"
        ){
          store().updateConnectionStatus(
            "sheets",
            {
              connected:false,
              status:"error",
              lastError:
                error.message ||
                String(error)
            }
          );
        }

        if(!options.fromAll){
          progress(
            0,
            "Error al traer Google Sheets."
          );
        }

        log(
          error.message ||
          String(error),
          "error"
        );

        throw error;
      })
      .finally(function(){
        resumeOutbound();

        if(!options.fromAll){
          setBusy(false);
        }
      });
  }

  function aggregateSummaries(results){
    var summary = {
      ok:true,
      scope:"all",
      periodosProcesados:results.length,
      totalEntrada:0,
      aplicables:0,
      guardados:0,
      actualizados:0,
      sinCambios:0,
      duplicados:0,
      protegidos:0,
      divisionesImportadas:0,
      startedAt:
        results.length
          ? results[0].startedAt
          : now(),
      finishedAt:now(),
      periods:results,
      message:""
    };

    results.forEach(function(item){
      summary.totalEntrada += Number(
        item.totalEntrada || 0
      );

      summary.aplicables += Number(
        item.aplicables || 0
      );

      summary.guardados += Number(
        item.guardados || 0
      );

      summary.actualizados += Number(
        item.actualizados || 0
      );

      summary.sinCambios += Number(
        item.sinCambios || 0
      );

      summary.duplicados += Number(
        item.duplicados || 0
      );

      summary.protegidos +=
        Number(item.protectedLocal || 0) +
        Number(item.localNewer || 0) +
        Number(item.ambiguous || 0) +
        Number(item.protectedRelated || 0) +
        Number(item.localNewerRelated || 0) +
        Number(item.ambiguousRelated || 0);

      summary.divisionesImportadas += Number(
        item.divisionesImportadas || 0
      );
    });

    summary.message =
      "Google Sheets → Base Local completado: " +
      summary.periodosProcesados +
      " período(s) procesado(s).";

    return summary;
  }

  function pullAllSheetsToLocal(options){
    options = options || {};

    if(pulling || pullingAll){
      return Promise.resolve({
        ok:false,
        blocked:true,
        message:
          "Ya existe una descarga externa en curso."
      });
    }

    var cfg = requireSheetsConfig();
    var periods = [];
    var results = [];

    pullingAll = true;
    setBusy(true);

    progress(
      3,
      "Consultando períodos remotos de Google Sheets..."
    );

    return syncSheetsConfigToBL2(cfg)
      .then(function(){
        return requestRemotePeriods(cfg);
      })
      .then(function(response){
        periods = remotePeriods(response);

        if(!periods.length){
          throw new Error(
            "Google Sheets no devolvió períodos. El Apps Script debe admitir pull_bl2 con scope: periods."
          );
        }

        if(
          options.confirm !== false &&
          !window.confirm(
            "Google Sheets → Base Local\n\n" +
            "Se detectaron " +
            periods.length +
            " período(s).\n\n" +
            "Se crearán respaldos y se protegerán cambios locales. ¿Continuar?"
          )
        ){
          return {
            cancelled:true
          };
        }

        var chain = Promise.resolve();

        periods.forEach(function(period,index){
          chain = chain.then(function(){
            var start =
              10 +
              Math.round(
                index /
                Math.max(1,periods.length) *
                75
              );

            var end =
              10 +
              Math.round(
                (index + 1) /
                Math.max(1,periods.length) *
                75
              );

            progress(
              start,
              "Procesando período " +
              (index + 1) +
              " de " +
              periods.length +
              ": " +
              period.label
            );

            return pullSheetsToLocal(
              period,
              {
                fromAll:true,
                skipRefresh:true,
                progressStart:start,
                progressEnd:end
              }
            ).then(function(result){
              results.push(result);
            });
          });

          return chain;
        });

        return chain.then(function(){
          return aggregateSummaries(results);
        });
      })
      .then(function(summary){
        if(summary && summary.cancelled){
          return {
            ok:true,
            cancelled:true,
            message:"Operación cancelada."
          };
        }

        if(
          store() &&
          typeof store().patchConfig ===
          "function"
        ){
          store().patchConfig({
            sheets:{
              connected:true,
              status:"ok",
              lastSyncAt:now(),
              lastPullScope:"all",
              lastPullPeriodCount:
                summary.periodosProcesados,
              lastError:""
            },
            bdlocal:{
              connected:true,
              status:"ok",
              lastTestAt:now()
            }
          });
        }

        progress(100,summary.message);

        setStatus(
          "bl2-google-status",
          "Todos los períodos importados: " +
          new Date().toLocaleString()
        );

        log(
          summary.message,
          "ok",
          summary
        );

        emitFinished(summary);

        if(
          window.BL2App &&
          typeof window.BL2App.refresh ===
          "function"
        ){
          return window.BL2App.refresh({
            force:true,
            reason:"google-all-pull"
          }).catch(function(){
            return null;
          }).then(function(){
            return summary;
          });
        }

        return summary;
      })
      .catch(function(error){
        progress(
          0,
          "Error al traer todos los períodos."
        );

        if(
          store() &&
          typeof store().updateConnectionStatus ===
          "function"
        ){
          store().updateConnectionStatus(
            "sheets",
            {
              connected:false,
              status:"error",
              lastError:
                error.message ||
                String(error)
            }
          );
        }

        log(
          error.message ||
          String(error),
          "error"
        );

        throw error;
      })
      .finally(function(){
        pullingAll = false;
        setBusy(false);
        resumeOutbound();
      });
  }

  function selectAndPull(){
    return choosePeriod()
      .then(function(period){
        if(
          !window.confirm(
            "Google Sheets → Base Local\n\n" +
            "Período: " +
            period.label +
            "\n\n" +
            "Se creará un respaldo y se protegerán cambios locales. ¿Continuar?"
          )
        ){
          return {
            ok:true,
            cancelled:true,
            message:"Operación cancelada."
          };
        }

        return pullSheetsToLocal(period);
      });
  }

  function forceFetchFirebaseConfig(){
    if(
      !store() ||
      typeof store().restoreConfigFromFirebase !==
      "function"
    ){
      return Promise.reject(
        new Error(
          "La restauración de configuración Firebase no está disponible."
        )
      );
    }

    if(
      manager() &&
      typeof manager().setupFirebaseConfigAdapter ===
      "function"
    ){
      try{
        manager().setupFirebaseConfigAdapter();
      }catch(error){}
    }

    return store()
      .restoreConfigFromFirebase()
      .then(function(result){
        if(!result || result.ok === false){
          throw new Error(
            result &&
            result.message ||
            "Firebase no devolvió configuración."
          );
        }

        return syncSheetsConfigToBL2(
          store().getSheetsConfig({
            includeSecret:true
          })
        ).then(function(){
          return {
            ok:true,
            message:
              "Configuración Firebase aplicada localmente."
          };
        });
      });
  }

  function cleanSheetsDuplicates(){
    var cfg = requireSheetsConfig();

    return requestCompact(cfg)
      .then(function(result){
        if(
          store() &&
          typeof store().patchConfig ===
          "function"
        ){
          store().patchConfig({
            sheets:{
              connected:true,
              status:"ok",
              lastSyncAt:now(),
              lastError:""
            }
          });
        }

        return Object.assign({
          ok:true,
          message:
            "Duplicados de Google Sheets compactados."
        },result || {});
      });
  }

  function firebaseGuard(){
    return window.BL2FirebaseGuard || null;
  }

  function pullFirebasePeriod(){
    var period = selectedPeriod();
    var guard = firebaseGuard();

    if(!period || !period.id){
      return Promise.reject(
        new Error(
          "Seleccione un período para traer Firebase."
        )
      );
    }

    if(
      !guard ||
      typeof guard.pullFirebaseToLocal !==
      "function"
    ){
      return Promise.reject(
        new Error(
          "La descarga segura de Firebase todavía no está disponible."
        )
      );
    }

    return guard.pullFirebaseToLocal(
      period,
      {
        confirm:true,
        previewOnly:false
      }
    );
  }

  function pullFirebaseAll(){
    var guard = firebaseGuard();

    if(
      !guard ||
      typeof guard.pullAllFirebaseToLocal !==
      "function"
    ){
      return Promise.reject(
        new Error(
          "La descarga completa de Firebase todavía no está disponible."
        )
      );
    }

    return guard.pullAllFirebaseToLocal({
      confirm:true,
      previewOnly:false
    });
  }

  function bindButton(name,handler){
    var button = byId(name);

    if(
      !button ||
      button.__singleSafePullBound
    ){
      return;
    }

    button.__singleSafePullBound = true;

    button.setAttribute(
      "data-cloud-pull-owner",
      "safe"
    );

    button.addEventListener(
      "click",
      function(event){
        event.preventDefault();
        event.stopPropagation();

        if(
          typeof event.stopImmediatePropagation ===
          "function"
        ){
          event.stopImmediatePropagation();
        }

        handler().catch(function(error){
          if(
            error &&
            error.message ===
            "Operación cancelada."
          ){
            return;
          }

          log(
            error.message ||
            String(error),
            "error"
          );

          window.alert(
            error.message ||
            String(error)
          );
        });
      },
      true
    );
  }

  function bind(){
    bindButton(
      "bl2-btn-pull-sheets",
      function(){
        return selectAndPull()
          .then(function(result){
            if(
              result &&
              !result.cancelled
            ){
              window.alert(
                result.message +
                "\n\nFilas remotas: " +
                result.totalEntrada +
                "\nAplicables: " +
                result.aplicables +
                "\nProtegidos: " +
                (
                  result.protectedLocal +
                  result.localNewer +
                  result.ambiguous
                )
              );
            }

            return result;
          });
      }
    );

    bindButton(
      "bl2-btn-pull-sheets-all",
      function(){
        return pullAllSheetsToLocal({
          confirm:true
        }).then(function(result){
          if(
            result &&
            !result.cancelled
          ){
            window.alert(
              result.message +
              "\n\nPeríodos: " +
              result.periodosProcesados +
              "\nFilas remotas: " +
              result.totalEntrada +
              "\nAplicables: " +
              result.aplicables +
              "\nProtegidos: " +
              result.protegidos
            );
          }

          return result;
        });
      }
    );

    bindButton(
      "bl2-btn-pull-firebase",
      function(){
        return pullFirebasePeriod()
          .then(function(result){
            if(
              result &&
              !result.cancelled
            ){
              window.alert(
                result.message ||
                "Firebase procesado."
              );
            }

            return result;
          });
      }
    );

    bindButton(
      "bl2-btn-pull-firebase-all",
      function(){
        return pullFirebaseAll()
          .then(function(result){
            if(
              result &&
              !result.cancelled
            ){
              window.alert(
                result.message ||
                "Firebase procesado."
              );
            }

            return result;
          });
      }
    );

    bindButton(
      "bl2-btn-fetch-firebase-config",
      function(){
        return forceFetchFirebaseConfig()
          .then(function(result){
            window.alert(result.message);
            return result;
          });
      }
    );

    bindButton(
      "bl2-btn-clean-sheets-duplicates",
      function(){
        if(
          !window.confirm(
            "Compactar duplicados de Google Sheets sin borrar registros únicos. ¿Continuar?"
          )
        ){
          return Promise.resolve({
            cancelled:true
          });
        }

        return cleanSheetsDuplicates()
          .then(function(result){
            window.alert(result.message);
            return result;
          });
      }
    );
  }

  window.BL2CloudPullSafe = {
    version:VERSION,
    singleImplementation:true,
    supportsAllPeriods:true,
    allowedTables:
      Object.keys(ALLOWED_TABLES),
    technicalTablesIgnored:
      Object.keys(TECHNICAL_TABLES),
    forceFetchFirebaseConfig:
      forceFetchFirebaseConfig,
    pullSheetsToLocal:
      pullSheetsToLocal,
    pullAllSheetsToLocal:
      pullAllSheetsToLocal,
    selectAndPull:
      selectAndPull,
    cleanSheetsDuplicates:
      cleanSheetsDuplicates,
    syncSheetsConfigToBL2:
      syncSheetsConfigToBL2,
    extractTables:
      extractTables,
    remotePeriods:
      remotePeriods,
    buildDivisions:
      buildDivisions,
    pauseGooglePush:
      pauseOutbound,
    resumeGooglePush:
      resumeOutbound,
    isPulling:function(){
      return pulling || pullingAll;
    },
    bind:bind,
    diagnostics:{
      mergeNonEmpty:mergeNonEmpty,
      stableRowId:stableRowId,
      remoteStudents:remoteStudents,
      normalizeTableKey:
        normalizeTableKey,
      timestamp:timestamp
    }
  };

  window.addEventListener(
    "bdlocal:bl2-html-scripts-loaded",
    bind,
    { once:true }
  );

  if(
    !document.querySelector(
      "script[data-bl2-loader-src]"
    )
  ){
    if(document.readyState === "loading"){
      document.addEventListener(
        "DOMContentLoaded",
        bind,
        { once:true }
      );
    }else{
      bind();
    }
  }
})(window,document);