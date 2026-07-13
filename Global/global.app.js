/* =========================================================
Nombre completo: global.app.js
Ruta o ubicación: /Requisitos/Global/global.app.js
Función o funciones:
- Controlar la pantalla principal del módulo Global.
- Manejar filtros superiores, incluido el filtro de división.
- Construir el menú lateral desde global.config.js.
- Renderizar tablas inteligentes para cada sección.
- Mostrar el total, la tabla y el gráfico de graduados por período.
- Enviar la sección y los filtros actuales al PDF institucional.
Con qué se conecta:
- global.config.js
- global.core.js
- global.table.js
- global.chart.js
- global.pdf.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.1.0-graduados";
  var config = window.GlobalConfig || {};
  var activeSection = "resumen";
  var booted = false;
  var lastData = null;
  var renderSequence = 0;

  function $(selector){
    return document.querySelector(selector);
  }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function esc(value){
    if(
      window.GlobalTable &&
      window.GlobalTable.helpers &&
      typeof window.GlobalTable.helpers.esc === "function"
    ){
      return window.GlobalTable.helpers.esc(value);
    }

    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(
        new CustomEvent(name, {
          detail: detail || {}
        })
      );
    }catch(error){}
  }

  function sections(){
    return Array.isArray(config.secciones)
      ? config.secciones
      : [];
  }

  function sectionById(id){
    var found = null;

    sections().some(function(section){
      if(section.id === id){
        found = section;
        return true;
      }

      return false;
    });

    return found || sections()[0] || {
      id: "resumen",
      label: "Resumen",
      titulo: "Resumen general",
      descripcion: "Vista ejecutiva."
    };
  }

  function currentFilters(){
    var filters = {};

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-global-filter]"),
      function(input){
        filters[
          input.getAttribute("data-global-filter")
        ] = text(input.value);
      }
    );

    return filters;
  }

  function setState(message, stateName){
    var node = $("#globalSectionState");

    if(!node){
      return;
    }

    node.textContent = text(message) || "Listo";
    node.setAttribute(
      "data-state",
      text(stateName || "info")
    );
  }

  function renderMenu(){
    var menu = $("#globalMenu");

    if(!menu){
      return;
    }

    menu.innerHTML = sections().map(function(section){
      var active = section.id === activeSection;

      return ""
        + '<button type="button"'
        + ' data-global-section="' + esc(section.id) + '"'
        + ' class="' + (active ? "is-active" : "") + '"'
        + ' aria-current="' + (active ? "page" : "false") + '">'
        + esc(section.label || section.id)
        + "</button>";
    }).join("");
  }

  function optionHtml(value, label, selected){
    return ""
      + '<option value="' + esc(value) + '"'
      + (selected ? " selected" : "")
      + ">"
      + esc(label)
      + "</option>";
  }

  function fillSelect(selector, base, list, mapper){
    var select = $(selector);

    if(!select){
      return;
    }

    var current = text(select.value);
    var baseValue = text(base && base.value);
    var baseLabel = text(base && base.label) || "Todos";

    var html = optionHtml(
      baseValue,
      baseLabel,
      current === baseValue
    );

    (Array.isArray(list) ? list : []).forEach(function(item){
      var mapped = mapper(item) || {};
      var value = text(mapped.value);
      var label = text(mapped.label || value);

      if(!value && !label){
        return;
      }

      html += optionHtml(
        value,
        label,
        current === value
      );
    });

    select.innerHTML = html;

    if(
      current &&
      Array.prototype.some.call(
        select.options,
        function(option){
          return option.value === current;
        }
      )
    ){
      select.value = current;
    }
  }

  function hydrateFilters(){
    if(
      !window.GlobalCore ||
      typeof window.GlobalCore.getFilterOptions !== "function"
    ){
      return;
    }

    var options = window.GlobalCore.getFilterOptions() || {};

    fillSelect(
      "#globalFiltroDesde",
      {
        value: "",
        label: "Todos"
      },
      options.periods || [],
      function(item){
        return {
          value:
            item.id ||
            item.periodoId ||
            item.value ||
            item.label,

          label:
            item.label ||
            item.periodoLabel ||
            item.id ||
            item.value
        };
      }
    );

    fillSelect(
      "#globalFiltroHasta",
      {
        value: "",
        label: "Todos"
      },
      options.periods || [],
      function(item){
        return {
          value:
            item.id ||
            item.periodoId ||
            item.value ||
            item.label,

          label:
            item.label ||
            item.periodoLabel ||
            item.id ||
            item.value
        };
      }
    );

    fillSelect(
      "#globalFiltroCarrera",
      {
        value: "",
        label: "Todas las carreras"
      },
      options.careers || [],
      function(item){
        return {
          value:
            item.codigo ||
            item.id ||
            item.nombre,

          label:
            item.nombre ||
            item.label ||
            item.id
        };
      }
    );

    fillSelect(
      "#globalFiltroDivision",
      {
        value: "",
        label: "Todas las divisiones"
      },
      options.divisions || [],
      function(item){
        return {
          value:
            item.value ||
            item.nombre ||
            item.label ||
            item.id,

          label:
            item.label ||
            item.nombre ||
            item.value ||
            item.id
        };
      }
    );

    fillSelect(
      "#globalFiltroRequisito",
      {
        value: "",
        label: "Todos los requisitos"
      },
      options.requirements || [],
      function(item){
        return {
          value:
            item.id ||
            item.key ||
            item.label,

          label:
            item.label ||
            item.nombre ||
            item.id ||
            item.key
        };
      }
    );
  }

  function loadData(){
    if(
      !window.GlobalCore ||
      typeof window.GlobalCore.applyFilters !== "function"
    ){
      return Promise.resolve(null);
    }

    return Promise.resolve(
      typeof window.GlobalCore.ready === "function"
        ? window.GlobalCore.ready()
        : true
    ).then(function(){
      hydrateFilters();

      lastData = window.GlobalCore.applyFilters(
        currentFilters()
      );

      return lastData;
    });
  }

  function renderSectionHeader(section){
    var title = $("#globalSectionTitle");
    var description = $("#globalSectionDescription");

    if(title){
      title.textContent =
        section.titulo ||
        section.label ||
        "Global";
    }

    if(description){
      description.textContent =
        section.descripcion ||
        "Sección Global.";
    }

    renderMenu();
  }

  function tableMount(id){
    return '<div id="' + esc(id) + '" class="global-table-mount"></div>';
  }

  function chartMount(id){
    return '<div id="' + esc(id) + '" class="global-chart-mount"></div>';
  }

  function summaryCard(label, value, detail){
    return ""
      + '<article class="global-summary-card">'
      + '<span class="global-summary-card-label">'
      + esc(label)
      + "</span>"
      + '<strong class="global-summary-card-value">'
      + esc(value)
      + "</strong>"
      + '<p class="global-summary-card-detail">'
      + esc(detail)
      + "</p>"
      + "</article>";
  }

  function renderBodyShell(title, intro, mounts){
    var body = $("#globalSectionBody");

    if(!body){
      return;
    }

    body.innerHTML = ""
      + '<div class="global-section-intro">'
      + "<h3>" + esc(title) + "</h3>"
      + "<p>" + esc(intro) + "</p>"
      + "</div>"
      + (
        Array.isArray(mounts)
          ? mounts.join("")
          : ""
      );
  }

  function renderSmartTable(
    id,
    title,
    rows,
    columns,
    sortKey,
    sortDirection
  ){
    if(
      !window.GlobalTable ||
      typeof window.GlobalTable.render !== "function"
    ){
      var mount = $("#" + id);

      if(mount){
        mount.innerHTML = ""
          + '<div class="global-empty-state">'
          + "<h3>Tabla no disponible</h3>"
          + "<p>No se encontró global.table.js.</p>"
          + "</div>";
      }

      return;
    }

    window.GlobalTable.render("#" + id, {
      id: id,
      title: title,
      rows: Array.isArray(rows) ? rows : [],
      columns: Array.isArray(columns) ? columns : [],

      pageSize:
        (
          config.filtros &&
          config.filtros.pageSize
        ) || 25,

      defaultSortKey:
        sortKey || "",

      defaultSortDir:
        sortDirection || "asc"
    });
  }

  function number(value){
    var parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function studentRows(data){
    return (data.students || []).map(function(row){
      var compliance =
        row._globalCumplimiento || {};

      return {
        cedula:
          row._globalCedula,

        nombres:
          row._globalNombres,

        carrera:
          row._globalCarrera,

        tipo:
          row._globalTipoCarrera,

        periodo:
          row._globalPeriodoLabel ||
          row._globalPeriodoId,

        division:
          row._globalDivision,

        matricula:
          row._globalEstadoMatricula,

        cumplimiento:
          number(compliance.porcentaje)
      };
    });
  }

  function resumenRows(data){
    var summary =
      data.resumen || {};

    return [
      {
        indicador: "Total estudiantes",
        valor: summary.totalEstudiantes || 0,
        detalle: "Estudiantes incluidos según los filtros."
      },
      {
        indicador: "Total graduados",
        valor: summary.totalGraduados || 0,
        detalle: "Estudiantes con AprobacionTitulacion en CUMPLE."
      },
      {
        indicador: "Total carreras",
        valor: summary.totalCarreras || 0,
        detalle: "Carreras únicas detectadas."
      },
      {
        indicador: "Total períodos",
        valor: summary.totalPeriodos || 0,
        detalle: "Períodos académicos incluidos."
      },
      {
        indicador: "Total requisitos",
        valor: summary.totalRequisitos || 0,
        detalle: "Requisitos detectados o filtrados."
      },
      {
        indicador: "Cumplimiento general",
        valor:
          (
            summary.porcentajeCumplimiento || 0
          ) + "%",
        detalle: "Promedio de cumplimiento de requisitos."
      },
      {
        indicador: "Activos",
        valor: summary.activos || 0,
        detalle: "Estudiantes activos."
      },
      {
        indicador: "Retirados",
        valor: summary.retirados || 0,
        detalle: "Estudiantes marcados como retirados."
      }
    ];
  }

  function carreraRows(data){
    var map = Object.create(null);

    (data.students || []).forEach(function(row){
      var name =
        row._globalCarrera ||
        "SIN CARRERA";

      var compliance =
        row._globalCumplimiento || {};

      if(!map[name]){
        map[name] = {
          carrera: name,
          tipo: row._globalTipoCarrera,
          estudiantes: 0,
          activos: 0,
          retirados: 0,
          suma: 0
        };
      }

      map[name].estudiantes += 1;
      map[name].suma +=
        number(compliance.porcentaje);

      if(
        row._globalEstadoMatricula ===
        "RETIRADO"
      ){
        map[name].retirados += 1;
      }else{
        map[name].activos += 1;
      }
    });

    return Object.keys(map).map(function(name){
      var item = map[name];

      item.cumplimiento =
        item.estudiantes
          ? Math.round(
            item.suma /
            item.estudiantes
          )
          : 0;

      return item;
    });
  }

  function periodoRows(data){
    var map = Object.create(null);

    (data.students || []).forEach(function(row){
      var period =
        row._globalPeriodoLabel ||
        row._globalPeriodoId ||
        "SIN PERÍODO";

      var compliance =
        row._globalCumplimiento || {};

      if(!map[period]){
        map[period] = {
          periodo: period,
          estudiantes: 0,
          carreras: Object.create(null),
          suma: 0
        };
      }

      map[period].estudiantes += 1;

      map[period].carreras[
        row._globalCarrera ||
        "SIN CARRERA"
      ] = true;

      map[period].suma +=
        number(compliance.porcentaje);
    });

    return Object.keys(map).map(function(period){
      var item = map[period];

      return {
        periodo:
          item.periodo,

        estudiantes:
          item.estudiantes,

        carreras:
          Object.keys(
            item.carreras
          ).length,

        cumplimiento:
          item.estudiantes
            ? Math.round(
              item.suma /
              item.estudiantes
            )
            : 0
      };
    });
  }

  function tipoRows(data){
    var map = Object.create(null);

    (data.students || []).forEach(function(row){
      var type =
        row._globalTipoCarrera ||
        "SIN TIPO";

      var compliance =
        row._globalCumplimiento || {};

      if(!map[type]){
        map[type] = {
          tipo: type,
          estudiantes: 0,
          carreras: Object.create(null),
          suma: 0
        };
      }

      map[type].estudiantes += 1;

      map[type].carreras[
        row._globalCarrera ||
        "SIN CARRERA"
      ] = true;

      map[type].suma +=
        number(compliance.porcentaje);
    });

    return Object.keys(map).map(function(type){
      var item = map[type];

      return {
        tipo:
          item.tipo,

        estudiantes:
          item.estudiantes,

        carreras:
          Object.keys(
            item.carreras
          ).length,

        cumplimiento:
          item.estudiantes
            ? Math.round(
              item.suma /
              item.estudiantes
            )
            : 0
      };
    });
  }

  function requisitoRows(data){
    var output = [];

    var helpers =
      window.GlobalCore &&
      window.GlobalCore.helpers;

    (data.requirements || []).forEach(function(requirement){
      var cumple = 0;
      var pendiente = 0;
      var noCumple = 0;

      (data.students || []).forEach(function(row){
        var value =
          helpers &&
          typeof helpers.requirementValue === "function"
            ? helpers.requirementValue(
              row,
              requirement.id ||
              requirement.key
            )
            : row[
              requirement.id ||
              requirement.key
            ];

        var status =
          helpers &&
          typeof helpers.cellStatus === "function"
            ? helpers.cellStatus(value)
            : text(value).toUpperCase();

        if(status === "CUMPLE"){
          cumple += 1;
        }else if(status === "PENDIENTE"){
          pendiente += 1;
        }else{
          noCumple += 1;
        }
      });

      var total =
        cumple +
        pendiente +
        noCumple;

      output.push({
        requisito:
          requirement.label ||
          requirement.id,

        cumple:
          cumple,

        pendiente:
          pendiente,

        noCumple:
          noCumple,

        total:
          total,

        cumplimiento:
          total
            ? Math.round(
              (
                cumple /
                total
              ) * 100
            )
            : 0
      });
    });

    return output;
  }

  function comparativaRows(data){
    var map = Object.create(null);

    (data.students || []).forEach(function(row){
      var period =
        row._globalPeriodoLabel ||
        row._globalPeriodoId ||
        "SIN PERÍODO";

      var type =
        row._globalTipoCarrera ||
        "SIN TIPO";

      var mapKey =
        period +
        "__" +
        type;

      if(!map[mapKey]){
        map[mapKey] = {
          periodo: period,
          tipo: type,
          estudiantes: 0,
          carreras: Object.create(null)
        };
      }

      map[mapKey].estudiantes += 1;

      map[mapKey].carreras[
        row._globalCarrera ||
        "SIN CARRERA"
      ] = true;
    });

    return Object.keys(map).map(function(mapKey){
      var item = map[mapKey];

      return {
        periodo:
          item.periodo,

        tipo:
          item.tipo,

        estudiantes:
          item.estudiantes,

        carreras:
          Object.keys(
            item.carreras
          ).length
      };
    });
  }

  function graduatePeriodRows(data){
    var rows =
      data &&
      data.graduados &&
      Array.isArray(
        data.graduados.porPeriodo
      )
        ? data.graduados.porPeriodo
        : (
          data &&
          data.groups &&
          Array.isArray(
            data.groups.byPeriodoGraduados
          )
            ? data.groups.byPeriodoGraduados
            : []
        );

    return rows.map(function(item){
      return {
        periodo:
          item.periodo ||
          item.label ||
          item.periodoId ||
          "SIN PERÍODO",

        cantidadGraduados:
          number(
            item.cantidadGraduados != null
              ? item.cantidadGraduados
              : item.total
          )
      };
    });
  }

  function alertRows(data){
    var requirements =
      requisitoRows(data).map(function(row){
        var quantity =
          row.noCumple +
          row.pendiente;

        return {
          alerta: "Requisito crítico",
          detalle: row.requisito,
          cantidad: quantity,

          prioridad:
            quantity > 0
              ? "Revisar"
              : "Controlado"
        };
      });

    var careers =
      carreraRows(data).map(function(row){
        return {
          alerta: "Carrera con pendientes",
          detalle: row.carrera,
          cantidad: 100 - row.cumplimiento,

          prioridad:
            row.cumplimiento < 70
              ? "Alta"
              : "Media"
        };
      });

    return requirements
      .concat(careers)
      .filter(function(row){
        return number(row.cantidad) > 0;
      });
  }

  function reportRows(data){
    return sections().map(function(section){
      var records =
        section.id === "graduados"
          ? number(
            data &&
            data.graduados &&
            data.graduados.total
          )
          : (
            data.students || []
          ).length;

      return {
        seccion:
          section.label,

        reporte:
          section.pdfTitulo ||
          section.titulo,

        estado:
          section.id === activeSection
            ? "Actual"
            : "Disponible",

        registros:
          records,

        filtros:
          "Aplica filtros superiores"
      };
    });
  }

  function studentColumns(){
    return [
      {
        key: "cedula",
        label: "Cédula"
      },
      {
        key: "nombres",
        label: "Estudiante"
      },
      {
        key: "carrera",
        label: "Carrera"
      },
      {
        key: "tipo",
        label: "Tipo"
      },
      {
        key: "periodo",
        label: "Período"
      },
      {
        key: "division",
        label: "División"
      },
      {
        key: "matricula",
        label: "Matrícula"
      },
      {
        key: "cumplimiento",
        label: "Cumplimiento",
        type: "percent",
        percent: true
      }
    ];
  }

  function periodColumns(){
    return [
      {
        key: "periodo",
        label: "Período"
      },
      {
        key: "estudiantes",
        label: "Estudiantes",
        type: "number"
      },
      {
        key: "carreras",
        label: "Carreras",
        type: "number"
      },
      {
        key: "cumplimiento",
        label: "Cumplimiento",
        type: "percent",
        percent: true
      }
    ];
  }

  function renderSummary(data){
    renderBodyShell(
      "Resumen general",
      "Resumen ejecutivo calculado con los filtros superiores activos.",
      [
        tableMount(
          "globalTablaResumen"
        ),
        tableMount(
          "globalTablaResumenPeriodos"
        )
      ]
    );

    renderSmartTable(
      "globalTablaResumen",
      "Indicadores generales",
      resumenRows(data),
      [
        {
          key: "indicador",
          label: "Indicador"
        },
        {
          key: "valor",
          label: "Valor"
        },
        {
          key: "detalle",
          label: "Detalle"
        }
      ],
      "indicador",
      "asc"
    );

    renderSmartTable(
      "globalTablaResumenPeriodos",
      "Estudiantes por período",
      periodoRows(data),
      periodColumns(),
      "periodo",
      "asc"
    );
  }

  function renderGraduates(data){
    var summary =
      data.resumen || {};

    var rows =
      graduatePeriodRows(data);

    var total =
      number(
        data &&
        data.graduados &&
        data.graduados.total != null
          ? data.graduados.total
          : summary.totalGraduados
      );

    var periods =
      rows.length;

    var average =
      periods
        ? Math.round(
          total /
          periods
        )
        : 0;

    var body =
      $("#globalSectionBody");

    if(!body){
      return;
    }

    body.innerHTML = ""
      + '<div class="global-section-intro">'
      + "<h3>Graduados por período</h3>"
      + "<p>Se consideran graduados únicamente los estudiantes cuyo campo AprobacionTitulacion contiene el valor CUMPLE. El resultado respeta todos los filtros superiores activos.</p>"
      + "</div>"
      + '<section class="global-summary-grid" aria-label="Resumen de graduados">'
      + summaryCard(
        "Total de graduados",
        total,
        "Conteo único de estudiantes por período."
      )
      + summaryCard(
        "Períodos con graduados",
        periods,
        "Períodos académicos con al menos un graduado."
      )
      + summaryCard(
        "Promedio por período",
        average,
        "Promedio calculado según los filtros aplicados."
      )
      + "</section>"
      + chartMount(
        "globalGraficoGraduados"
      )
      + tableMount(
        "globalTablaGraduados"
      );

    if(
      window.GlobalChart &&
      typeof window.GlobalChart.renderBar === "function"
    ){
      window.GlobalChart.renderBar(
        "#globalGraficoGraduados",
        {
          title:
            "Cantidad de graduados por período",

          description:
            "Estudiantes con AprobacionTitulacion = CUMPLE.",

          data:
            rows,

          labelKey:
            "periodo",

          valueKey:
            "cantidadGraduados",

          orientation:
            rows.length >= 7
              ? "horizontal"
              : "vertical",

          ariaLabel:
            "Gráfico de graduados por período"
        }
      );
    }else{
      var chart =
        $("#globalGraficoGraduados");

      if(chart){
        chart.innerHTML = ""
          + '<div class="global-empty-state">'
          + "<h3>Gráfico no disponible</h3>"
          + "<p>No se encontró global.chart.js.</p>"
          + "</div>";
      }
    }

    renderSmartTable(
      "globalTablaGraduados",
      "Graduados por período",
      rows,
      [
        {
          key: "periodo",
          label: "Período"
        },
        {
          key: "cantidadGraduados",
          label: "Cantidad de graduados",
          type: "number"
        }
      ],
      "periodo",
      "asc"
    );
  }

  function renderSectionContent(section, data){
    if(section.id === "resumen"){
      renderSummary(data);
      return;
    }

    if(section.id === "estudiantes"){
      renderBodyShell(
        "Estudiantes",
        "Listado filtrado de estudiantes. Puedes ordenar por encabezados y buscar dentro de la tabla.",
        [
          tableMount(
            "globalTablaEstudiantes"
          )
        ]
      );

      renderSmartTable(
        "globalTablaEstudiantes",
        "Estudiantes filtrados",
        studentRows(data),
        studentColumns(),
        "nombres",
        "asc"
      );

      return;
    }

    if(section.id === "carreras"){
      renderBodyShell(
        "Carreras",
        "Comparativa de carreras incluidas en los filtros actuales.",
        [
          tableMount(
            "globalTablaCarreras"
          )
        ]
      );

      renderSmartTable(
        "globalTablaCarreras",
        "Carreras",
        carreraRows(data),
        [
          {
            key: "carrera",
            label: "Carrera"
          },
          {
            key: "tipo",
            label: "Tipo"
          },
          {
            key: "estudiantes",
            label: "Estudiantes",
            type: "number"
          },
          {
            key: "activos",
            label: "Activos",
            type: "number"
          },
          {
            key: "retirados",
            label: "Retirados",
            type: "number"
          },
          {
            key: "cumplimiento",
            label: "Cumplimiento",
            type: "percent",
            percent: true
          }
        ],
        "estudiantes",
        "desc"
      );

      return;
    }

    if(section.id === "requisitos"){
      renderBodyShell(
        "Requisitos",
        "Cumplimiento por requisito detectado en la base filtrada.",
        [
          tableMount(
            "globalTablaRequisitos"
          )
        ]
      );

      renderSmartTable(
        "globalTablaRequisitos",
        "Requisitos",
        requisitoRows(data),
        [
          {
            key: "requisito",
            label: "Requisito"
          },
          {
            key: "cumple",
            label: "Cumple",
            type: "number"
          },
          {
            key: "pendiente",
            label: "Pendiente",
            type: "number"
          },
          {
            key: "noCumple",
            label: "No cumple",
            type: "number"
          },
          {
            key: "total",
            label: "Total",
            type: "number"
          },
          {
            key: "cumplimiento",
            label: "Cumplimiento",
            type: "percent",
            percent: true
          }
        ],
        "noCumple",
        "desc"
      );

      return;
    }

    if(section.id === "periodos"){
      renderBodyShell(
        "Períodos académicos",
        "Comparativa de estudiantes, carreras y cumplimiento por período.",
        [
          tableMount(
            "globalTablaPeriodos"
          )
        ]
      );

      renderSmartTable(
        "globalTablaPeriodos",
        "Períodos",
        periodoRows(data),
        periodColumns(),
        "periodo",
        "asc"
      );

      return;
    }

    if(section.id === "tipo-carrera"){
      renderBodyShell(
        "Tipo de carrera",
        "Comparativa entre carreras Universitarias y Superiores.",
        [
          tableMount(
            "globalTablaTipoCarrera"
          )
        ]
      );

      renderSmartTable(
        "globalTablaTipoCarrera",
        "Universitaria vs Superior",
        tipoRows(data),
        [
          {
            key: "tipo",
            label: "Tipo"
          },
          {
            key: "estudiantes",
            label: "Estudiantes",
            type: "number"
          },
          {
            key: "carreras",
            label: "Carreras",
            type: "number"
          },
          {
            key: "cumplimiento",
            label: "Cumplimiento",
            type: "percent",
            percent: true
          }
        ],
        "tipo",
        "asc"
      );

      return;
    }

    if(section.id === "comparativas"){
      renderBodyShell(
        "Comparativas",
        "Cruce inicial entre período y tipo de carrera.",
        [
          tableMount(
            "globalTablaComparativas"
          )
        ]
      );

      renderSmartTable(
        "globalTablaComparativas",
        "Período por tipo de carrera",
        comparativaRows(data),
        [
          {
            key: "periodo",
            label: "Período"
          },
          {
            key: "tipo",
            label: "Tipo"
          },
          {
            key: "estudiantes",
            label: "Estudiantes",
            type: "number"
          },
          {
            key: "carreras",
            label: "Carreras",
            type: "number"
          }
        ],
        "periodo",
        "asc"
      );

      return;
    }

    if(section.id === "graduados"){
      renderGraduates(data);
      return;
    }

    if(section.id === "alertas"){
      renderBodyShell(
        "Alertas",
        "Datos que requieren revisión institucional según los filtros actuales.",
        [
          tableMount(
            "globalTablaAlertas"
          )
        ]
      );

      renderSmartTable(
        "globalTablaAlertas",
        "Alertas detectadas",
        alertRows(data),
        [
          {
            key: "alerta",
            label: "Tipo de alerta"
          },
          {
            key: "detalle",
            label: "Detalle"
          },
          {
            key: "cantidad",
            label: "Cantidad / indicador",
            type: "number"
          },
          {
            key: "prioridad",
            label: "Prioridad"
          }
        ],
        "cantidad",
        "desc"
      );

      return;
    }

    renderBodyShell(
      "Reportes",
      "Reportes disponibles para la sección y los filtros actuales.",
      [
        tableMount(
          "globalTablaReportes"
        )
      ]
    );

    renderSmartTable(
      "globalTablaReportes",
      "Reportes disponibles",
      reportRows(data),
      [
        {
          key: "seccion",
          label: "Sección"
        },
        {
          key: "reporte",
          label: "Reporte"
        },
        {
          key: "estado",
          label: "Estado"
        },
        {
          key: "registros",
          label: "Registros",
          type: "number"
        },
        {
          key: "filtros",
          label: "Filtros"
        }
      ],
      "seccion",
      "asc"
    );
  }

  function render(){
    var sequence =
      ++renderSequence;

    var section =
      sectionById(activeSection);

    renderSectionHeader(section);
    setState(
      "Actualizando",
      "loading"
    );

    return loadData().then(function(data){
      if(sequence !== renderSequence){
        return null;
      }

      if(!data){
        setState(
          "Sin datos",
          "warning"
        );

        renderBodyShell(
          section.titulo,
          "No se pudo leer GlobalCore todavía.",
          [
            tableMount(
              "globalTablaSinDatos"
            )
          ]
        );

        return null;
      }

      renderSectionContent(
        section,
        data
      );

      setState(
        "Datos listos",
        "success"
      );

      emit("global:rendered", {
        section: section,
        filters: currentFilters(),
        summary: data.resumen,
        at: new Date().toISOString()
      });

      return data;
    }).catch(function(error){
      if(sequence !== renderSequence){
        return null;
      }

      setState(
        "Error",
        "error"
      );

      renderBodyShell(
        "Error",
        error && error.message
          ? error.message
          : "No se pudo renderizar la sección.",
        []
      );

      try{
        console.error(
          "[GlobalApp] Error al renderizar",
          error
        );
      }catch(consoleError){}

      return null;
    });
  }

  function clearFilters(){
    Array.prototype.forEach.call(
      document.querySelectorAll(
        "[data-global-filter]"
      ),
      function(input){
        input.value = "";
      }
    );

    render();
  }

  function generatePdf(){
    var filters =
      currentFilters();

    setState(
      "Preparando PDF",
      "loading"
    );

    loadData().then(function(data){
      data =
        data ||
        lastData;

      emit("global:pdf-requested", {
        section: activeSection,
        filters: filters,
        data: data,
        at: new Date().toISOString()
      });

      if(
        window.GlobalPDF &&
        typeof window.GlobalPDF.generate === "function"
      ){
        var result =
          window.GlobalPDF.generate({
            section: activeSection,
            filters: filters,
            data: data
          });

        setState(
          result === false
            ? "PDF bloqueado"
            : "PDF enviado",

          result === false
            ? "warning"
            : "success"
        );

        return;
      }

      setState(
        "PDF no disponible",
        "warning"
      );

      window.alert(
        "GlobalPDF no está disponible. Revisa que global.pdf.js esté cargado."
      );
    }).catch(function(error){
      setState(
        "Error PDF",
        "error"
      );

      window.alert(
        "No se pudo generar el PDF institucional: " +
        (
          error && error.message
            ? error.message
            : error
        )
      );
    });
  }

  function bind(){
    var menu =
      $("#globalMenu");

    var clearButton =
      $("#globalBtnLimpiar");

    var refreshButton =
      $("#globalBtnActualizar");

    var pdfButton =
      $("#globalBtnPdf");

    if(menu){
      menu.addEventListener(
        "click",
        function(event){
          var button =
            event.target.closest(
              "button[data-global-section]"
            );

          if(!button){
            return;
          }

          activeSection =
            button.getAttribute(
              "data-global-section"
            ) || "resumen";

          render();
        }
      );
    }

    Array.prototype.forEach.call(
      document.querySelectorAll(
        "[data-global-filter]"
      ),
      function(input){
        input.addEventListener(
          "change",
          render
        );
      }
    );

    if(clearButton){
      clearButton.addEventListener(
        "click",
        clearFilters
      );
    }

    if(refreshButton){
      refreshButton.addEventListener(
        "click",
        function(){
          if(
            window.GlobalCore &&
            typeof window.GlobalCore.refresh === "function"
          ){
            setState(
              "Actualizando BDLocal",
              "loading"
            );

            window.GlobalCore.refresh({
              force: true
            }).then(function(){
              return render();
            }).catch(function(error){
              setState(
                "Error al actualizar",
                "error"
              );

              try{
                console.error(
                  "[GlobalApp] No se pudo actualizar BDLocal",
                  error
                );
              }catch(consoleError){}
            });
          }else{
            render();
          }
        }
      );
    }

    if(pdfButton){
      pdfButton.addEventListener(
        "click",
        generatePdf
      );
    }
  }

  function boot(){
    if(booted){
      return;
    }

    booted = true;
    renderMenu();
    bind();
    render();
  }

  window.GlobalApp = {
    version:
      VERSION,

    boot:
      boot,

    render:
      render,

    generatePdf:
      generatePdf,

    clearFilters:
      clearFilters,

    getActiveSection: function(){
      return activeSection;
    },

    setActiveSection: function(id){
      activeSection =
        id || "resumen";

      return render();
    },

    getFilters:
      currentFilters,

    getLastData: function(){
      return lastData;
    },

    hydrateFilters:
      hydrateFilters,

    rows: {
      students:
        studentRows,

      resumen:
        resumenRows,

      carreras:
        carreraRows,

      periodos:
        periodoRows,

      tipos:
        tipoRows,

      requisitos:
        requisitoRows,

      comparativas:
        comparativaRows,

      graduados:
        graduatePeriodRows,

      alertas:
        alertRows,

      reportes:
        reportRows
    }
  };
})(window, document);