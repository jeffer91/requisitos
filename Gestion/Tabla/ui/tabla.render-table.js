/* =========================================================
Nombre completo: tabla.render-table.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/ui/tabla.render-table.js
Función o funciones:
- Construir la tabla visible de estudiantes.
- Crear botones funcionales desde el primer render.
- Marcar en verde a quien cumple todos los requisitos.
- Delegar contadores e historial a TablaActions.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION =
    "2.2.0-requirement-badges";

  var U =
    window.TablaUtils ||
    {};

  var lastKey = "";

  function el(id){
    return document
      .getElementById(id);
  }

  function text(value){
    return U.text
      ? U.text(value)
      : String(
          value == null
            ? ""
            : value
        ).trim();
  }

  function esc(value){
    return U.escapeHtml
      ? U.escapeHtml(value)
      : text(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }

  function normalizeStatus(value){
    var clean =
      text(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .replace(
          /[^a-z0-9]+/g,
          ""
        );

    if(
      [
        "cumple",
        "cumpletodo",
        "aprobado",
        "ok"
      ].indexOf(clean) >= 0
    ){
      return "cumple";
    }

    if(
      [
        "nocumple",
        "reprobado",
        "fallido"
      ].indexOf(clean) >= 0
    ){
      return "no_cumple";
    }

    return "pendiente";
  }

  function rowStatus(row){
    row = row || {};

    if(text(row._estadoGeneral)){
      return normalizeStatus(
        row._estadoGeneral
      );
    }

    var requirements =
      Array.isArray(
        row._requisitos
      )
        ? row._requisitos
        : [];

    if(!requirements.length){
      return "pendiente";
    }

    var statuses =
      requirements.map(
        function(item){
          return normalizeStatus(
            item &&
            (
              item.estado ||
              item.value ||
              item.valor
            )
          );
        }
      );

    if(
      statuses.every(
        function(status){
          return (
            status === "cumple"
          );
        }
      )
    ){
      return "cumple";
    }

    if(
      statuses.some(
        function(status){
          return (
            status === "no_cumple"
          );
        }
      )
    ){
      return "no_cumple";
    }

    return "pendiente";
  }

  function rowClass(row){
    var status =
      rowStatus(row);

    if(status === "cumple"){
      return "tabla-row-cumple";
    }

    if(status === "no_cumple"){
      return "tabla-row-no-cumple";
    }

    return "tabla-row-pendiente";
  }

  function requirementsKey(row){
    row = row || {};

    var requirements =
      Array.isArray(
        row._requisitos
      )
        ? row._requisitos
        : Array.isArray(
            row.requisitos
          )
          ? row.requisitos
          : [];

    return requirements
      .map(function(item){
        item = item || {};

        return [
          item.key ||
          item.requisitoKey ||
          item.field ||
          item.label ||
          "",

          item.estado ||
          item.value ||
          item.valor ||
          ""
        ]
          .map(text)
          .join(":");
      })
      .join("|");
  }

  function rowKey(row, index){
    row = row || {};

    return [
      row._id ||
      row.id ||
      index,

      row._cedula,

      row._periodoId ||
      row._periodo,

      row._nombres,

      row._carrera,

      row._celular
        ? 1
        : 0,

      row._correo
        ? 1
        : 0,

      row._telegramChatId
        ? 1
        : 0,

      rowStatus(row),

      requirementsKey(row)
    ]
      .map(text)
      .join("~");
  }

  function rowsKey(rows){
    return (
      Array.isArray(rows)
        ? rows
        : []
    )
      .map(rowKey)
      .join("||");
  }

  function requirementKey(item){
  item = item || {};

  return text(
    item.key ||
    item.requisitoKey ||
    item.requirementKey ||
    item.field ||
    item.label ||
    item.nombre ||
    ""
  )
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function requirementShort(item){
  var key = requirementKey(item);
  var shorts = {
    academico: "Aca",
    documentacion: "Doc",
    documentacionacademica: "Doc",
    financiero: "Fin",
    titulacion: "Tit",
    practicasvinculacion: "PP",
    practicaspreprofesionales: "PP",
    vinculacion: "Vinc",
    seguimientograduados: "Grad",
    ingles: "Ing",
    segundalengua: "Ing",
    actualizaciondatos: "Datos"
  };

  return shorts[key] || text(item && (item.label || item.nombre || item.key)) || "Req";
}

function missingRequirements(row){
  row = row || {};

  var requirements = Array.isArray(row._requisitosFaltantes)
    ? row._requisitosFaltantes
    : Array.isArray(row._requisitos)
      ? row._requisitos
      : Array.isArray(row.requisitos)
        ? row.requisitos
        : [];

  return requirements.filter(function(item){
    var status = text(
      item && (
        item.estado ||
        item.status ||
        item.value ||
        item.valor
      )
    ).toLowerCase();

    return status === "no_cumple" || status === "no cumple";
  });
}

function requirementsCell(row){
  var missing = missingRequirements(row);

  if(!missing.length){
    return (
      '<div class="tabla-req-badges">' +
      '<span class="tabla-req-badge tabla-req-badge--ok">Cumple</span>' +
      '</div>'
    );
  }

  return (
    '<div class="tabla-req-badges" aria-label="Requisitos faltantes">' +
    missing.map(function(item){
      var label = text(item && (item.label || item.nombre || item.key));

      return (
        '<span class="tabla-req-badge tabla-req-badge--missing" title="' +
        esc(label || requirementShort(item)) +
        '">' +
        esc(requirementShort(item)) +
        '</span>'
      );
    }).join("") +
    '</div>'
  );
}
  function messageCell(){
    return (
      '<select class="tabla-message-select" aria-label="Tipo de mensaje">' +
      '<option value="requisitos">Falta req.</option>' +
      "</select>"
    );
  }

  function whatsappAvailable(row){
    try{
      if(
        window.TablaWhatsApp &&
        typeof window
          .TablaWhatsApp
          .available === "function"
      ){
        return !!window.TablaWhatsApp
          .available(row);
      }
    }catch(error){}

    return !!text(
      row &&
      row._celular
    );
  }

  function emailAvailable(row){
    try{
      if(
        window.TablaEmail &&
        typeof window
          .TablaEmail
          .available === "function"
      ){
        return !!window.TablaEmail
          .available(row);
      }
    }catch(error){}

    return !!text(
      row &&
      row._correo
    );
  }

  function actionButton(
    channel,
    disabled,
    title
  ){
    var className =
      channel === "WA"
        ? "action-whats"
        : channel === "TG"
          ? "action-telegram"
          : "action-mail";

    return (
      '<button class="tabla-channel ' +
      className +
      '" type="button"' +
      ' data-action-channel="' +
      esc(channel) +
      '" title="' +
      esc(title || channel) +
      '"' +
      (
        disabled
          ? " disabled"
          : ""
      ) +
      ">" +
      esc(channel) +
      " <small>0</small></button>"
    );
  }

  function rowHtml(row, index){
    row = row || {};

    var status =
      rowStatus(row);

    return (
      '<tr class="' +
      esc(rowClass(row)) +
      '"' +

      ' data-row-index="' +
      index +
      '"' +

      ' data-row-key="' +
      esc(
        rowKey(
          row,
          index
        )
      ) +
      '"' +

      ' data-cedula="' +
      esc(row._cedula) +
      '"' +

      ' data-periodo="' +
      esc(
        row._periodo ||
        row._periodoId
      ) +
      '"' +

      ' data-requirement-status="' +
      esc(status) +
      '">' +

      '<td class="nowrap">' +
      esc(row._cedula) +
      "</td>" +

      "<td>" +
      esc(row._nombres) +
      "</td>" +

      '<td><span class="tabla-career-short" title="' +
      esc(row._carrera) +
      '">' +

      esc(
        row._carreraCorta ||
        row._carrera
      ) +

      "</span></td>" +

      "<td>" +
      messageCell() +
      "</td>" +

      '<td class="tabla-requirements-cell">' +
        requirementsCell(row) +
        "</td>" +

      "<td>" +
      actionButton(
        "WA",
        !whatsappAvailable(row),
        "Abrir WhatsApp"
      ) +
      "</td>" +

      "<td>" +
      actionButton(
        "TG",
        false,
        "Abrir Telegram"
      ) +
      "</td>" +

      "<td>" +
      actionButton(
        "Mail",
        !emailAvailable(row),
        "Preparar correo"
      ) +
      "</td>" +

      "</tr>"
    );
  }

  function tableHtml(rows){
    rows =
      Array.isArray(rows)
        ? rows
        : [];

    var header = [
      "<th>Cédula</th>",
      "<th>Nombre</th>",
      "<th>Carrera</th>",
      "<th>Msg</th>",
      "<th>Requisitos</th>",
      "<th>WA</th>",
      "<th>TG</th>",
      "<th>Mail</th>"
    ].join("");

    return (
      '<table aria-label="Tabla de estudiantes">' +
      "<thead><tr>" +
      header +
      "</tr></thead>" +
      "<tbody>" +
      rows
        .map(rowHtml)
        .join("") +
      "</tbody></table>"
    );
  }

  function enhance(delay){
    if(
      window.TablaActions &&
      typeof window
        .TablaActions
        .enhance === "function"
    ){
      window.TablaActions
        .enhance(
          typeof delay === "number"
            ? delay
            : 0
        );
    }
  }

  function render(rows, options){
    var wrap =
      el("tabla-table-wrap");

    if(!wrap){
      return false;
    }

    rows =
      Array.isArray(rows)
        ? rows
        : [];

    options = options || {};

    var nextKey =
      rows.length
        ? rowsKey(rows)
        : "empty";

    if(
      !options.force &&
      nextKey === lastKey
    ){
      enhance(0);
      return false;
    }

    if(!rows.length){
      wrap.innerHTML =
        '<div class="empty">Sin datos para los filtros seleccionados.</div>';

      lastKey = "empty";

      return true;
    }

    wrap.innerHTML =
      tableHtml(rows);

    lastKey =
      nextKey;

    enhance(0);

    return true;
  }

  function invalidate(){
    lastKey = "";
  }

  function clear(){
    var wrap =
      el("tabla-table-wrap");

    if(wrap){
      wrap.innerHTML = "";
    }

    invalidate();
  }

  window.TablaRenderTable = {
    version:
      VERSION,

    render:
      render,

    tableHtml:
      tableHtml,

    rowHtml:
      rowHtml,

    rowKey:
      rowKey,

    rowStatus:
      rowStatus,

    rowClass:
      rowClass,

    invalidate:
      invalidate,

    clear:
      clear
  };
})(window, document);