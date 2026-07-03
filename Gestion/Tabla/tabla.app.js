/* =========================================================
Nombre completo: tabla.app.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.app.js
Función o funciones:
- Renderizar la tabla principal de estudiantes.
- Mantener filtros rápidos por período, división, matrícula, carrera, estado y búsqueda.
- Mostrar activos por defecto.
- Paginar resultados para no renderizar toda la base.
- Usar TablaCore como motor de datos y caché.
- Cargar Telegram, historial, selección masiva y exportación solo cuando el usuario los usa.
- Evitar reconstruir el filtro período en cada render para que no parpadee ni se cierre.
- Refrescarse automáticamente cuando BDLocal actualiza el snapshot, limpiando caché.
Con qué se conecta:
- tabla.core.js
- tabla.message.js bajo demanda
- tabla.telegram-api.js bajo demanda
- tabla.history.js bajo demanda
- tabla.telegram.js bajo demanda
- tabla.selection.js bajo demanda
- tabla.mass.js bajo demanda
- tabla.export.js bajo demanda
========================================================= */
(function(window, document){
  "use strict";

  var state = {
    periodId:"",
    division:"",
    matricula:"ACTIVO",
    career:"",
    status:"",
    search:"",
    rows:[],
    allRows:[],
    page:1,
    pageSize:100,
    pagination:null,
    renderTimer:null,
    refreshTimer:null,
    rendering:false,
    pendingRender:false,
    periodSelectKey:"",
    dependentSelectKey:"",
    divisionOptions:[],
    careerOptions:[],
    actionsBound:false,
    bdlocalBound:false,
    loading:{},
    loaded:{}
  };

  function el(id){
    return document.getElementById(id);
  }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function status(message, cls){
    var box = el("tabla-status");
    if(box){
      box.textContent = message;
      box.className = "tabla-status " + (cls || "");
    }
  }

  function option(value, label, selected){
    return '<option value="' + esc(value) + '" ' + (selected ? 'selected' : '') + '>' + esc(label) + '</option>';
  }

  function setText(id, value){
    var node = el(id);
    if(node){node.textContent = value;}
  }

  function sourceLabel(){
    return window.TablaCore && typeof window.TablaCore.source === "function" ? window.TablaCore.source() : "Base Local";
  }

  function periodId(item){
    item = item || {};
    if(typeof item !== "object"){return text(item);}
    return text(item.id || item.periodoId || item.periodId || item.value || item.key || item.codigo || item.label || item.periodoLabel || item.nombre || item.name);
  }

  function periodLabel(item){
    item = item || {};
    if(typeof item !== "object"){return text(item);}
    return text(item.label || item.periodoLabel || item.nombre || item.name || item.descripcion || item.id || item.periodoId || item.periodId || item.value || item.key);
  }

  function selectListKey(items){
    return (items || []).map(function(item){
      return periodId(item) + "::" + periodLabel(item);
    }).join("||");
  }

  function loadScript(src){
    if(state.loaded[src] || document.querySelector('script[data-tabla-lazy="' + src + '"]')){
      state.loaded[src] = true;
      return Promise.resolve();
    }

    if(state.loading[src]){return state.loading[src];}

    state.loading[src] = new Promise(function(resolve, reject){
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.setAttribute("data-tabla-lazy", src);
      script.onload = function(){
        state.loaded[src] = true;
        resolve();
      };
      script.onerror = function(){
        delete state.loading[src];
        reject(new Error("No se pudo cargar " + src));
      };
      document.body.appendChild(script);
    });

    return state.loading[src];
  }

  function loadScripts(list){
    return (list || []).reduce(function(promise, src){
      return promise.then(function(){return loadScript(src);});
    }, Promise.resolve());
  }

  function ensureTelegramIndividual(){
    return loadScripts([
      "tabla.message.js",
      "tabla.telegram-api.js",
      "tabla.history.js",
      "tabla.telegram.js"
    ]);
  }

  function ensureMass(){
    return loadScripts([
      "tabla.message.js",
      "tabla.telegram-api.js",
      "tabla.history.js",
      "tabla.selection.js",
      "tabla.mass.js"
    ]);
  }

  function ensureHistory(){
    return loadScripts(["tabla.history.js"]);
  }

  function ensureExport(){
    return loadScripts(["tabla.export.js"]);
  }

  function requestRender(resetPage){
    if(resetPage === true){state.page = 1;}
    if(state.renderTimer){clearTimeout(state.renderTimer);}
    state.renderTimer = setTimeout(function(){
      state.renderTimer = null;
      render();
    }, 0);
  }

  function debounceRender(){
    if(state.renderTimer){clearTimeout(state.renderTimer);}
    state.renderTimer = setTimeout(function(){
      state.renderTimer = null;
      state.page = 1;
      render();
    }, 260);
  }

  function fillPeriodSelect(){
    var select = el("tabla-periodo");
    var periods;
    var key;
    var currentExists;

    if(!select || !window.TablaCore || typeof window.TablaCore.periods !== "function"){
      return;
    }

    periods = window.TablaCore.periods() || [];
    key = sourceLabel() + "|" + selectListKey(periods);

    if(state.periodSelectKey !== key){
      select.innerHTML = option("", "Todos", !state.periodId) + periods.map(function(item){
        var id = periodId(item);
        return option(id, periodLabel(item) || id, state.periodId === id);
      }).join("");
      state.periodSelectKey = key;
    }

    currentExists = !state.periodId || periods.some(function(item){
      return periodId(item) === state.periodId;
    });

    if(!currentExists){
      state.periodId = "";
    }

    if(select.value !== state.periodId){
      select.value = state.periodId;
    }
  }

  function fillStaticSelects(){
    var matricula = el("tabla-matricula");
    var pageSize = el("tabla-page-size");

    if(matricula && matricula.value !== state.matricula){
      matricula.value = state.matricula;
    }

    if(pageSize && pageSize.value !== String(state.pageSize)){
      pageSize.value = String(state.pageSize);
    }
  }

  function fillDependentSelects(){
    var division = el("tabla-division");
    var career = el("tabla-carrera");
    var opts;
    var key;

    key = [
      sourceLabel(),
      state.periodId,
      state.matricula,
      state.division
    ].join("|");

    if(state.dependentSelectKey !== key){
      if(window.TablaCore && typeof window.TablaCore.options === "function"){
        opts = window.TablaCore.options({
          periodId:state.periodId,
          matricula:state.matricula,
          division:state.division
        });
      }

      if(opts){
        state.divisionOptions = opts.divisions || [];
        state.careerOptions = opts.careers || [];
      }else if(window.TablaCore){
        state.divisionOptions = typeof window.TablaCore.divisions === "function" ? window.TablaCore.divisions(null, {
          periodId:state.periodId,
          matricula:state.matricula
        }) || [] : [];
        state.careerOptions = typeof window.TablaCore.careers === "function" ? window.TablaCore.careers(window.TablaCore.filter({
          periodId:state.periodId,
          matricula:state.matricula,
          division:state.division,
          search:"",
          status:""
        })) || [] : [];
      }

      state.dependentSelectKey = key;
    }

    if(state.division && state.divisionOptions.indexOf(state.division) < 0){
      state.division = "";
      state.career = "";
      state.dependentSelectKey = "";
      return fillDependentSelects();
    }

    if(state.career && state.careerOptions.indexOf(state.career) < 0){
      state.career = "";
    }

    if(division){
      division.innerHTML = option("", "Todas", !state.division) + state.divisionOptions.map(function(item){
        return option(item, item, state.division === item);
      }).join("");
      division.value = state.division;
    }

    if(career){
      career.innerHTML = option("", "Todas", !state.career) + state.careerOptions.map(function(item){
        return option(item, item, state.career === item);
      }).join("");
      career.value = state.career;
    }
  }

  function fillSelects(){
    fillPeriodSelect();
    fillStaticSelects();
    fillDependentSelects();
  }

  function pill(row){
    var estado = row._estadoGeneral || {id:"pendiente", label:"Pendiente"};
    var cls = estado.id === "cumple" ? "pill-ok" : (estado.id === "no_cumple" ? "pill-bad" : "pill-warn");
    return '<span class="pill ' + cls + '">' + esc(estado.label) + '</span>';
  }

  function matriculaPill(row){
    var estado = row._estadoMatricula || "ACTIVO";
    var cls = estado === "RETIRADO" ? "pill-bad" : "pill-ok";
    return '<span class="pill ' + cls + '">' + esc(estado) + '</span>';
  }

  function actions(row, index){
    var whatsapp = window.TablaCore.whatsappUrl(row);
    var telegram = window.TablaCore.telegramInfo ? window.TablaCore.telegramInfo(row) : {hasTelegram:false, canSendByBot:false};
    var telegramTitle = telegram.canSendByBot ? "Telegram listo para envío por bot" : (telegram.hasTelegram ? "Abrir Telegram y copiar mensaje" : "Sin Telegram: preparar mensaje");
    var btnCopy = '<button class="icon-btn" data-copy="' + esc(row._cedula) + '" type="button" title="Copiar cédula" aria-label="Copiar cédula">📋</button>';
    var btnWhats = whatsapp
      ? '<a class="icon-btn action-whats" href="' + esc(whatsapp) + '" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp">🟢</a>'
      : '<button class="icon-btn" type="button" disabled title="Sin celular" aria-label="Sin celular">🟢</button>';
    var btnTelegram = '<button class="icon-btn action-telegram ' + (telegram.hasTelegram ? '' : 'is-muted') + '" data-telegram-index="' + esc(index) + '" type="button" title="' + esc(telegramTitle) + '" aria-label="Telegram">✈️</button>';

    return '<div class="cell-actions">' + btnCopy + btnWhats + btnTelegram + '</div>';
  }

  function bindActionsOnce(){
    var wrap = el("tabla-table-wrap");
    if(!wrap || state.actionsBound){return;}

    wrap.addEventListener("click", function(event){
      var target = event.target;
      var copyBtn = target && target.closest ? target.closest("[data-copy]") : null;
      var telegramBtn;
      var index;
      var row;

      if(copyBtn){
        var value = copyBtn.getAttribute("data-copy") || "";
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(value);
        }
        status("Cédula copiada: " + value, "ok");
        return;
      }

      telegramBtn = target && target.closest ? target.closest("[data-telegram-index]") : null;
      if(telegramBtn){
        index = Number(telegramBtn.getAttribute("data-telegram-index"));
        row = state.rows[index];

        if(!row){
          status("No se encontró el estudiante seleccionado.", "warn");
          return;
        }

        status("Preparando Telegram individual...", "warn");
        ensureTelegramIndividual().then(function(){
          if(window.TablaTelegram && typeof window.TablaTelegram.abrir === "function"){
            window.TablaTelegram.abrir(row);
          }else{
            status("No se pudo abrir Telegram para este estudiante.", "warn");
          }
        }).catch(function(error){
          console.error("[Tabla] Telegram individual", error);
          status(error.message || String(error), "warn");
        });
      }
    });

    state.actionsBound = true;
  }

  function renderTable(rows){
    var wrap = el("tabla-table-wrap");
    var html;

    if(!wrap){return;}
    bindActionsOnce();

    if(!rows.length){
      wrap.innerHTML = '<div class="empty">Sin datos. Primero carga un Excel en Carga o cambia los filtros.</div>';
      return;
    }

    html = '<table><thead><tr>' +
      '<th>Cédula</th>' +
      '<th>Nombre</th>' +
      '<th>Carrera</th>' +
      '<th>División</th>' +
      '<th>Período</th>' +
      '<th>Matrícula</th>' +
      '<th>Estado</th>' +
      '<th>Correo</th>' +
      '<th>Celular</th>' +
      '<th>Acciones</th>' +
    '</tr></thead><tbody>';

    html += rows.map(function(row, index){
      return '<tr>' +
        '<td class="nowrap">' + esc(row._cedula) + '</td>' +
        '<td>' + esc(row._nombres) + '</td>' +
        '<td>' + esc(row._carrera) + '</td>' +
        '<td>' + esc(row._division || 'Sin división') + '</td>' +
        '<td>' + esc(row._periodo || row.periodoLabel || row.periodoId) + '</td>' +
        '<td>' + matriculaPill(row) + '</td>' +
        '<td>' + pill(row) + '</td>' +
        '<td>' + esc(row._correo) + '</td>' +
        '<td class="nowrap">' + esc(row._celular) + '</td>' +
        '<td>' + actions(row, index) + '</td>' +
      '</tr>';
    }).join("");

    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function updatePagination(pagination){
    state.pagination = pagination || {
      page:1,
      pages:1,
      total:0,
      label:"0 registros",
      hasPrev:false,
      hasNext:false
    };

    setText("tabla-count-text", state.pagination.total + " registro(s) filtrados");
    setText("tabla-page-text", "Página " + state.pagination.page + " de " + state.pagination.pages);
    setText("tabla-page-label", state.pagination.label);

    [
      ["tabla-page-first", !state.pagination.hasPrev],
      ["tabla-page-prev", !state.pagination.hasPrev],
      ["tabla-page-next", !state.pagination.hasNext],
      ["tabla-page-last", !state.pagination.hasNext]
    ].forEach(function(pair){
      var button = el(pair[0]);
      if(button){button.disabled = !!pair[1];}
    });
  }

  function render(){
    var result;
    var sum;

    if(state.rendering){
      state.pendingRender = true;
      return;
    }

    state.rendering = true;

    try{
      if(!window.TablaCore || typeof window.TablaCore.page !== "function"){
        throw new Error("TablaCore no disponible.");
      }

      fillSelects();

      result = window.TablaCore.page({
        periodId:state.periodId,
        division:state.division,
        matricula:state.matricula,
        career:state.career,
        status:state.status,
        search:state.search,
        page:state.page,
        pageSize:state.pageSize
      });

      state.rows = result.rows || [];
      state.allRows = result.allRows || [];

      sum = result.summary || window.TablaCore.summary(state.allRows);
      setText("tabla-kpi-total", sum.total || 0);
      setText("tabla-kpi-ok", sum.cumple || 0);
      setText("tabla-kpi-pend", sum.pendiente || 0);
      setText("tabla-kpi-no", sum.no_cumple || 0);
      setText("tabla-kpi-carreras", sum.carreras || 0);

      updatePagination(result.pagination);
      renderTable(state.rows);

      status(
        "Tabla cargada por " + (result.source || sourceLabel()) +
        ". Página " + state.pagination.page + " de " + state.pagination.pages +
        ". Matrícula: " + (state.matricula || "Todos") + ".",
        "ok"
      );
    }catch(error){
      console.error("[Tabla]", error);
      status(error.message || String(error), "warn");
    }finally{
      state.rendering = false;
      if(state.pendingRender){
        state.pendingRender = false;
        requestRender(false);
      }
    }
  }

  function resetDependentOptions(){
    state.division = "";
    state.career = "";
    state.page = 1;
    state.dependentSelectKey = "";
  }

  function refreshFromBDLocal(){
    if(state.refreshTimer){clearTimeout(state.refreshTimer);}

    state.refreshTimer = setTimeout(function(){
      state.refreshTimer = null;

      if(window.TablaCore && typeof window.TablaCore.clearCache === "function"){
        window.TablaCore.clearCache();
      }

      state.periodSelectKey = "";
      state.dependentSelectKey = "";
      requestRender(false);
    }, 220);
  }

  function massFilters(){
    return {
      periodId:state.periodId,
      division:state.division,
      matricula:state.matricula,
      career:state.career,
      status:state.status,
      search:state.search,
      total:state.allRows.length
    };
  }

  function openMass(){
    var rows = state.allRows.length ? state.allRows : state.rows;

    if(!rows.length){
      status("No hay estudiantes filtrados para Telegram masivo.", "warn");
      return;
    }

    status("Preparando Telegram masivo...", "warn");
    ensureMass().then(function(){
      if(window.TablaMass && typeof window.TablaMass.abrir === "function"){
        window.TablaMass.abrir(rows, massFilters());
      }else{
        status("Módulo de Telegram masivo no disponible.", "warn");
      }
    }).catch(function(error){
      console.error("[Tabla] Telegram masivo", error);
      status(error.message || String(error), "warn");
    });
  }

  function exportRows(type){
    var rows = state.allRows.length ? state.allRows : state.rows;

    if(!rows.length){
      status("No hay datos para exportar.", "warn");
      return;
    }

    status("Preparando exportación...", "warn");
    ensureExport().then(function(){
      if(!window.TablaExport){
        status("Módulo de exportación no disponible.", "warn");
        return;
      }

      if(type === "json" && typeof window.TablaExport.exportJson === "function"){
        window.TablaExport.exportJson(rows);
      }else if(typeof window.TablaExport.exportCsv === "function"){
        window.TablaExport.exportCsv(rows);
      }

      status("Exportación generada con " + rows.length + " registro(s).", "ok");
    }).catch(function(error){
      console.error("[Tabla] Export", error);
      status(error.message || String(error), "warn");
    });
  }

  function safeBind(id, eventName, handler){
    var node = el(id);
    if(node){node.addEventListener(eventName, handler);}
  }

  function bindBDLocalEvents(){
    if(state.bdlocalBound){return;}

    window.addEventListener("bdlocal:legacy-ready", refreshFromBDLocal);
    window.addEventListener("bdlocal:legacy-snapshot", refreshFromBDLocal);
    window.addEventListener("requisitos:bl:snapshot-changed", refreshFromBDLocal);

    window.addEventListener("storage", function(event){
      if(event && (
        event.key === "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1" ||
        event.key === "REQ_EXCEL_LOCAL_V1:snapshot" ||
        event.key === "REQ_BL_SIGNAL_V1"
      )){
        refreshFromBDLocal();
      }
    });

    state.bdlocalBound = true;
  }

  function bind(){
    safeBind("tabla-periodo", "change", function(event){
      state.periodId = event.target.value;
      resetDependentOptions();
      requestRender(false);
    });

    safeBind("tabla-division", "change", function(event){
      state.division = event.target.value;
      state.career = "";
      state.page = 1;
      state.dependentSelectKey = "";
      requestRender(false);
    });

    safeBind("tabla-matricula", "change", function(event){
      state.matricula = event.target.value;
      resetDependentOptions();
      requestRender(false);
    });

    safeBind("tabla-carrera", "change", function(event){
      state.career = event.target.value;
      state.page = 1;
      requestRender(false);
    });

    safeBind("tabla-estado", "change", function(event){
      state.status = event.target.value;
      state.page = 1;
      requestRender(false);
    });

    safeBind("tabla-search", "input", function(event){
      state.search = event.target.value;
      debounceRender();
    });

    safeBind("tabla-page-size", "change", function(event){
      state.pageSize = Number(event.target.value) || 100;
      state.page = 1;
      requestRender(false);
    });

    safeBind("tabla-refresh", "click", function(){
      if(window.TablaCore && typeof window.TablaCore.clearCache === "function"){
        window.TablaCore.clearCache();
      }
      state.periodSelectKey = "";
      state.dependentSelectKey = "";
      requestRender(false);
    });

    safeBind("tabla-page-first", "click", function(){
      state.page = 1;
      requestRender(false);
    });

    safeBind("tabla-page-prev", "click", function(){
      state.page = Math.max(1, state.page - 1);
      requestRender(false);
    });

    safeBind("tabla-page-next", "click", function(){
      state.page = Math.min(state.pagination ? state.pagination.pages : state.page + 1, state.page + 1);
      requestRender(false);
    });

    safeBind("tabla-page-last", "click", function(){
      state.page = state.pagination ? state.pagination.pages : state.page;
      requestRender(false);
    });

    safeBind("tabla-telegram-masivo", "click", openMass);

    safeBind("tabla-history-open", "click", function(){
      ensureHistory().then(function(){
        if(window.TablaHistory && typeof window.TablaHistory.abrir === "function"){
          window.TablaHistory.abrir();
        }else{
          status("Historial no disponible.", "warn");
        }
      }).catch(function(error){
        status(error.message || String(error), "warn");
      });
    });

    safeBind("tabla-export-csv", "click", function(){exportRows("csv");});
    safeBind("tabla-export-json", "click", function(){exportRows("json");});

    bindBDLocalEvents();
  }

  function boot(){
    bind();
    render();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.TablaApp = {
    render:render,
    openMass:openMass,
    refreshFromBDLocal:refreshFromBDLocal,
    getState:function(){return Object.assign({}, state);},
    loadScripts:loadScripts
  };
})(window, document);