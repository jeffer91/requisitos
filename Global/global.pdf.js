/* =========================================================
Nombre completo: global.pdf.js
Ruta o ubicación: /Requisitos/Global/global.pdf.js
Función o funciones:
- Generar el informe institucional de la sección activa de Global.
- Aplicar e interpretar correctamente los filtros vigentes.
- Crear portada blanca con bloque azul únicamente detrás del logo.
- Incluir resumen ejecutivo, explicaciones, observaciones, tabla y gráfico.
- Abrir automáticamente la impresión del navegador al finalizar la carga.
Con qué se conecta:
- global.config.js
- global.core.js
- global.app.js
- global.chart.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION =
    "1.2.1-active-filters-only";

  var config =
    window.GlobalConfig || {};

  function text(value){
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function number(value){
    var parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function absoluteUrl(value){
    try{
      return new URL(
        value,
        window.location.href
      ).href;
    }catch(error){
      return text(value);
    }
  }

  function now(){
    try{
      return new Intl.DateTimeFormat(
        "es-EC",
        {
          dateStyle: "long",
          timeStyle: "short"
        }
      ).format(
        new Date()
      );
    }catch(error){
      return new Date()
        .toLocaleString("es-EC");
    }
  }

  function formatInteger(value){
    try{
      return new Intl.NumberFormat(
        "es-EC",
        {
          maximumFractionDigits: 0
        }
      ).format(
        number(value)
      );
    }catch(error){
      return String(
        Math.round(
          number(value)
        )
      );
    }
  }

  function formatPercent(value){
    try{
      return new Intl.NumberFormat(
        "es-EC",
        {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }
      ).format(
        number(value)
      ) + "%";
    }catch(error){
      return (
        number(value)
          .toFixed(1) +
        "%"
      );
    }
  }

  function sections(){
    return Array.isArray(
      config.secciones
    )
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

    return found || {
      id:
        id || "resumen",

      label:
        "Global",

      titulo:
        "Reporte Global",

      pdfTitulo:
        "Reporte Global"
    };
  }

  function safeData(data){
    data =
      data &&
      typeof data === "object"
        ? data
        : {};

    return {
      ok:
        data.ok !== false,

      filters:
        data.filters || {},

      resumen:
        data.resumen || {},

      students:
        Array.isArray(data.students)
          ? data.students
          : [],

      requirements:
        Array.isArray(data.requirements)
          ? data.requirements
          : [],

      periods:
        Array.isArray(data.periods)
          ? data.periods
          : [],

      careers:
        Array.isArray(data.careers)
          ? data.careers
          : [],

      graduados:
        data.graduados &&
        typeof data.graduados === "object"
          ? data.graduados
          : {
            total: 0,
            estudiantes: [],
            porPeriodo: []
          },

      groups:
        data.groups || {},

      generatedAt:
        data.generatedAt || ""
    };
  }

  function currentFilters(provided){
    if(
      provided &&
      typeof provided === "object"
    ){
      return provided;
    }

    if(
      window.GlobalApp &&
      typeof window.GlobalApp
        .getFilters === "function"
    ){
      return (
        window.GlobalApp
          .getFilters() ||
        {}
      );
    }

    return {};
  }

  function selectLabel(
    selector,
    fallback
  ){
    var select =
      document.querySelector(selector);

    if(
      select &&
      select.options &&
      select.selectedIndex >= 0
    ){
      return text(
        select.options[
          select.selectedIndex
        ].text
      ) || fallback;
    }

    return fallback;
  }

  function periodId(item){
    item = item || {};

    return text(
      item.id ||
      item.periodoId ||
      item.value ||
      item.key ||
      item.label ||
      item.periodoLabel ||
      item.nombre
    );
  }

  function periodLabel(item){
    item = item || {};

    return text(
      item.label ||
      item.periodoLabel ||
      item.nombre ||
      item.periodo ||
      periodId(item)
    );
  }

  function dataPeriodList(data){
    var output = [];
    var seen =
      Object.create(null);

    (data.periods || []).forEach(
      function(item){
        var id =
          periodId(item);

        var label =
          periodLabel(item);

        var identity =
          id || label;

        if(
          identity &&
          !seen[identity]
        ){
          seen[identity] = true;

          output.push({
            id:
              id || label,

            label:
              label || id
          });
        }
      }
    );

    if(!output.length){
      (data.students || []).forEach(
        function(row){
          var id = text(
            row._globalPeriodoId ||
            row.periodoId ||
            row.periodo ||
            row.Periodo
          );

          var label = text(
            row._globalPeriodoLabel ||
            row.periodoLabel ||
            row.periodo ||
            row.Periodo ||
            id
          );

          var identity =
            id || label;

          if(
            identity &&
            !seen[identity]
          ){
            seen[identity] = true;

            output.push({
              id:
                id || label,

              label:
                label || id
            });
          }
        }
      );
    }

    return output;
  }

  function selectedPeriodLabel(
    selector,
    rawValue
  ){
    return rawValue
      ? selectLabel(
        selector,
        rawValue
      )
      : "";
  }

  function analyzedPeriodValue(
    filters,
    data
  ){
    var from =
      selectedPeriodLabel(
        "#globalFiltroDesde",
        filters.periodoDesde
      );

    var to =
      selectedPeriodLabel(
        "#globalFiltroHasta",
        filters.periodoHasta
      );

    var list =
      dataPeriodList(data);

    var first =
      list.length
        ? list[0].label
        : "";

    var last =
      list.length
        ? list[
          list.length - 1
        ].label
        : "";

    if(from && to){
      return from === to
        ? from
        : from + " a " + to;
    }

    if(from){
      return (
        "Desde " +
        from +
        (
          last &&
          last !== from
            ? " hasta " + last
            : " en adelante"
        )
      );
    }

    if(to){
      return (
        first &&
        first !== to
          ? (
            "Desde " +
            first +
            " hasta " +
            to
          )
          : "Hasta " + to
      );
    }

    if(first && last){
      return first === last
        ? first
        : first + " a " + last;
    }

    return (
      "Sin información disponible " +
      "para los filtros aplicados"
    );
  }

  function filterRows(
    filters,
    inputData
  ){
    filters =
      currentFilters(filters);

    var data =
      safeData(inputData);

    var rows = [];

    if(
      filters.periodoDesde ||
      filters.periodoHasta
    ){
      rows.push({
        filtro:
          "Período analizado",

        valor:
          analyzedPeriodValue(
            filters,
            data
          )
      });
    }

    if(filters.carrera){
      rows.push({
        filtro:
          "Carrera",

        valor:
          selectLabel(
            "#globalFiltroCarrera",
            filters.carrera
          )
      });
    }

    if(filters.division){
      rows.push({
        filtro:
          "División",

        valor:
          selectLabel(
            "#globalFiltroDivision",
            filters.division
          )
      });
    }

    if(filters.requisito){
      rows.push({
        filtro:
          "Requisito",

        valor:
          selectLabel(
            "#globalFiltroRequisito",
            filters.requisito
          )
      });
    }

    if(filters.tipoCarrera){
      rows.push({
        filtro:
          "Tipo de carrera",

        valor:
          selectLabel(
            "#globalFiltroTipo",
            filters.tipoCarrera
          )
      });
    }

    return rows;
  }

  function appRows(name, data){
    if(
      window.GlobalApp &&
      window.GlobalApp.rows &&
      typeof window.GlobalApp
        .rows[name] === "function"
    ){
      try{
        return (
          window.GlobalApp
            .rows[name](data) ||
          []
        );
      }catch(error){
        return [];
      }
    }

    return [];
  }

  function studentRows(data){
    var rows =
      appRows(
        "students",
        data
      );

    if(rows.length){
      return rows.map(function(row){
        return {
          cedula:
            row.cedula,

          estudiante:
            row.nombres,

          carrera:
            row.carrera,

          tipo:
            row.tipo,

          periodo:
            row.periodo,

          division:
            row.division,

          estado:
            row.matricula,

          cumplimiento:
            number(
              row.cumplimiento
            ) + "%"
        };
      });
    }

    return (data.students || []).map(
      function(row){
        var compliance =
          row._globalCumplimiento ||
          {};

        return {
          cedula:
            row._globalCedula ||
            "",

          estudiante:
            row._globalNombres ||
            "",

          carrera:
            row._globalCarrera ||
            "",

          tipo:
            row._globalTipoCarrera ||
            "",

          periodo:
            row._globalPeriodoLabel ||
            row._globalPeriodoId ||
            "",

          division:
            row._globalDivision ||
            "",

          estado:
            row._globalEstadoMatricula ||
            "",

          cumplimiento:
            number(
              compliance.porcentaje
            ) + "%"
        };
      }
    );
  }

  function summaryRows(data){
    var summary =
      data.resumen || {};

    return [
      {
        indicador:
          "Total estudiantes",

        valor:
          summary.totalEstudiantes ||
          0,

        detalle:
          "Estudiantes incluidos según " +
          "los filtros aplicados."
      },
      {
        indicador:
          "Total graduados",

        valor:
          summary.totalGraduados ||
          0,

        detalle:
          "Estudiantes que completaron " +
          "satisfactoriamente el proceso " +
          "de titulación."
      },
      {
        indicador:
          "Total carreras",

        valor:
          summary.totalCarreras ||
          0,

        detalle:
          "Carreras únicas incluidas " +
          "en el análisis."
      },
      {
        indicador:
          "Total períodos",

        valor:
          summary.totalPeriodos ||
          0,

        detalle:
          "Períodos académicos incluidos " +
          "en el análisis."
      },
      {
        indicador:
          "Cumplimiento general",

        valor:
          (
            summary
              .porcentajeCumplimiento ||
            0
          ) + "%",

        detalle:
          "Promedio institucional de " +
          "cumplimiento de requisitos."
      },
      {
        indicador:
          "Activos",

        valor:
          summary.activos ||
          0,

        detalle:
          "Estudiantes con matrícula activa."
      },
      {
        indicador:
          "Retirados",

        valor:
          summary.retirados ||
          0,

        detalle:
          "Estudiantes registrados " +
          "como retirados."
      }
    ];
  }

  function careerRows(data){
    return appRows(
      "carreras",
      data
    ).map(function(row){
      return {
        carrera:
          row.carrera,

        tipo:
          row.tipo,

        estudiantes:
          row.estudiantes,

        activos:
          row.activos,

        retirados:
          row.retirados,

        cumplimiento:
          number(
            row.cumplimiento
          ) + "%"
      };
    });
  }

  function requirementRows(data){
    return appRows(
      "requisitos",
      data
    ).map(function(row){
      return {
        requisito:
          row.requisito,

        cumple:
          row.cumple,

        pendiente:
          row.pendiente,

        noCumple:
          row.noCumple,

        total:
          row.total,

        cumplimiento:
          number(
            row.cumplimiento
          ) + "%"
      };
    });
  }

  function periodRows(data){
    return appRows(
      "periodos",
      data
    ).map(function(row){
      return {
        periodo:
          row.periodo,

        estudiantes:
          row.estudiantes,

        carreras:
          row.carreras,

        cumplimiento:
          number(
            row.cumplimiento
          ) + "%"
      };
    });
  }

  function typeRows(data){
    return appRows(
      "tipos",
      data
    ).map(function(row){
      return {
        tipo:
          row.tipo,

        estudiantes:
          row.estudiantes,

        carreras:
          row.carreras,

        cumplimiento:
          number(
            row.cumplimiento
          ) + "%"
      };
    });
  }

  function comparisonRows(data){
    return appRows(
      "comparativas",
      data
    );
  }

  function graduateRows(data){
    var rows =
      appRows(
        "graduados",
        data
      );

    if(!rows.length){
      rows =
        data.graduados &&
        Array.isArray(
          data.graduados.porPeriodo
        )
          ? data.graduados.porPeriodo
          : (
            data.groups &&
            Array.isArray(
              data.groups
                .byPeriodoGraduados
            )
              ? data.groups
                .byPeriodoGraduados
              : []
          );
    }

    var total =
      rows.reduce(
        function(sum, row){
          return sum + number(
            row.cantidadGraduados != null
              ? row.cantidadGraduados
              : row.total
          );
        },
        0
      );

    return rows.map(function(row){
      var quantity =
        number(
          row.cantidadGraduados != null
            ? row.cantidadGraduados
            : row.total
        );

      return {
        periodo:
          row.periodo ||
          row.label ||
          row.periodoId ||
          "SIN PERÍODO",

        cantidadGraduados:
          quantity,

        participacion:
          total
            ? formatPercent(
              (
                quantity /
                total
              ) * 100
            )
            : "0,0%"
      };
    });
  }

  function alertRows(data){
    return appRows(
      "alertas",
      data
    );
  }

  function reportRows(data){
    return appRows(
      "reportes",
      data
    ).map(function(row){
      return {
        seccion:
          row.seccion,

        reporte:
          row.reporte,

        estado:
          row.estado,

        registros:
          row.registros,

        alcance:
          row.filtros
      };
    });
  }

  function tableForSection(
    sectionId,
    inputData
  ){
    var data =
      safeData(inputData);

    var map = {
      estudiantes: {
        title:
          "Estudiantes filtrados",

        columns: [
          "cedula",
          "estudiante",
          "carrera",
          "tipo",
          "periodo",
          "division",
          "estado",
          "cumplimiento"
        ],

        rows:
          studentRows(data)
      },

      carreras: {
        title:
          "Carreras incluidas",

        columns: [
          "carrera",
          "tipo",
          "estudiantes",
          "activos",
          "retirados",
          "cumplimiento"
        ],

        rows:
          careerRows(data)
      },

      requisitos: {
        title:
          "Cumplimiento por requisito",

        columns: [
          "requisito",
          "cumple",
          "pendiente",
          "noCumple",
          "total",
          "cumplimiento"
        ],

        rows:
          requirementRows(data)
      },

      periodos: {
        title:
          "Comparativa por período académico",

        columns: [
          "periodo",
          "estudiantes",
          "carreras",
          "cumplimiento"
        ],

        rows:
          periodRows(data)
      },

      "tipo-carrera": {
        title:
          "Comparativa por tipo de carrera",

        columns: [
          "tipo",
          "estudiantes",
          "carreras",
          "cumplimiento"
        ],

        rows:
          typeRows(data)
      },

      comparativas: {
        title:
          "Comparativa entre período " +
          "y tipo de carrera",

        columns: [
          "periodo",
          "tipo",
          "estudiantes",
          "carreras"
        ],

        rows:
          comparisonRows(data)
      },

      graduados: {
        title:
          "Detalle de graduados por " +
          "período académico",

        columns: [
          "periodo",
          "cantidadGraduados",
          "participacion"
        ],

        rows:
          graduateRows(data)
      },

      alertas: {
        title:
          "Alertas institucionales",

        columns: [
          "alerta",
          "detalle",
          "cantidad",
          "prioridad"
        ],

        rows:
          alertRows(data)
      },

      reportes: {
        title:
          "Reportes disponibles",

        columns: [
          "seccion",
          "reporte",
          "estado",
          "registros",
          "alcance"
        ],

        rows:
          reportRows(data)
      },

      resumen: {
        title:
          "Indicadores generales",

        columns: [
          "indicador",
          "valor",
          "detalle"
        ],

        rows:
          summaryRows(data)
      }
    };

    return (
      map[sectionId] ||
      map.resumen
    );
  }

  function topItem(rows, field){
    if(
      !Array.isArray(rows) ||
      !rows.length
    ){
      return null;
    }

    return rows
      .slice()
      .sort(function(a, b){
        return (
          number(b[field]) -
          number(a[field])
        );
      })[0] || null;
  }

  function bottomItem(rows, field){
    if(
      !Array.isArray(rows) ||
      !rows.length
    ){
      return null;
    }

    return rows
      .slice()
      .sort(function(a, b){
        return (
          number(a[field]) -
          number(b[field])
        );
      })[0] || null;
  }

  function summaryText(
    section,
    inputData
  ){
    var data =
      safeData(inputData);

    var summary =
      data.resumen || {};

    var rows =
      graduateRows(data);

    var totalGraduates =
      number(
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
          totalGraduates /
          periods
        )
        : 0;

    if(section.id === "graduados"){
      if(!rows.length){
        return [
          "No se registran estudiantes graduados " +
          "para los filtros aplicados.",

          "Al no existir registros, no es posible " +
          "establecer comparaciones entre períodos " +
          "académicos."
        ];
      }

      return [
        "Conforme a los filtros aplicados, se " +
        "identificaron " +
        formatInteger(totalGraduates) +
        " estudiantes graduados distribuidos en " +
        formatInteger(periods) +
        " períodos académicos.",

        "El promedio observado es de " +
        formatInteger(average) +
        " graduados por período académico " +
        "con registros.",

        "Los resultados permiten comparar la " +
        "distribución histórica de graduados e " +
        "identificar los períodos con mayor y " +
        "menor concentración."
      ];
    }

    return [
      "El informe incluye " +
      formatInteger(
        summary.totalEstudiantes ||
        data.students.length
      ) +
      " estudiantes según los filtros seleccionados.",

      "Se analizaron " +
      formatInteger(
        summary.totalCarreras || 0
      ) +
      " carreras y " +
      formatInteger(
        summary.totalPeriodos ||
        data.periods.length
      ) +
      " períodos académicos.",

      "El cumplimiento general registrado es de " +
      formatInteger(
        summary.porcentajeCumplimiento || 0
      ) +
      "% sobre los requisitos analizados."
    ];
  }

  function observations(
    section,
    inputData
  ){
    var data =
      safeData(inputData);

    if(section.id === "graduados"){
      var rows =
        graduateRows(data);

      if(!rows.length){
        return [
          "No existen datos suficientes para " +
          "generar observaciones comparativas."
        ];
      }

      if(rows.length === 1){
        return [
          "El reporte contiene un único período " +
          "académico: " +
          rows[0].periodo +
          ", con " +
          formatInteger(
            rows[0].cantidadGraduados
          ) +
          " graduados.",

          "No es posible establecer una comparación " +
          "histórica con un solo período."
        ];
      }

      var max =
        topItem(
          rows,
          "cantidadGraduados"
        );

      var min =
        bottomItem(
          rows,
          "cantidadGraduados"
        );

      var difference =
        number(
          max.cantidadGraduados
        ) -
        number(
          min.cantidadGraduados
        );

      return [
        "El período con mayor número de graduados " +
        "es " +
        max.periodo +
        ", con " +
        formatInteger(
          max.cantidadGraduados
        ) +
        " estudiantes.",

        "El período con menor número de graduados " +
        "es " +
        min.periodo +
        ", con " +
        formatInteger(
          min.cantidadGraduados
        ) +
        " estudiantes.",

        "La diferencia entre el mayor y el menor " +
        "registro es de " +
        formatInteger(difference) +
        " graduados."
      ];
    }

    var summary =
      data.resumen || {};

    var items = [];

    if(
      number(
        summary.retirados
      ) > 0
    ){
      items.push(
        "Se registran " +
        formatInteger(
          summary.retirados
        ) +
        " estudiantes retirados dentro del " +
        "universo filtrado."
      );
    }

    if(
      number(
        summary.porcentajeCumplimiento
      ) < 70
    ){
      items.push(
        "El cumplimiento general es inferior al " +
        "70%; se recomienda revisar los requisitos " +
        "con mayor número de pendientes o " +
        "incumplimientos."
      );
    }

    if(!items.length){
      items.push(
        "No se detectaron observaciones críticas " +
        "adicionales para los filtros aplicados."
      );
    }

    return items;
  }

  function label(key){
    var labels = {
      cedula:
        "Cédula",

      estudiante:
        "Estudiante",

      carrera:
        "Carrera",

      tipo:
        "Tipo",

      periodo:
        "Período académico",

      division:
        "División",

      estado:
        "Matrícula",

      cumplimiento:
        "Cumplimiento",

      indicador:
        "Indicador",

      valor:
        "Valor",

      detalle:
        "Detalle",

      estudiantes:
        "Estudiantes",

      activos:
        "Activos",

      retirados:
        "Retirados",

      requisito:
        "Requisito",

      cumple:
        "Cumple",

      pendiente:
        "Pendiente",

      noCumple:
        "No cumple",

      total:
        "Total",

      carreras:
        "Carreras",

      cantidadGraduados:
        "Número de graduados",

      participacion:
        "Participación sobre el total",

      alerta:
        "Tipo de alerta",

      cantidad:
        "Cantidad / indicador",

      prioridad:
        "Prioridad",

      seccion:
        "Sección",

      reporte:
        "Reporte",

      registros:
        "Registros",

      alcance:
        "Alcance"
    };

    return (
      labels[key] ||
      key
    );
  }

  function tableExplanation(title){
    title =
      text(title)
        .toLowerCase();

    if(
      title.indexOf(
        "graduados"
      ) >= 0
    ){
      return (
        "La tabla presenta el número exacto de " +
        "estudiantes graduados en cada período " +
        "académico y su participación porcentual " +
        "dentro del total analizado."
      );
    }

    if(
      title.indexOf(
        "requisito"
      ) >= 0
    ){
      return (
        "La tabla permite comparar el estado de " +
        "cumplimiento de cada requisito en el " +
        "universo filtrado."
      );
    }

    if(
      title.indexOf(
        "período"
      ) >= 0 ||
      title.indexOf(
        "periodo"
      ) >= 0
    ){
      return (
        "La tabla resume los resultados obtenidos " +
        "para cada período académico incluido en " +
        "el análisis."
      );
    }

    return (
      "La tabla muestra el detalle de los registros " +
      "que conforman esta sección del informe."
    );
  }

  function renderTable(table, limit){
    table = table || {
      title:
        "Detalle",

      columns:
        [],

      rows:
        []
    };

    var columns =
      Array.isArray(table.columns)
        ? table.columns
        : [];

    var rows =
      Array.isArray(table.rows)
        ? table.rows
        : [];

    var max =
      Math.max(
        1,
        Number(limit || 350)
      );

    var visibleRows =
      rows.slice(
        0,
        max
      );

    return ""
      + '<section class="report-block table-block">'

      + "<h2>"
      + esc(
        table.title ||
        "Detalle"
      )
      + "</h2>"

      + '<p class="section-explanation">'
      + esc(
        tableExplanation(
          table.title
        )
      )
      + "</p>"

      + '<div class="table-wrap">'

      + "<table>"

      + "<thead>"
      + "<tr>"

      + columns.map(function(column){
        return (
          "<th>" +
          esc(
            label(column)
          ) +
          "</th>"
        );
      }).join("")

      + "</tr>"
      + "</thead>"

      + "<tbody>"

      + (
        visibleRows.length
          ? visibleRows.map(function(row){
            return ""
              + "<tr>"

              + columns.map(function(column){
                return ""
                  + "<td>"
                  + esc(
                    row &&
                    row[column] != null
                      ? row[column]
                      : ""
                  )
                  + "</td>";
              }).join("")

              + "</tr>";
          }).join("")

          : (
            '<tr><td class="empty-cell" colspan="'
            + Math.max(
              columns.length,
              1
            )
            + '">'
            + "No existen registros para los "
            + "filtros aplicados."
            + "</td></tr>"
          )
      )

      + "</tbody>"
      + "</table>"
      + "</div>"

      + (
        rows.length > max
          ? (
            '<p class="footer-note">'
            + "Se muestran los primeros "
            + formatInteger(max)
            + " registros de un total de "
            + formatInteger(rows.length)
            + ".</p>"
          )
          : ""
      )

      + "</section>";
  }

  function renderList(items){
    items =
      Array.isArray(items)
        ? items
        : [];

    return ""
      + '<ul class="report-list">'

      + items.map(function(item){
        return (
          "<li>" +
          esc(item) +
          "</li>"
        );
      }).join("")

      + "</ul>";
  }

  function graduateSummaryCards(data){
    data =
      safeData(data);

    var rows =
      graduateRows(data);

    var total =
      number(
        data.graduados &&
        data.graduados.total != null
          ? data.graduados.total
          : data.resumen
            .totalGraduados
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

    return ""
      + '<section class="metric-grid"'
      + ' aria-label="Resumen de graduados">'

      + '<article class="metric-card">'
      + "<span>Total de graduados</span>"
      + "<strong>"
      + formatInteger(total)
      + "</strong>"
      + "<p>"
      + "Estudiantes que completaron "
      + "satisfactoriamente el proceso "
      + "de titulación."
      + "</p>"
      + "</article>"

      + '<article class="metric-card">'
      + "<span>"
      + "Períodos académicos analizados"
      + "</span>"
      + "<strong>"
      + formatInteger(periods)
      + "</strong>"
      + "<p>"
      + "Períodos que registran al menos "
      + "un estudiante graduado."
      + "</p>"
      + "</article>"

      + '<article class="metric-card">'
      + "<span>"
      + "Promedio de graduados por período"
      + "</span>"
      + "<strong>"
      + formatInteger(average)
      + "</strong>"
      + "<p>"
      + "Promedio de estudiantes graduados "
      + "en los períodos académicos analizados."
      + "</p>"
      + "</article>"

      + "</section>";
  }

  function graduateChart(data){
    var rows =
      graduateRows(
        safeData(data)
      );

    if(
      !window.GlobalChart ||
      typeof window.GlobalChart
        .buildBarSVG !== "function"
    ){
      return (
        '<div class="chart-unavailable">'
        + "No fue posible construir el gráfico "
        + "porque GlobalChart no está disponible."
        + "</div>"
      );
    }

    return ""
      + '<section class="report-block chart-block">'

      + "<h2>"
      + "Distribución de graduados por "
      + "período académico"
      + "</h2>"

      + '<p class="section-explanation">'
      + "El gráfico compara la cantidad de estudiantes "
      + "graduados en cada período académico. La longitud "
      + "de cada barra representa el número de graduados "
      + "correspondiente, lo que permite identificar "
      + "variaciones y concentraciones entre los períodos "
      + "analizados."
      + "</p>"

      + '<div class="chart-frame">'

      + window.GlobalChart.buildBarSVG(
        rows,
        {
          labelKey:
            "periodo",

          valueKey:
            "cantidadGraduados",

          orientation:
            "horizontal",

          fullLabels:
            true,

          labelChars:
            38,

          maxLabelLines:
            4,

          rowHeight:
            66,

          width:
            1060,

          ariaLabel:
            "Cantidad de graduados por período académico",

          emptyMessage:
            "No existen graduados para los filtros aplicados."
        }
      )

      + "</div>"

      + '<div class="chart-interpretation">'

      + "<h3>"
      + "Interpretación del gráfico"
      + "</h3>"

      + renderList(
        observations(
          {
            id: "graduados"
          },
          data
        )
      )

      + "</div>"

      + "</section>";
  }

  function institutionalCss(){
    var branding =
      config.branding || {};

    var navy =
      text(
        branding.azulMarino ||
        "#071A33"
      );

    var navy2 =
      text(
        branding.azulMarino2 ||
        "#0B2447"
      );

    var gold =
      text(
        branding.dorado ||
        "#C9A227"
      );

    var soft =
      text(
        branding.fondo ||
        "#F4F6FA"
      );

    var ink =
      text(
        branding.texto ||
        "#1F2937"
      );

    return ""
      + "*{box-sizing:border-box}"

      + "html,body{"
      + "margin:0;"
      + "padding:0;"
      + "background:#fff;"
      + "color:" + ink + ";"
      + "font-family:Arial,Helvetica,sans-serif;"
      + "font-size:12px;"
      + "line-height:1.45;"
      + "}"

      + "@page{"
      + "size:A4;"
      + "margin:14mm 13mm 15mm;"
      + "}"

      + "body{"
      + "print-color-adjust:exact;"
      + "-webkit-print-color-adjust:exact;"
      + "}"

      + ".cover{"
      + "min-height:255mm;"
      + "background:#fff;"
      + "display:flex;"
      + "flex-direction:column;"
      + "page-break-after:always;"
      + "border:1px solid #e1e7ef;"
      + "}"

      + ".cover-brand{"
      + "background:" + navy + ";"
      + "padding:30mm 18mm 24mm;"
      + "text-align:center;"
      + "border-bottom:5px solid " + gold + ";"
      + "}"

      + ".cover-logo{"
      + "display:block;"
      + "max-width:190px;"
      + "max-height:95px;"
      + "margin:0 auto;"
      + "object-fit:contain;"
      + "}"

      + ".cover-logo-fallback{"
      + "display:none;"
      + "color:#fff;"
      + "font-weight:700;"
      + "font-size:20px;"
      + "letter-spacing:.04em;"
      + "}"

      + ".cover-main{"
      + "flex:1;"
      + "padding:24mm 22mm 18mm;"
      + "display:flex;"
      + "flex-direction:column;"
      + "justify-content:center;"
      + "text-align:center;"
      + "}"

      + ".cover-kicker{"
      + "margin:0 0 12px;"
      + "color:" + gold + ";"
      + "font-weight:800;"
      + "text-transform:uppercase;"
      + "letter-spacing:.12em;"
      + "}"

      + ".cover h1{"
      + "margin:0;"
      + "color:" + navy + ";"
      + "font-size:30px;"
      + "line-height:1.15;"
      + "}"

      + ".cover-subtitle{"
      + "margin:14px auto 0;"
      + "max-width:620px;"
      + "color:#526078;"
      + "font-size:15px;"
      + "}"

      + ".cover-meta{"
      + "margin-top:30px;"
      + "padding-top:18px;"
      + "border-top:1px solid #d8e0ea;"
      + "color:#445269;"
      + "}"

      + ".print-header{"
      + "display:flex;"
      + "justify-content:space-between;"
      + "gap:20px;"
      + "align-items:center;"
      + "background:" + navy + ";"
      + "color:#fff;"
      + "border-bottom:3px solid " + gold + ";"
      + "padding:12px 18px;"
      + "margin-bottom:18px;"
      + "}"

      + ".print-header strong{"
      + "color:" + gold + ";"
      + "}"

      + ".content{"
      + "width:100%;"
      + "}"

      + ".page{"
      + "page-break-after:always;"
      + "}"

      + ".page:last-child{"
      + "page-break-after:auto;"
      + "}"

      + "h2{"
      + "color:" + navy + ";"
      + "font-size:18px;"
      + "margin:22px 0 9px;"
      + "border-bottom:2px solid " + gold + ";"
      + "padding-bottom:6px;"
      + "}"

      + "h3{"
      + "color:" + navy2 + ";"
      + "font-size:14px;"
      + "margin:12px 0 6px;"
      + "}"

      + ".section-explanation{"
      + "margin:0 0 12px;"
      + "color:#536177;"
      + "line-height:1.6;"
      + "}"

      + ".info-grid{"
      + "display:grid;"
      + "grid-template-columns:repeat(2,minmax(0,1fr));"
      + "gap:10px;"
      + "}"

      + ".info-card{"
      + "border:1px solid #d5dde8;"
      + "border-left:4px solid " + gold + ";"
      + "border-radius:9px;"
      + "padding:10px 12px;"
      + "background:#f8fafc;"
      + "min-height:62px;"
      + "}"

      + ".info-card b{"
      + "display:block;"
      + "color:" + navy + ";"
      + "font-size:11px;"
      + "text-transform:uppercase;"
      + "margin-bottom:4px;"
      + "}"

      + ".info-card span{"
      + "display:block;"
      + "font-size:12px;"
      + "overflow-wrap:anywhere;"
      + "}"

      + ".report-list{"
      + "margin:0 0 12px;"
      + "padding-left:20px;"
      + "}"

      + ".report-list li{"
      + "margin:5px 0;"
      + "}"

      + ".metric-grid{"
      + "display:grid;"
      + "grid-template-columns:repeat(3,minmax(0,1fr));"
      + "gap:12px;"
      + "margin:14px 0 20px;"
      + "}"

      + ".metric-card{"
      + "border:1px solid #d5dde8;"
      + "border-top:4px solid " + gold + ";"
      + "border-radius:10px;"
      + "padding:12px;"
      + "background:#f8fafc;"
      + "min-height:120px;"
      + "}"

      + ".metric-card span{"
      + "display:block;"
      + "color:" + navy + ";"
      + "font-weight:800;"
      + "font-size:11px;"
      + "text-transform:uppercase;"
      + "}"

      + ".metric-card strong{"
      + "display:block;"
      + "color:" + navy + ";"
      + "font-size:30px;"
      + "line-height:1;"
      + "margin:10px 0;"
      + "}"

      + ".metric-card p{"
      + "margin:0;"
      + "color:#617089;"
      + "font-size:10px;"
      + "line-height:1.45;"
      + "}"

      + ".report-block{"
      + "break-inside:avoid;"
      + "margin-bottom:18px;"
      + "}"

      + ".chart-frame{"
      + "border:1px solid #d7e0ea;"
      + "border-radius:12px;"
      + "padding:8px;"
      + "background:#fff;"
      + "overflow:visible;"
      + "}"

      + ".chart-frame svg{"
      + "display:block;"
      + "width:100%;"
      + "height:auto;"
      + "overflow:visible;"
      + "}"

      + ".chart-interpretation{"
      + "margin-top:10px;"
      + "border-left:4px solid " + gold + ";"
      + "padding:8px 12px;"
      + "background:" + soft + ";"
      + "}"

      + ".chart-unavailable{"
      + "padding:18px;"
      + "border:1px dashed #aab6c6;"
      + "text-align:center;"
      + "}"

      + ".global-chart-background{"
      + "fill:#fff;"
      + "}"

      + ".global-chart-grid-line{"
      + "stroke:#dfe5ed;"
      + "stroke-width:1;"
      + "}"

      + ".global-chart-axis-line{"
      + "stroke:#75839a;"
      + "stroke-width:1.4;"
      + "}"

      + ".global-chart-axis-text{"
      + "fill:#617089;"
      + "font-size:12px;"
      + "}"

      + ".global-chart-category{"
      + "fill:" + navy + ";"
      + "font-size:12px;"
      + "font-weight:600;"
      + "}"

      + ".global-chart-value{"
      + "fill:" + navy + ";"
      + "font-size:12px;"
      + "font-weight:800;"
      + "}"

      + ".global-chart-bar{"
      + "fill:" + navy2 + ";"
      + "}"

      + ".global-chart-empty-text{"
      + "fill:#617089;"
      + "font-size:14px;"
      + "}"

      + ".table-wrap{"
      + "width:100%;"
      + "overflow:visible;"
      + "}"

      + "table{"
      + "width:100%;"
      + "border-collapse:collapse;"
      + "table-layout:auto;"
      + "font-size:9.2px;"
      + "}"

      + "thead{"
      + "display:table-header-group;"
      + "}"

      + "tr{"
      + "break-inside:avoid;"
      + "}"

      + "th{"
      + "background:" + navy + ";"
      + "color:#fff;"
      + "text-align:left;"
      + "padding:7px 6px;"
      + "border:1px solid #2d425f;"
      + "}"

      + "td{"
      + "padding:6px;"
      + "border:1px solid #d8e0ea;"
      + "vertical-align:top;"
      + "overflow-wrap:anywhere;"
      + "}"

      + "tbody tr:nth-child(even){"
      + "background:#f6f8fb;"
      + "}"

      + ".empty-cell{"
      + "text-align:center;"
      + "padding:20px;"
      + "color:#66758a;"
      + "}"

      + ".footer-note{"
      + "margin-top:14px;"
      + "color:#6d7a8d;"
      + "font-size:9px;"
      + "border-top:1px solid #dde4ec;"
      + "padding-top:8px;"
      + "}"

      + ".method-note{"
      + "margin-top:16px;"
      + "padding:12px;"
      + "border:1px solid #d8e0ea;"
      + "background:#f8fafc;"
      + "border-radius:8px;"
      + "}"

      + "@media print{"

      + ".page{"
      + "page-break-after:always;"
      + "}"

      + ".page:last-child{"
      + "page-break-after:auto;"
      + "}"

      + ".report-block,"
      + ".metric-card,"
      + ".info-card{"
      + "break-inside:avoid;"
      + "}"

      + ".print-header{"
      + "position:static;"
      + "}"

      + "}";
  }

  function noteMethodology(section){
    if(section.id === "graduados"){
      return ""
        + '<section class="method-note">'

        + "<h3>"
        + "Nota metodológica"
        + "</h3>"

        + "<p>"
        + "Se considera graduado al estudiante cuyo "
        + "requisito de aprobación de titulación se "
        + "encuentra registrado como cumplido en la "
        + "Base Local institucional. Cada estudiante "
        + "se contabiliza una sola vez dentro de su "
        + "período académico. Los períodos sin graduados "
        + "no intervienen en el cálculo del promedio."
        + "</p>"

        + "</section>";
    }

    return ""
      + '<section class="method-note">'

      + "<h3>"
      + "Nota metodológica"
      + "</h3>"

      + "<p>"
      + "Los resultados corresponden a la información "
      + "disponible en la Base Local institucional y a "
      + "los filtros aplicados al momento de generar "
      + "el informe."
      + "</p>"

      + "</section>";
  }

  function generate(options){
    options = options || {};

    var section =
      sectionById(
        options.section ||
        "resumen"
      );

    var data =
      safeData(
        options.data
      );

    var filters =
      currentFilters(
        options.filters ||
        data.filters
      );

    var table =
      tableForSection(
        section.id,
        data
      );

    var branding =
      config.branding || {};

    var logoUrl =
      absoluteUrl(
        branding.logoPath ||
        "assets/branding/logo-instituto.png"
      );

    var title =
      section.pdfTitulo ||
      section.titulo ||
      section.label ||
      "Reporte Global";

    var graduateContent =
      section.id === "graduados"
        ? (
          graduateSummaryCards(data) +
          graduateChart(data)
        )
        : "";

    var html = ""
      + "<!doctype html>"

      + '<html lang="es">'

      + "<head>"

      + '<meta charset="utf-8">'

      + '<meta name="viewport"'
      + ' content="width=device-width,initial-scale=1">'

      + "<title>"
      + esc(title)
      + "</title>"

      + "<style>"
      + institutionalCss()
      + "</style>"

      + "</head>"

      + "<body>"

      + '<section class="cover">'

      + '<div class="cover-brand">'

      + '<img class="cover-logo"'
      + ' src="' + esc(logoUrl) + '"'
      + ' alt="Logo institucional"'
      + ' onerror="'
      + "this.style.display='none';"
      + "this.nextElementSibling.style.display='block';"
      + '">'

      + '<div class="cover-logo-fallback">'

      + esc(
        branding.logoFallbackText ||
        "Logo institucional"
      )

      + "</div>"

      + "</div>"

      + '<div class="cover-main">'

      + '<p class="cover-kicker">'

      + esc(
        config.app &&
        config.app.unidad
          ? config.app.unidad
          : (
            "Unidad de Titulación y " +
            "Eficiencia Terminal"
          )
      )

      + "</p>"

      + "<h1>"
      + esc(title)
      + "</h1>"

      + '<p class="cover-subtitle">'

      + "Informe institucional generado con la "
      + "información disponible en la Base Local "
      + "y los filtros seleccionados."

      + "</p>"

      + '<div class="cover-meta">'

      + "<p>"

      + "<strong>Sección:</strong> "

      + esc(
        section.label ||
        "Global"
      )

      + "</p>"

      + "<p>"

      + "<strong>Fecha de generación:</strong> "

      + esc(now())

      + "</p>"

      + "</div>"

      + "</div>"

      + "</section>"

      + '<div class="print-header">'

      + "<span>"

      + "<strong>"
      + "Unidad de Titulación y Eficiencia Terminal"
      + "</strong>"

      + " · Informe institucional"

      + "</span>"

      + "<span>"

      + "Sección: "

      + esc(
        section.label ||
        "Global"
      )

      + "</span>"

      + "</div>"

      + '<main class="content">'

      + '<section class="page">'

      + "<h2>"
      + "Alcance y filtros del informe"
      + "</h2>"

      + '<p class="section-explanation">'

      + "Los siguientes criterios delimitan la "
      + "información incluida en este documento. "
      + "Se muestran únicamente los filtros "
      + "seleccionados por el usuario."

      + "</p>"

      + '<div class="info-grid">'

      + filterRows(
        filters,
        data
      ).map(function(row){
        return ""
          + '<div class="info-card">'

          + "<b>"
          + esc(row.filtro)
          + "</b>"

          + "<span>"
          + esc(row.valor)
          + "</span>"

          + "</div>";
      }).join("")

      + "</div>"

      + "<h2>"
      + "Resumen ejecutivo"
      + "</h2>"

      + renderList(
        summaryText(
          section,
          data
        )
      )

      + "<h2>"
      + "Hallazgos principales"
      + "</h2>"

      + renderList(
        observations(
          section,
          data
        )
      )

      + "</section>"

      + '<section class="page">'

      + graduateContent

      + renderTable(
        table,
        350
      )

      + noteMethodology(
        section
      )

      + '<p class="footer-note">'

      + "Este informe fue generado automáticamente "
      + "con base en la información registrada en la "
      + "Base Local institucional y los filtros "
      + "seleccionados por el usuario."

      + "</p>"

      + "</section>"

      + "</main>"

      + "<script>"

      + "(function(){"

      + "function ready(){"

      + "window.setTimeout(function(){"

      + "window.focus();"

      + "window.print();"

      + "},500);"

      + "}"

      + "if(document.readyState==='complete'){"

      + "ready();"

      + "}else{"

      + "window.addEventListener('load',ready);"

      + "}"

      + "})();"

      + "<\/script>"

      + "</body>"

      + "</html>";

    var printWindow =
      window.open(
        "",
        "_blank"
      );

    if(!printWindow){
      window.alert(
        "No se pudo abrir la ventana del informe. " +
        "Habilita las ventanas emergentes para continuar."
      );

      return false;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    return true;
  }

  window.GlobalPDF = {
    version:
      VERSION,

    generate:
      generate,

    tableForSection:
      tableForSection,

    summaryText:
      summaryText,

    observations:
      observations,

    graduateRows:
      graduateRows,

    graduateChart:
      graduateChart,

    filterRows:
      filterRows
  };
})(window, document);