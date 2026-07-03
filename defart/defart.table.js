/* =========================================================
Nombre completo: defart.table.js
Ruta o ubicación: /Requisitos/defart/defart.table.js
Función o funciones:
- Renderizar la tabla elegante de Defensas separada de defart.app.js.
- Mostrar encabezados ordenables con indicador visual ascendente/descendente.
- Pintar filas alternadas y estados: pendiente, completo, error, guardado y cambios sin guardar.
- Mostrar botón por fila solo cuando el estudiante tenga cambios pendientes.
- Actualizar vista previa de una fila sin reconstruir toda la tabla.
Con qué se conecta:
- defart.core.js
- defart.app.js
========================================================= */
(function(window, document){
  "use strict";

  var HEADERS = [
    { key:"_cedula", label:"Cédula", className:"col-cedula" },
    { key:"_nombre", label:"Nombre", className:"col-nombre" },
    { key:"_carrera", label:"Carrera", className:"col-carrera" },
    { key:"_nart", label:"N-ART", className:"col-nota" },
    { key:"_ndef", label:"N-DEF", className:"col-nota" },
    { key:"_nfin", label:"N-FIN", className:"col-nota" },
    { key:"_estadoDefensa", label:"Estado", className:"col-estado" }
  ];

  function text(value){ return String(value == null ? "" : value).trim(); }
  function esc(value){
    return text(value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
  function hasOwn(obj, key){ return Object.prototype.hasOwnProperty.call(obj || {}, key); }
  function cssEscape(value){
    value = text(value);
    if(window.CSS && typeof window.CSS.escape === "function"){ return window.CSS.escape(value); }
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
  function noteText(value){
    if(window.DefartCore && typeof window.DefartCore.noteToText === "function"){
      return window.DefartCore.noteToText(value);
    }
    return value == null ? "" : String(value);
  }
  function pendingPatch(row, options){
    var changes = options && options.changes ? options.changes : {};
    return changes[row && row._defId] || null;
  }
  function withPending(row, options){
    var patch = pendingPatch(row, options);
    if(patch && window.DefartCore && typeof window.DefartCore.preview === "function"){
      return window.DefartCore.preview(row, patch);
    }
    return row || {};
  }
  function stateClass(row){
    var value = row && row._estadoDefensa;
    if(value === "Completo"){ return "estado-completo"; }
    if(value === "Sin requisitos"){ return "estado-sin-requisitos"; }
    if(value === "Supletorio Art" || value === "Supletorio Def"){ return "estado-supletorio"; }
    return "estado-pendiente";
  }
  function feedbackFor(id, options){
    var map = options && options.rowFeedback ? options.rowFeedback : {};
    return text(map[id]);
  }
  function rowClass(original, options){
    var row = withPending(original, options);
    var id = original && original._defId;
    var classes = [stateClass(row)];
    if(pendingPatch(original, options)){ classes.push("is-pending"); }
    var feedback = feedbackFor(id, options);
    if(feedback === "saving"){ classes.push("is-saving"); }
    if(feedback === "saved"){ classes.push("is-saved"); }
    if(feedback === "error"){ classes.push("is-error"); }
    return classes.join(" ");
  }
  function statePill(row){
    row = row || {};
    return '<span class="def-pill '+esc(stateClass(row))+'">'+esc(row._estadoDefensa || "Pendiente")+'</span>';
  }
  function sortIcon(key, options){
    if(!options || options.sortKey !== key){ return '<span class="def-sort-icon">↕</span>'; }
    return options.sortDir === "desc" ? '<span class="def-sort-icon active">↓</span>' : '<span class="def-sort-icon active">↑</span>';
  }
  function headHtml(options){
    return '<thead><tr>' + HEADERS.map(function(header){
      return '<th class="'+esc(header.className || "")+'" data-sort="'+esc(header.key)+'" scope="col"><button class="def-sort-button" type="button">'+esc(header.label)+sortIcon(header.key, options)+'</button></th>';
    }).join("") + '<th class="col-accion" scope="col">Acción</th></tr></thead>';
  }
  function inputHtml(original, field, options){
    var shown = withPending(original, options);
    var isArt = field === "nart";
    var value = isArt ? shown._nart : shown._ndef;
    var enabled = isArt ? shown._canArt : shown._canDef;
    var title = "";

    if(!enabled && isArt){ title = "Bloqueado por requisitos pendientes."; }
    if(!enabled && !isArt){ title = "Bloqueado hasta tener N-ART igual o mayor a 7."; }

    return '<input class="def-note-input" type="number" min="0" max="10" step="0.01" inputmode="decimal" data-id="'+esc(original._defId)+'" data-field="'+esc(field)+'" value="'+esc(noteText(value))+'" '+(enabled ? "" : "disabled")+' title="'+esc(title)+'" />';
  }
  function nfinHtml(row){
    var value = noteText(row && row._nfin);
    return '<strong class="def-nfin-value">'+esc(value || "—")+'</strong>';
  }
  function actionHtml(original, options){
    var id = original && original._defId;
    var pending = !!pendingPatch(original, options);
    var feedback = feedbackFor(id, options);

    if(feedback === "saving"){
      return '<span class="def-row-action-state saving" title="Guardando fila">⏳</span>';
    }
    if(feedback === "saved"){
      return '<span class="def-row-action-state saved" title="Fila guardada">✓</span>';
    }
    if(feedback === "error"){
      return pending ? '<button class="def-row-save is-error" type="button" data-save-row="'+esc(id)+'" title="Reintentar guardar esta fila">↻</button>' : '<span class="def-row-action-state error" title="Error al guardar">!</span>';
    }
    if(pending){
      return '<button class="def-row-save" type="button" data-save-row="'+esc(id)+'" title="Guardar solo esta fila">💾</button>';
    }
    return '<span class="def-row-action-state muted" title="Sin cambios">—</span>';
  }
  function cellHtml(original, header, options){
    var row = withPending(original, options);
    if(header.key === "_nart"){ return inputHtml(original, "nart", options); }
    if(header.key === "_ndef"){ return inputHtml(original, "ndef", options); }
    if(header.key === "_nfin"){ return nfinHtml(row); }
    if(header.key === "_estadoDefensa"){ return statePill(row); }

    if(header.key === "_carrera"){
      return '<div class="def-career-cell"><strong>'+esc(row._carrera || "SIN CARRERA")+'</strong><span>'+esc(row._sede || "SIN SEDE")+'</span></div>';
    }
    if(header.key === "_nombre"){
      return '<div class="def-name-cell"><strong>'+esc(row._nombre || "SIN NOMBRE")+'</strong><span>'+esc(row._periodoLabel || row._periodoId || "Sin período")+'</span></div>';
    }
    return esc(row[header.key] || "");
  }
  function rowHtml(original, options, index){
    original = original || {};
    var id = text(original._defId || ("fila_" + index));
    var cells = HEADERS.map(function(header){
      return '<td class="'+esc(header.className || "")+'">'+cellHtml(original, header, options)+'</td>';
    }).join("");

    return '<tr class="'+esc(rowClass(original, options))+'" data-id="'+esc(id)+'">'+cells+'<td class="col-accion">'+actionHtml(original, options)+'</td></tr>';
  }
  function tableHtml(rows, options){
    if(!rows || !rows.length){
      return '<div class="def-empty">Sin estudiantes con los filtros seleccionados.</div>';
    }
    return '<table class="def-table">'+headHtml(options)+'<tbody>'+rows.map(function(row, index){ return rowHtml(row, options, index); }).join("")+'</tbody></table>';
  }
  function focusNextInput(target, input){
    var inputs = Array.prototype.slice.call(target.querySelectorAll(".def-note-input:not(:disabled)"));
    var index = inputs.indexOf(input);
    if(index >= 0 && inputs[index + 1]){
      inputs[index + 1].focus();
      inputs[index + 1].select();
      return true;
    }
    return false;
  }
  function bind(target, options){
    target.onclick = function(event){
      var sortButton = event.target.closest ? event.target.closest("[data-sort]") : null;
      if(sortButton && target.contains(sortButton)){
        var key = sortButton.getAttribute("data-sort");
        if(options && typeof options.onSort === "function"){ options.onSort(key); }
        return;
      }

      var saveButton = event.target.closest ? event.target.closest("[data-save-row]") : null;
      if(saveButton && target.contains(saveButton)){
        var id = saveButton.getAttribute("data-save-row");
        if(options && typeof options.onSaveRow === "function"){ options.onSaveRow(id); }
      }
    };

    target.oninput = function(event){
      var input = event.target && event.target.classList && event.target.classList.contains("def-note-input") ? event.target : null;
      if(!input){ return; }
      if(options && typeof options.onInput === "function"){
        options.onInput(input.getAttribute("data-id"), input.getAttribute("data-field"), input.value, input);
      }
    };

    target.onchange = function(event){
      var input = event.target && event.target.classList && event.target.classList.contains("def-note-input") ? event.target : null;
      if(!input){ return; }
      if(options && typeof options.onInput === "function"){
        options.onInput(input.getAttribute("data-id"), input.getAttribute("data-field"), input.value, input);
      }
    };

    target.onkeydown = function(event){
      var input = event.target && event.target.classList && event.target.classList.contains("def-note-input") ? event.target : null;
      if(!input || event.key !== "Enter"){ return; }
      event.preventDefault();
      if(options && typeof options.onInput === "function"){
        options.onInput(input.getAttribute("data-id"), input.getAttribute("data-field"), input.value, input);
      }
      focusNextInput(target, input);
    };
  }
  function render(target, options){
    if(!target){ return; }
    options = options || {};
    target.innerHTML = tableHtml(options.rows || [], options);
    bind(target, options);
  }
  function updateRowPreview(target, original, options){
    if(!target || !original){ return; }
    var id = text(original._defId);
    var rowEl = target.querySelector('tr[data-id="'+cssEscape(id)+'"]');
    if(!rowEl){ return; }
    var preview = withPending(original, options || {});
    rowEl.className = rowClass(original, options || {});

    var nfin = rowEl.querySelector(".def-nfin-value");
    if(nfin){ nfin.textContent = noteText(preview._nfin) || "—"; }

    var estado = rowEl.querySelector(".col-estado");
    if(estado){ estado.innerHTML = statePill(preview); }

    var action = rowEl.querySelector(".col-accion");
    if(action){ action.innerHTML = actionHtml(original, options || {}); }

    var ndefInput = rowEl.querySelector('.def-note-input[data-field="ndef"]');
    if(ndefInput){
      ndefInput.disabled = !preview._canDef;
      ndefInput.title = preview._canDef ? "" : "Bloqueado hasta tener N-ART igual o mayor a 7.";
    }
  }
  function defaultHeaders(){ return HEADERS.slice(); }

  window.DefartTable = {
    render: render,
    updateRowPreview: updateRowPreview,
    withPending: withPending,
    noteText: noteText,
    stateClass: stateClass,
    statePill: statePill,
    headers: defaultHeaders
  };
})(window, document);