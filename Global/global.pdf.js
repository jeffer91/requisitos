/* =========================================================
Nombre completo: global.pdf.js
Ruta o ubicación: /Requisitos/Global/global.pdf.js
Función o funciones:
- Generar el PDF institucional de la sección activa de Global.
- Aplicar los filtros superiores vigentes al contenido del reporte.
- Crear portada, resumen ejecutivo, observaciones y tabla institucional.
- Incluir total, tabla y gráfico de graduados por período.
- Funcionar sin librerías externas mediante una ventana imprimible.
Con qué se conecta:
- global.config.js
- global.core.js
- global.app.js
- global.chart.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.1.0-graduados";
  var config = window.GlobalConfig || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function number(value){
    var parsed = Number(value);

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
      ).format(new Date());
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
      ).format(number(value));
    }catch(error){
      return String(
        Math.round(
          number(value)
        )
      );
    }
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

    return found || {
      id: id || "resumen",
      label: "Global",
      titulo: "Reporte Global",
      pdfTitulo: "Reporte Global"
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
      typeof window.GlobalApp.getFilters === "function"
    ){
      return (
        window.GlobalApp.getFilters() ||
        {}
      );
    }

    return {};
  }

  function selectLabel(selector, fallback){
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

  function filterRows(filters){
    filters =
      currentFilters(filters);

    return [
      {
        filtro: "Período desde",

        valor:
          filters.periodoDesde
            ? selectLabel(
              "#globalFiltroDesde",
              filters.periodoDesde
            )
            : "Todos"
      },
      {
        filtro: "Período hasta",

        valor:
          filters.periodoHasta
            ? selectLabel(
              "#globalFiltroHasta",
              filters.periodoHasta
            )
            : "Todos"
      },
      {
        filtro: "Carrera",

        valor:
          filters.carrera
            ? selectLabel(
              "#globalFiltroCarrera",
              filters.carrera
            )
            : "Todas las carreras"
      },
      {
        filtro: "División",

        valor:
          filters.division
            ? selectLabel(
              "#globalFiltroDivision",
              filters.division
            )
            : "Todas las divisiones"
      },
      {
        filtro: "Requisito",

        valor:
          filters.requisito
            ? selectLabel(
              "#globalFiltroRequisito",
              filters.requisito
            )
            : "Todos los requisitos"
      },
      {
        filtro: "Tipo de carrera",

        valor:
          filters.tipoCarrera
            ? selectLabel(
              "#globalFiltroTipo",
              filters.tipoCarrera
            )
            : "Todas"
      }
    ];
  }

  function appRows(name, data){
    if(
      window.GlobalApp &&
      window.GlobalApp.rows &&
      typeof window.GlobalApp.rows[name] === "function"
    ){
      try{
        return (
          window.GlobalApp.rows[name](data) ||
          []
        );
      }catch(error){}
    }

    return [];
  }

  function studentRows(data){
    var fromApp =
      appRows("students", data);

    if(fromApp.length){
      return fromApp.map(function(row){
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

    return (data.students || []).map(function(row){
      var compliance =
        row._globalCumplimiento || {};

      return {
        cedula:
          row._globalCedula || "",

        estudiante:
          row._globalNombres || "",

        carrera:
          row._globalCarrera || "",

        tipo:
          row._globalTipoCarrera || "",

        periodo:
          row._globalPeriodoLabel ||
          row._globalPeriodoId ||
          "",

        division:
          row._globalDivision || "",

        estado:
          row._globalEstadoMatricula || "",

        cumplimiento:
          number(
            compliance.porcentaje
          ) + "%"
      };
    });
  }

  function summaryRows(data){
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
        detalle: "AprobacionTitulacion en estado CUMPLE."
      },
      {
        indicador: "Total carreras",
        valor: summary.totalCarreras || 0,
        detalle: "Carreras únicas incluidas."
      },
      {
        indicador: "Total períodos",
        valor: summary.totalPeriodos || 0,
        detalle: "Períodos académicos incluidos."
      },
      {
        indicador: "Cumplimiento general",

        valor:
          (
            summary.porcentajeCumplimiento ||
            0
          ) + "%",

        detalle:
          "Promedio calculado sobre los requisitos."
      },
      {
        indicador: "Activos",
        valor: summary.activos || 0,
        detalle: "Estudiantes activos."
      },
      {
        indicador: "Retirados",
        valor: summary.retirados || 0,
        detalle: "Estudiantes retirados."
      }
    ];
  }

  function careerRows(data){
    var fromApp =
      appRows("carreras", data);

    return fromApp.map(function(row){
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
    var fromApp =
      appRows("requisitos", data);

    return fromApp.map(function(row){
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
    var fromApp =
      appRows("periodos", data);

    return fromApp.map(function(row){
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
    var fromApp =
      appRows("tipos", data);

    return fromApp.map(function(row){
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
      appRows("graduados", data);

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
              data.groups.byPeriodoGraduados
            )
              ? data.groups.byPeriodoGraduados
              : []
          );
    }

    return rows.map(function(row){
      return {
        periodo:
          row.periodo ||
          row.label ||
          row.periodoId ||
          "SIN PERÍODO",

        cantidadGraduados:
          number(
            row.cantidadGraduados != null
              ? row.cantidadGraduados
              : row.total
          )
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

  function tableForSection(sectionId, inputData){
    var data =
      safeData(inputData);

    if(sectionId === "estudiantes"){
      return {
        title: "Estudiantes filtrados",

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
      };
    }

    if(sectionId === "carreras"){
      return {
        title: "Carreras",

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
      };
    }

    if(sectionId === "requisitos"){
      return {
        title: "Cumplimiento por requisito",

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
      };
    }

    if(sectionId === "periodos"){
      return {
        title: "Períodos académicos",

        columns: [
          "periodo",
          "estudiantes",
          "carreras",
          "cumplimiento"
        ],

        rows:
          periodRows(data)
      };
    }

    if(sectionId === "tipo-carrera"){
      return {
        title: "Universitaria vs Superior",

        columns: [
          "tipo",
          "estudiantes",
          "carreras",
          "cumplimiento"
        ],

        rows:
          typeRows(data)
      };
    }

    if(sectionId === "comparativas"){
      return {
        title:
          "Comparativa por período y tipo de carrera",

        columns: [
          "periodo",
          "tipo",
          "estudiantes",
          "carreras"
        ],

        rows:
          comparisonRows(data)
      };
    }

    if(sectionId === "graduados"){
      return {
        title:
          "Graduados por período",

        columns: [
          "periodo",
          "cantidadGraduados"
        ],

        rows:
          graduateRows(data)
      };
    }

    if(sectionId === "alertas"){
      return {
        title:
          "Alertas detectadas",

        columns: [
          "alerta",
          "detalle",
          "cantidad",
          "prioridad"
        ],

        rows:
          alertRows(data)
      };
    }

    if(sectionId === "reportes"){
      return {
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
      };
    }

    return {
      title:
        "Indicadores generales",

      columns: [
        "indicador",
        "valor",
        "detalle"
      ],

      rows:
        summaryRows(data)
    };
  }

  function topItem(rows, field){
    return (
      Array.isArray(rows)
        ? rows
        : []
    ).slice().sort(function(a, b){
      return (
        number(b[field]) -
        number(a[field])
      );
    })[0] || null;
  }

  function summaryText(section, inputData){
    var data =
      safeData(inputData);

    var summary =
      data.resumen || {};

    var paragraphs = [];

    paragraphs.push(
      "El presente reporte corresponde a la sección " +
      (
        section.label ||
        section.titulo ||
        "Global"
      ) +
      " del módulo Global de la Unidad de Titulación y Eficiencia Terminal."
    );

    if(section.id === "graduados"){
      var graduates =
        graduateRows(data);

      var total =
        number(
          data.graduados &&
          data.graduados.total != null
            ? data.graduados.total
            : summary.totalGraduados
        );

      var topPeriod =
        topItem(
          graduates,
          "cantidadGraduados"
        );

      paragraphs.push(
        "Con los filtros aplicados se identifican " +
        total +
        " graduados. Se considera graduado únicamente al estudiante cuyo campo AprobacionTitulacion contiene el valor CUMPLE."
      );

      paragraphs.push(
        "Los graduados se distribuyen en " +
        graduates.length +
        " períodos académicos con resultados registrados."
      );

      if(topPeriod){
        paragraphs.push(
          "El período con mayor cantidad de graduados es " +
          topPeriod.periodo +
          ", con " +
          topPeriod.cantidadGraduados +
          " estudiantes."
        );
      }

      return paragraphs;
    }

    paragraphs.push(
      "Con los filtros aplicados se identifican " +
      (
        summary.totalEstudiantes ||
        0
      ) +
      " estudiantes, " +
      (
        summary.totalCarreras ||
        0
      ) +
      " carreras y " +
      (
        summary.totalPeriodos ||
        0
      ) +
      " períodos académicos incluidos en el análisis."
    );

    paragraphs.push(
      "El cumplimiento general calculado sobre los requisitos detectados es de " +
      (
        summary.porcentajeCumplimiento ||
        0
      ) +
      "%. Estos valores se generan a partir de la información registrada en la Base Local institucional."
    );

    var career =
      topItem(
        careerRows(data),
        "estudiantes"
      );

    var requirement =
      topItem(
        requirementRows(data),
        "noCumple"
      );

    if(career){
      paragraphs.push(
        "La carrera con mayor cantidad de estudiantes dentro del filtro es " +
        career.carrera +
        ", con " +
        career.estudiantes +
        " registros."
      );
    }

    if(
      requirement &&
      number(
        requirement.noCumple
      ) > 0
    ){
      paragraphs.push(
        "El requisito con mayor número de incumplimientos es " +
        requirement.requisito +
        ", con " +
        requirement.noCumple +
        " registros en estado No cumple."
      );
    }

    return paragraphs;
  }

  function observations(section, inputData){
    var data =
      safeData(inputData);

    var summary =
      data.resumen || {};

    var output = [];

    output.push(
      "El reporte se genera únicamente con la sección seleccionada y los filtros superiores activos al momento de la emisión."
    );

    if(section.id === "graduados"){
      output.push(
        "El conteo considera únicamente el valor CUMPLE en el campo AprobacionTitulacion, normalizando mayúsculas y espacios."
      );

      output.push(
        "Un mismo estudiante se cuenta una sola vez dentro de cada período académico."
      );

      output.push(
        "Los valores APROBADO, SÍ, OK, PENDIENTE o NO CUMPLE no se consideran como graduado."
      );
    }else{
      output.push(
        "Los estudiantes retirados se mantienen en el análisis histórico para conservar trazabilidad institucional."
      );

      if(
        number(
          summary.porcentajeCumplimiento
        ) < 70
      ){
        output.push(
          "Se recomienda revisar los requisitos pendientes o incumplidos, debido a que el cumplimiento general se encuentra por debajo del 70%."
        );
      }else{
        output.push(
          "El cumplimiento general se encuentra en un rango aceptable para seguimiento institucional, sin perjuicio de revisar requisitos críticos puntuales."
        );
      }
    }

    output.push(
      "Este documento se genera desde la Base Local y debe contrastarse con las fuentes oficiales cuando se requiera certificación final."
    );

    return output;
  }

  function label(key){
    var labels = {
      cedula: "Cédula",
      estudiante: "Estudiante",
      carrera: "Carrera",
      tipo: "Tipo",
      periodo: "Período",
      division: "División",
      estado: "Estado",
      cumplimiento: "Cumplimiento",
      estudiantes: "Estudiantes",
      activos: "Activos",
      retirados: "Retirados",
      requisito: "Requisito",
      cumple: "Cumple",
      pendiente: "Pendiente",
      noCumple: "No cumple",
      total: "Total",
      carreras: "Carreras",
      indicador: "Indicador",
      valor: "Valor",
      detalle: "Detalle",
      alerta: "Alerta",
      cantidad: "Cantidad",
      prioridad: "Prioridad",
      seccion: "Sección",
      reporte: "Reporte",
      registros: "Registros",
      alcance: "Alcance",
      cantidadGraduados: "Cantidad de graduados"
    };

    return labels[key] || key;
  }

  function renderTable(table, limit){
    table = table || {
      columns: [],
      rows: []
    };

    var allRows =
      Array.isArray(table.rows)
        ? table.rows
        : [];

    var rows =
      allRows.slice(
        0,
        limit || 350
      );

    var columns =
      Array.isArray(table.columns)
        ? table.columns
        : [];

    return ""
      + "<h2>"
      + esc(
        table.title ||
        "Tabla"
      )
      + "</h2>"

      + '<table class="report-table">'

      + "<thead><tr>"
      + columns.map(function(column){
        return "<th>"
          + esc(label(column))
          + "</th>";
      }).join("")
      + "</tr></thead>"

      + "<tbody>"

      + (
        rows.length
          ? rows.map(function(row){
            return "<tr>"
              + columns.map(function(column){
                return "<td>"
                  + esc(row[column])
                  + "</td>";
              }).join("")
              + "</tr>";
          }).join("")

          : '<tr><td colspan="'
            + Math.max(
              1,
              columns.length
            )
            + '">No hay registros para los filtros aplicados.</td></tr>'
      )

      + "</tbody>"
      + "</table>"

      + (
        allRows.length > rows.length
          ? '<p class="small-note">Se muestran los primeros '
            + rows.length
            + " registros de "
            + allRows.length
            + " disponibles.</p>"
          : ""
      );
  }

  function renderList(items){
    return "<ul>"
      + (
        items || []
      ).map(function(item){
        return "<li>"
          + esc(item)
          + "</li>";
      }).join("")
      + "</ul>";
  }

  function graduateSummaryCards(data){
    var rows =
      graduateRows(data);

    var total =
      number(
        data.graduados &&
        data.graduados.total != null
          ? data.graduados.total
          : data.resumen.totalGraduados
      );

    var average =
      rows.length
        ? Math.round(
          total /
          rows.length
        )
        : 0;

    return ""
      + '<div class="graduate-cards">'

      + '<div class="graduate-card">'
      + "<b>Total de graduados</b>"
      + "<strong>"
      + formatInteger(total)
      + "</strong>"
      + "<span>AprobacionTitulacion = CUMPLE</span>"
      + "</div>"

      + '<div class="graduate-card">'
      + "<b>Períodos con graduados</b>"
      + "<strong>"
      + formatInteger(
        rows.length
      )
      + "</strong>"
      + "<span>Períodos con al menos un registro</span>"
      + "</div>"

      + '<div class="graduate-card">'
      + "<b>Promedio por período</b>"
      + "<strong>"
      + formatInteger(average)
      + "</strong>"
      + "<span>Promedio según filtros activos</span>"
      + "</div>"

      + "</div>";
  }

  function graduateChart(data){
    var rows =
      graduateRows(data);

    if(
      window.GlobalChart &&
      typeof window.GlobalChart.buildBarSVG === "function"
    ){
      return ""
        + '<section class="report-chart-block">'
        + "<h2>Gráfico de graduados por período</h2>"
        + '<div class="report-chart">'

        + window.GlobalChart.buildBarSVG(
          rows,
          {
            labelKey:
              "periodo",

            valueKey:
              "cantidadGraduados",

            orientation:
              rows.length >= 7
                ? "horizontal"
                : "vertical",

            width:
              980,

            height:
              rows.length >= 7
                ? Math.max(
                  420,
                  rows.length * 54 + 100
                )
                : 430,

            ariaLabel:
              "Cantidad de graduados por período"
          }
        )

        + "</div>"
        + "</section>";
    }

    return "";
  }

  function institutionalCss(){
    var branding =
      config.branding || {};

    var navy =
      branding.azulMarino ||
      "#071A33";

    var navy2 =
      branding.azulMarino2 ||
      "#0B2447";

    var gold =
      branding.dorado ||
      "#C9A227";

    return "<style>"
      + "@page{size:A4;margin:22mm 14mm 18mm 14mm;}"
      + "*{box-sizing:border-box;}"
      + "body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#1F2937;background:#fff;}"

      + ".cover{min-height:100vh;background:"
      + navy
      + ";color:#fff;padding:45mm 22mm 28mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;}"

      + ".cover-top{display:flex;align-items:center;gap:18px;}"

      + ".logo-box{width:105px;height:105px;border:1px solid rgba(228,199,102,.6);border-radius:18px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);overflow:hidden;text-align:center;font-size:12px;color:rgba(255,255,255,.8);}"

      + ".logo-box img{max-width:86%;max-height:86%;object-fit:contain;}"

      + ".eyebrow{color:"
      + gold
      + ";text-transform:uppercase;letter-spacing:.08em;font-weight:800;font-size:12px;margin:0 0 8px;}"

      + "h1{font-size:31px;line-height:1.18;margin:0;}"

      + ".cover h2{font-size:20px;font-weight:400;color:rgba(255,255,255,.86);margin:12px 0 0;border:0;padding:0;}"

      + ".cover-meta{border-top:2px solid "
      + gold
      + ";padding-top:18px;font-size:14px;line-height:1.7;color:rgba(255,255,255,.86);}"

      + ".print-header{position:fixed;top:0;left:0;right:0;height:16mm;background:"
      + navy
      + ";color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 14mm;border-bottom:2px solid "
      + gold
      + ";font-size:10px;z-index:10;}"

      + ".print-header strong{color:"
      + gold
      + ";}"

      + ".page{page-break-after:always;}"
      + ".page:last-child{page-break-after:auto;}"
      + ".content{padding-top:5mm;}"

      + "h2{color:"
      + navy2
      + ";font-size:18px;margin:0 0 10px;border-bottom:2px solid "
      + gold
      + ";padding-bottom:6px;}"

      + "h3{color:"
      + navy2
      + ";font-size:15px;margin:16px 0 8px;}"

      + "p{font-size:12px;line-height:1.5;margin:0 0 8px;}"
      + "ul{margin:0 0 12px 18px;padding:0;}"
      + "li{font-size:12px;line-height:1.45;margin-bottom:5px;}"

      + ".info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 16px;}"

      + ".info-card{border:1px solid #D8DEE9;border-left:4px solid "
      + gold
      + ";padding:9px;border-radius:8px;background:#F8FAFC;}"

      + ".info-card b{display:block;color:"
      + navy2
      + ";font-size:11px;text-transform:uppercase;margin-bottom:3px;}"

      + ".info-card span{font-size:12px;}"

      + ".graduate-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0 18px;}"

      + ".graduate-card{border:1px solid #D8DEE9;border-top:4px solid "
      + gold
      + ";border-radius:10px;padding:12px;background:#F8FAFC;}"

      + ".graduate-card b{display:block;color:"
      + navy2
      + ";font-size:10px;text-transform:uppercase;margin-bottom:8px;}"

      + ".graduate-card strong{display:block;color:"
      + navy
      + ";font-size:26px;line-height:1;margin-bottom:6px;}"

      + ".graduate-card span{font-size:10px;color:#667085;}"

      + "table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:10px;page-break-inside:auto;}"

      + "th{background:"
      + navy2
      + ";color:#fff;text-align:left;padding:7px;border:1px solid "
      + navy2
      + ";}"

      + "td{padding:6px;border:1px solid #D8DEE9;vertical-align:top;}"
      + "tr{page-break-inside:avoid;page-break-after:auto;}"
      + "tbody tr:nth-child(even){background:#F8FAFC;}"
      + ".small-note{font-size:10px;color:#667085;}"

      + ".footer-note{margin-top:18px;padding:10px;border-top:1px solid #D8DEE9;color:#667085;font-size:10px;}"

      + ".report-chart-block{page-break-inside:avoid;margin:0 0 18px;}"
      + ".report-chart{width:100%;overflow:hidden;border:1px solid #D8DEE9;border-radius:12px;background:#fff;padding:8px;}"

      + ".global-chart-svg{display:block;width:100%;height:auto;max-height:165mm;}"
      + ".global-chart-background{fill:#fff;}"
      + ".global-chart-grid-line{stroke:#E4E7EC;stroke-width:1;}"
      + ".global-chart-axis-line{stroke:#98A2B3;stroke-width:1.2;}"
      + ".global-chart-axis-text{fill:#667085;font-size:12px;font-family:Arial,Helvetica,sans-serif;}"

      + ".global-chart-bar{fill:"
      + navy2
      + ";}"

      + ".global-chart-value{fill:"
      + navy
      + ";font-size:13px;font-weight:700;font-family:Arial,Helvetica,sans-serif;}"

      + ".global-chart-category{fill:#344054;font-size:12px;font-family:Arial,Helvetica,sans-serif;}"
      + ".global-chart-empty-text{fill:#667085;font-size:14px;font-family:Arial,Helvetica,sans-serif;}"

      + "@media print{.no-print{display:none;}body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}.page{page-break-after:always;}.page:last-child{page-break-after:auto;}}"

      + "</style>";
  }

  function generate(options){
    options =
      options || {};

    var sectionId =
      options.section ||
      "resumen";

    var section =
      sectionById(sectionId);

    var data =
      safeData(
        options.data ||
        (
          window.GlobalApp &&
          typeof window.GlobalApp.getLastData === "function"
            ? window.GlobalApp.getLastData()
            : null
        )
      );

    var filters =
      currentFilters(
        options.filters ||
        data.filters
      );

    var table =
      tableForSection(
        sectionId,
        data
      );

    var logoPath =
      absoluteUrl(
        (
          config.branding &&
          config.branding.logoPath
        ) ||
        "assets/branding/logo-instituto.png"
      );

    var title =
      section.pdfTitulo ||
      section.titulo ||
      "Reporte Global";

    var baseHref =
      absoluteUrl("./");

    var graduateContent =
      sectionId === "graduados"
        ? graduateSummaryCards(data) +
          graduateChart(data)
        : "";

    var html =
      "<!DOCTYPE html>"

      + '<html lang="es">'

      + "<head>"
      + '<meta charset="UTF-8">'
      + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
      + '<base href="' + esc(baseHref) + '">'
      + "<title>" + esc(title) + "</title>"
      + institutionalCss()
      + "</head>"

      + "<body>"

      + '<section class="cover">'

      + '<div class="cover-top">'

      + '<div class="logo-box">'

      + '<img src="'
      + esc(logoPath)
      + '" alt="Logo institucional" onerror="this.style.display=\'none\';this.parentElement.textContent=\'Logo institucional\';">'

      + "</div>"

      + "<div>"

      + '<p class="eyebrow">'
      + esc(
        (
          config.app &&
          config.app.unidad
        ) ||
        "Unidad de Titulación y Eficiencia Terminal"
      )
      + "</p>"

      + "<h1>"
      + esc(title)
      + "</h1>"

      + "<h2>"
      + esc(
        (
          config.app &&
          config.app.subtitulo
        ) ||
        "Análisis histórico y comparativo"
      )
      + "</h2>"

      + "</div>"
      + "</div>"

      + '<div class="cover-meta">'

      + "<div><strong>Sección:</strong> "
      + esc(
        section.label ||
        section.titulo
      )
      + "</div>"

      + "<div><strong>Fecha de generación:</strong> "
      + esc(now())
      + "</div>"

      + "<div><strong>Fuente:</strong> Base Local institucional del sistema de requisitos</div>"

      + "</div>"
      + "</section>"

      + '<div class="print-header">'

      + "<span><strong>Unidad de Titulación y Eficiencia Terminal</strong> · Reporte Global</span>"

      + "<span>"
      + esc(
        section.label ||
        "Global"
      )
      + "</span>"

      + "</div>"

      + '<main class="content">'

      + '<section class="page">'

      + "<h2>Filtros aplicados</h2>"

      + '<div class="info-grid">'

      + filterRows(filters).map(function(row){
        return '<div class="info-card"><b>'
          + esc(row.filtro)
          + "</b><span>"
          + esc(row.valor)
          + "</span></div>";
      }).join("")

      + "</div>"

      + "<h2>Resumen ejecutivo</h2>"

      + renderList(
        summaryText(
          section,
          data
        )
      )

      + "<h2>Observaciones automáticas</h2>"

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

      + '<p class="footer-note">El presente reporte ha sido generado automáticamente con base en la información registrada en la Base Local institucional y los filtros seleccionados por el usuario.</p>'

      + "</section>"

      + "</main>"

      + "<script>window.onload=function(){window.setTimeout(function(){window.print();},750);};<\/script>"

      + "</body>"
      + "</html>";

    var printWindow =
      window.open(
        "",
        "_blank"
      );

    if(!printWindow){
      window.alert(
        "No se pudo abrir la ventana de impresión. Habilita las ventanas emergentes para generar el PDF."
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
      graduateChart
  };
})(window, document);