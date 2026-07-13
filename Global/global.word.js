/* =========================================================
Nombre completo: global.word.js
Ruta o ubicación: /Requisitos/Global/global.word.js
Función o funciones:
- Generar un documento Word institucional en formato DOCX real.
- Reutilizar la misma sección, filtros, tablas, resúmenes y observaciones del PDF.
- Incorporar el logo institucional y el gráfico de graduados cuando estén disponibles.
- Añadir las firmas institucionales al final del documento.
- Descargar automáticamente el archivo sin dependencias externas.
Con qué se conecta:
- global.config.js
- global.app.js
- global.pdf.js
- global.chart.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION =
    "1.0.0-native-docx";

  var config =
    window.GlobalConfig ||
    {};

  var XMLNS_W =
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

  var XMLNS_R =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  var XMLNS_WP =
    "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";

  var XMLNS_A =
    "http://schemas.openxmlformats.org/drawingml/2006/main";

  var XMLNS_PIC =
    "http://schemas.openxmlformats.org/drawingml/2006/picture";

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

  function xml(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function hexColor(value, fallback){
    var result = text(
      value || fallback
    ).replace(/[^0-9A-Fa-f]/g, "");

    if(result.length === 3){
      result = result
        .split("")
        .map(function(character){
          return character + character;
        })
        .join("");
    }

    return result.length === 6
      ? result.toUpperCase()
      : text(fallback || "000000")
        .replace(/[^0-9A-Fa-f]/g, "")
        .toUpperCase();
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

  function formatDate(){
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

  function fileDate(){
    var date = new Date();

    function two(value){
      return String(value)
        .padStart(2, "0");
    }

    return (
      date.getFullYear() +
      "-" +
      two(date.getMonth() + 1) +
      "-" +
      two(date.getDate())
    );
  }

  function safeFilename(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-")
      .toLowerCase() ||
      "reporte-global";
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
      id: id || "resumen",
      label: "Global",
      titulo: "Reporte Global",
      pdfTitulo: "Reporte Global"
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

  function requiredPdfApi(){
    if(
      !window.GlobalPDF ||
      typeof window.GlobalPDF
        .tableForSection !== "function" ||
      typeof window.GlobalPDF
        .summaryText !== "function" ||
      typeof window.GlobalPDF
        .observations !== "function" ||
      typeof window.GlobalPDF
        .filterRows !== "function"
    ){
      throw new Error(
        "GlobalPDF no está disponible para construir el modelo institucional del Word."
      );
    }

    return window.GlobalPDF;
  }

  function defaultSignatures(){
    return [
      {
        nombre:
          "Mpde. Martha Tomalá",

        cargo:
          "Secretaria General"
      },
      {
        nombre:
          "Mgt. Jefferson Villarreal",

        cargo:
          "Coordinador de Titulación y Eficiencia Terminal"
      }
    ];
  }

  function buildReportModel(options){
    options = options || {};

    var pdf =
      requiredPdfApi();

    var section =
      sectionById(
        options.section ||
        "resumen"
      );

    var data =
      options.data &&
      typeof options.data === "object"
        ? options.data
        : {};

    var filters =
      currentFilters(
        options.filters ||
        data.filters
      );

    var signatures =
      typeof pdf.getSignatures === "function"
        ? pdf.getSignatures()
        : defaultSignatures();

    var graduateRows =
      section.id === "graduados" &&
      typeof pdf.graduateRows === "function"
        ? pdf.graduateRows(data)
        : [];

    return {
      section: section,
      data: data,
      filters: filters,

      title:
        section.pdfTitulo ||
        section.titulo ||
        section.label ||
        "Reporte Global",

      unit:
        config.app &&
        config.app.unidad
          ? config.app.unidad
          : "Unidad de Titulación y Eficiencia Terminal",

      generatedAt:
        formatDate(),

      filterRows:
        pdf.filterRows(
          filters,
          data
        ) || [],

      summary:
        pdf.summaryText(
          section,
          data
        ) || [],

      observations:
        pdf.observations(
          section,
          data
        ) || [],

      table:
        pdf.tableForSection(
          section.id,
          data
        ) || {
          title: "Detalle",
          columns: [],
          rows: []
        },

      tableExplanation:
        typeof pdf.tableExplanation === "function"
          ? pdf.tableExplanation(
            (
              pdf.tableForSection(
                section.id,
                data
              ) || {}
            ).title
          )
          : "La tabla muestra el detalle de los registros que conforman esta sección del informe.",

      label:
        typeof pdf.label === "function"
          ? pdf.label
          : function(value){
            return value;
          },

      graduateRows:
        graduateRows,

      signatures:
        Array.isArray(signatures)
          ? signatures
          : defaultSignatures()
    };
  }

  function utf8(value){
    value = String(
      value == null
        ? ""
        : value
    );

    if(typeof TextEncoder !== "undefined"){
      return new TextEncoder()
        .encode(value);
    }

    var encoded =
      unescape(
        encodeURIComponent(value)
      );

    var output =
      new Uint8Array(
        encoded.length
      );

    for(
      var index = 0;
      index < encoded.length;
      index += 1
    ){
      output[index] =
        encoded.charCodeAt(index);
    }

    return output;
  }

  function concatBytes(parts){
    var length =
      parts.reduce(
        function(total, part){
          return total + part.length;
        },
        0
      );

    var output =
      new Uint8Array(length);

    var offset = 0;

    parts.forEach(function(part){
      output.set(
        part,
        offset
      );

      offset += part.length;
    });

    return output;
  }

  function uint16(value){
    var output =
      new Uint8Array(2);

    var view =
      new DataView(
        output.buffer
      );

    view.setUint16(
      0,
      value >>> 0,
      true
    );

    return output;
  }

  function uint32(value){
    var output =
      new Uint8Array(4);

    var view =
      new DataView(
        output.buffer
      );

    view.setUint32(
      0,
      value >>> 0,
      true
    );

    return output;
  }

  var CRC_TABLE = null;

  function crcTable(){
    if(CRC_TABLE){
      return CRC_TABLE;
    }

    CRC_TABLE =
      new Uint32Array(256);

    for(
      var index = 0;
      index < 256;
      index += 1
    ){
      var value = index;

      for(
        var bit = 0;
        bit < 8;
        bit += 1
      ){
        value =
          value & 1
            ? (
              0xEDB88320 ^
              (value >>> 1)
            )
            : value >>> 1;
      }

      CRC_TABLE[index] =
        value >>> 0;
    }

    return CRC_TABLE;
  }

  function crc32(bytes){
    var table = crcTable();
    var crc = 0xFFFFFFFF;

    for(
      var index = 0;
      index < bytes.length;
      index += 1
    ){
      crc =
        table[
          (crc ^ bytes[index]) &
          0xFF
        ] ^
        (crc >>> 8);
    }

    return (
      crc ^ 0xFFFFFFFF
    ) >>> 0;
  }

  function dosDateTime(date){
    date = date || new Date();

    var year = Math.max(
      1980,
      date.getFullYear()
    );

    var dosDate =
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate();

    var dosTime =
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(
        date.getSeconds() / 2
      );

    return {
      date: dosDate,
      time: dosTime
    };
  }

  function zip(files){
    var localParts = [];
    var centralParts = [];
    var offset = 0;
    var stamp = dosDateTime(
      new Date()
    );

    files.forEach(function(file){
      var nameBytes =
        utf8(file.name);

      var dataBytes =
        file.data instanceof Uint8Array
          ? file.data
          : utf8(file.data);

      var checksum =
        crc32(dataBytes);

      var localHeader =
        concatBytes([
          uint32(0x04034B50),
          uint16(20),
          uint16(0x0800),
          uint16(0),
          uint16(stamp.time),
          uint16(stamp.date),
          uint32(checksum),
          uint32(dataBytes.length),
          uint32(dataBytes.length),
          uint16(nameBytes.length),
          uint16(0),
          nameBytes
        ]);

      localParts.push(
        localHeader,
        dataBytes
      );

      var centralHeader =
        concatBytes([
          uint32(0x02014B50),
          uint16(20),
          uint16(20),
          uint16(0x0800),
          uint16(0),
          uint16(stamp.time),
          uint16(stamp.date),
          uint32(checksum),
          uint32(dataBytes.length),
          uint32(dataBytes.length),
          uint16(nameBytes.length),
          uint16(0),
          uint16(0),
          uint16(0),
          uint16(0),
          uint32(0),
          uint32(offset),
          nameBytes
        ]);

      centralParts.push(
        centralHeader
      );

      offset +=
        localHeader.length +
        dataBytes.length;
    });

    var central =
      concatBytes(centralParts);

    var end =
      concatBytes([
        uint32(0x06054B50),
        uint16(0),
        uint16(0),
        uint16(files.length),
        uint16(files.length),
        uint32(central.length),
        uint32(offset),
        uint16(0)
      ]);

    return concatBytes(
      localParts
        .concat([
          central,
          end
        ])
    );
  }

  function run(value, options){
    options = options || {};

    var properties = [];

    if(options.bold){
      properties.push("<w:b/>");
    }

    if(options.italic){
      properties.push("<w:i/>");
    }

    if(options.color){
      properties.push(
        '<w:color w:val="' +
        xml(options.color) +
        '"/>'
      );
    }

    if(options.size){
      properties.push(
        '<w:sz w:val="' +
        Math.round(
          number(options.size)
        ) +
        '"/>'
      );

      properties.push(
        '<w:szCs w:val="' +
        Math.round(
          number(options.size)
        ) +
        '"/>'
      );
    }

    return ""
      + "<w:r>"
      + (
        properties.length
          ? (
            "<w:rPr>" +
            properties.join("") +
            "</w:rPr>"
          )
          : ""
      )
      + '<w:t xml:space="preserve">'
      + xml(value)
      + "</w:t>"
      + "</w:r>";
  }

  function paragraph(value, options){
    options = options || {};

    var properties = [];

    if(options.style){
      properties.push(
        '<w:pStyle w:val="' +
        xml(options.style) +
        '"/>'
      );
    }

    if(options.align){
      properties.push(
        '<w:jc w:val="' +
        xml(options.align) +
        '"/>'
      );
    }

    if(
      options.before != null ||
      options.after != null ||
      options.line != null
    ){
      properties.push(
        "<w:spacing" +
        (
          options.before != null
            ? ' w:before="' +
              Math.max(
                0,
                Math.round(
                  number(options.before)
                )
              ) +
              '"'
            : ""
        ) +
        (
          options.after != null
            ? ' w:after="' +
              Math.max(
                0,
                Math.round(
                  number(options.after)
                )
              ) +
              '"'
            : ""
        ) +
        (
          options.line != null
            ? ' w:line="' +
              Math.max(
                0,
                Math.round(
                  number(options.line)
                )
              ) +
              '" w:lineRule="auto"'
            : ""
        ) +
        "/>"
      );
    }

    if(options.keepNext){
      properties.push(
        "<w:keepNext/>"
      );
    }

    if(options.keepLines){
      properties.push(
        "<w:keepLines/>"
      );
    }

    if(options.pageBreakBefore){
      properties.push(
        "<w:pageBreakBefore/>"
      );
    }

    if(
      options.left != null ||
      options.hanging != null
    ){
      properties.push(
        "<w:ind" +
        (
          options.left != null
            ? ' w:left="' +
              Math.round(
                number(options.left)
              ) +
              '"'
            : ""
        ) +
        (
          options.hanging != null
            ? ' w:hanging="' +
              Math.round(
                number(options.hanging)
              ) +
              '"'
            : ""
        ) +
        "/>"
      );
    }

    var content =
      options.raw
        ? String(value || "")
        : run(
          value,
          options
        );

    return ""
      + "<w:p>"
      + (
        properties.length
          ? (
            "<w:pPr>" +
            properties.join("") +
            "</w:pPr>"
          )
          : ""
      )
      + content
      + "</w:p>";
  }

  function pageBreak(){
    return (
      "<w:p><w:r>" +
      '<w:br w:type="page"/>' +
      "</w:r></w:p>"
    );
  }

  function tableCell(value, options){
    options = options || {};

    var cellProperties = [];

    if(options.fill){
      cellProperties.push(
        '<w:shd w:val="clear"' +
        ' w:color="auto"' +
        ' w:fill="' +
        xml(options.fill) +
        '"/>'
      );
    }

    if(options.width){
      cellProperties.push(
        '<w:tcW w:w="' +
        Math.round(
          number(options.width)
        ) +
        '" w:type="dxa"/>'
      );
    }

    cellProperties.push(
      '<w:vAlign w:val="top"/>'
    );

    return ""
      + "<w:tc>"
      + "<w:tcPr>"
      + cellProperties.join("")
      + "</w:tcPr>"
      + paragraph(
        value,
        {
          bold: options.bold,
          color: options.color,
          size: options.size || 17,
          after: 0,
          line: 230
        }
      )
      + "</w:tc>";
  }

  function reportTable(table, labelFunction){
    table = table || {};

    var columns =
      Array.isArray(table.columns)
        ? table.columns
        : [];

    var rows =
      Array.isArray(table.rows)
        ? table.rows
        : [];

    var visibleRows =
      rows.slice(0, 350);

    var columnCount =
      Math.max(
        columns.length,
        1
      );

    var fontSize =
      columnCount >= 8
        ? 14
        : columnCount >= 6
          ? 15
          : 17;

    var header =
      "<w:tr>"
      + "<w:trPr><w:tblHeader/></w:trPr>"
      + columns.map(function(column){
        return tableCell(
          labelFunction(column),
          {
            fill: "071A33",
            color: "FFFFFF",
            bold: true,
            size: fontSize
          }
        );
      }).join("")
      + "</w:tr>";

    var body = visibleRows.length
      ? visibleRows.map(function(row){
        return ""
          + "<w:tr>"
          + "<w:trPr><w:cantSplit/></w:trPr>"
          + columns.map(function(column){
            return tableCell(
              row &&
              row[column] != null
                ? row[column]
                : "",
              {
                size: fontSize
              }
            );
          }).join("")
          + "</w:tr>";
      }).join("")
      : (
        "<w:tr><w:tc>"
        + '<w:tcPr><w:gridSpan w:val="' +
        columnCount +
        '"/></w:tcPr>'
        + paragraph(
          "No existen registros para los filtros aplicados.",
          {
            align: "center",
            italic: true,
            size: 18
          }
        )
        + "</w:tc></w:tr>"
      );

    var note =
      rows.length > 350
        ? paragraph(
          "Se muestran los primeros 350 registros de un total de " +
          rows.length +
          ".",
          {
            style: "Small",
            italic: true,
            before: 80
          }
        )
        : "";

    return ""
      + "<w:tbl>"
      + "<w:tblPr>"
      + '<w:tblW w:w="0" w:type="auto"/>'
      + '<w:tblLayout w:type="autofit"/>'
      + "<w:tblBorders>"
      + '<w:top w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:left w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:bottom w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:right w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:insideH w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:insideV w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + "</w:tblBorders>"
      + '<w:tblCellMar>'
      + '<w:top w:w="70" w:type="dxa"/>'
      + '<w:left w:w="70" w:type="dxa"/>'
      + '<w:bottom w:w="70" w:type="dxa"/>'
      + '<w:right w:w="70" w:type="dxa"/>'
      + '</w:tblCellMar>'
      + "</w:tblPr>"
      + header
      + body
      + "</w:tbl>"
      + note;
  }

  function twoColumnTable(rows){
    rows = Array.isArray(rows)
      ? rows
      : [];

    if(!rows.length){
      return paragraph(
        "No se aplicaron filtros específicos; el informe utiliza el universo disponible.",
        {
          italic: true,
          after: 160
        }
      );
    }

    return ""
      + "<w:tbl>"
      + "<w:tblPr>"
      + '<w:tblW w:w="0" w:type="auto"/>'
      + "<w:tblBorders>"
      + '<w:top w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:left w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:bottom w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:right w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:insideH w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:insideV w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + "</w:tblBorders>"
      + "</w:tblPr>"
      + rows.map(function(row){
        return ""
          + "<w:tr><w:trPr><w:cantSplit/></w:trPr>"
          + tableCell(
            row.filtro,
            {
              fill: "F4F6FA",
              bold: true,
              color: "071A33",
              width: 2600
            }
          )
          + tableCell(
            row.valor,
            {
              width: 6200
            }
          )
          + "</w:tr>";
      }).join("")
      + "</w:tbl>";
  }

  function graduateMetrics(model){
    var rows =
      model.graduateRows || [];

    var total = rows.reduce(
      function(sum, row){
        return sum + number(
          row.cantidadGraduados
        );
      },
      0
    );

    var periods = rows.length;
    var average = periods
      ? Math.round(
        total / periods
      )
      : 0;

    var items = [
      {
        label: "Total de graduados",
        value: total,
        detail: "Estudiantes que completaron satisfactoriamente el proceso de titulación."
      },
      {
        label: "Períodos académicos analizados",
        value: periods,
        detail: "Períodos que registran al menos un estudiante graduado."
      },
      {
        label: "Promedio de graduados por período",
        value: average,
        detail: "Promedio de estudiantes graduados en los períodos académicos analizados."
      }
    ];

    return ""
      + "<w:tbl>"
      + "<w:tblPr>"
      + '<w:tblW w:w="0" w:type="auto"/>'
      + "<w:tblBorders>"
      + '<w:top w:val="single" w:sz="6" w:color="C9A227"/>'
      + '<w:left w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:bottom w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:right w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:insideH w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + '<w:insideV w:val="single" w:sz="4" w:color="D8E0EA"/>'
      + "</w:tblBorders>"
      + "</w:tblPr>"
      + "<w:tr><w:trPr><w:cantSplit/></w:trPr>"
      + items.map(function(item){
        return ""
          + "<w:tc>"
          + '<w:tcPr><w:shd w:val="clear" w:fill="F8FAFC"/></w:tcPr>'
          + paragraph(
            item.label,
            {
              bold: true,
              color: "071A33",
              size: 18,
              after: 80
            }
          )
          + paragraph(
            item.value,
            {
              bold: true,
              color: "071A33",
              size: 30,
              after: 80
            }
          )
          + paragraph(
            item.detail,
            {
              size: 16,
              color: "617089",
              after: 0
            }
          )
          + "</w:tc>";
      }).join("")
      + "</w:tr>"
      + "</w:tbl>";
  }

  function imageDimensions(bytes){
    if(
      !bytes ||
      bytes.length < 24
    ){
      return null;
    }

    if(
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4E &&
      bytes[3] === 0x47
    ){
      var pngView =
        new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength
        );

      return {
        width:
          pngView.getUint32(16, false),

        height:
          pngView.getUint32(20, false)
      };
    }

    if(
      bytes[0] === 0xFF &&
      bytes[1] === 0xD8
    ){
      var offset = 2;

      while(offset + 9 < bytes.length){
        if(bytes[offset] !== 0xFF){
          offset += 1;
          continue;
        }

        var marker = bytes[offset + 1];
        var length =
          (bytes[offset + 2] << 8) |
          bytes[offset + 3];

        if(
          marker >= 0xC0 &&
          marker <= 0xC3
        ){
          return {
            height:
              (bytes[offset + 5] << 8) |
              bytes[offset + 6],

            width:
              (bytes[offset + 7] << 8) |
              bytes[offset + 8]
          };
        }

        if(length < 2){
          break;
        }

        offset +=
          length + 2;
      }
    }

    return null;
  }

  function fetchBytes(url){
    if(!url){
      return Promise.resolve(null);
    }

    if(typeof fetch !== "function"){
      return Promise.resolve(null);
    }

    return fetch(url)
      .then(function(response){
        if(!response.ok){
          throw new Error(
            "No se pudo cargar el recurso " +
            url
          );
        }

        return response.arrayBuffer();
      })
      .then(function(buffer){
        return new Uint8Array(buffer);
      })
      .catch(function(){
        return null;
      });
  }

  function loadLogo(){
    var branding =
      config.branding || {};

    var url = absoluteUrl(
      branding.logoPath ||
      "assets/branding/logo-instituto.png"
    );

    return fetchBytes(url)
      .then(function(bytes){
        if(!bytes){
          return null;
        }

        var dimensions =
          imageDimensions(bytes) ||
          {
            width: 600,
            height: 260
          };

        return {
          bytes: bytes,
          width: dimensions.width,
          height: dimensions.height,
          extension: "png",
          contentType: "image/png",
          name: "Logo institucional"
        };
      });
  }

  function svgWithStyles(svg){
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

    var style = ""
      + "<style>"
      + ".global-chart-background{fill:#ffffff;}"
      + ".global-chart-grid-line{stroke:#dfe5ed;stroke-width:1;}"
      + ".global-chart-axis-line{stroke:#75839a;stroke-width:1.4;}"
      + ".global-chart-axis-text{fill:#617089;font:12px Arial;}"
      + ".global-chart-category{fill:" + navy + ";font:bold 12px Arial;}"
      + ".global-chart-value{fill:" + navy + ";font:bold 12px Arial;}"
      + ".global-chart-bar{fill:" + navy2 + ";}"
      + ".global-chart-empty-text{fill:#617089;font:14px Arial;}"
      + "</style>";

    return String(svg || "")
      .replace(
        /(<svg\b[^>]*>)/i,
        "$1" + style
      );
  }

  function svgToPng(svgMarkup){
    if(
      !svgMarkup ||
      typeof Blob === "undefined" ||
      typeof Image === "undefined" ||
      !document ||
      typeof document.createElement !== "function"
    ){
      return Promise.resolve(null);
    }

    var svg =
      svgWithStyles(svgMarkup);

    var viewBox =
      /viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i
        .exec(svg);

    var width = viewBox
      ? Math.max(
        1,
        Math.round(
          number(viewBox[3])
        )
      )
      : 1060;

    var height = viewBox
      ? Math.max(
        1,
        Math.round(
          number(viewBox[4])
        )
      )
      : 600;

    return new Promise(function(resolve){
      var blob = new Blob(
        [svg],
        {
          type: "image/svg+xml;charset=utf-8"
        }
      );

      var url =
        URL.createObjectURL(blob);

      var image = new Image();

      image.onload = function(){
        try{
          var canvas =
            document.createElement(
              "canvas"
            );

          canvas.width = width;
          canvas.height = height;

          var context =
            canvas.getContext("2d");

          context.fillStyle = "#ffffff";
          context.fillRect(
            0,
            0,
            width,
            height
          );

          context.drawImage(
            image,
            0,
            0,
            width,
            height
          );

          canvas.toBlob(
            function(pngBlob){
              URL.revokeObjectURL(url);

              if(!pngBlob){
                resolve(null);
                return;
              }

              pngBlob.arrayBuffer()
                .then(function(buffer){
                  resolve({
                    bytes:
                      new Uint8Array(buffer),
                    width: width,
                    height: height,
                    extension: "png",
                    contentType: "image/png",
                    name: "Gráfico de graduados por período"
                  });
                })
                .catch(function(){
                  resolve(null);
                });
            },
            "image/png"
          );
        }catch(error){
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };

      image.onerror = function(){
        URL.revokeObjectURL(url);
        resolve(null);
      };

      image.src = url;
    });
  }

  function loadGraduateChart(model){
    if(
      model.section.id !== "graduados" ||
      !model.graduateRows.length ||
      !window.GlobalChart ||
      typeof window.GlobalChart
        .buildBarSVG !== "function"
    ){
      return Promise.resolve(null);
    }

    var svg =
      window.GlobalChart.buildBarSVG(
        model.graduateRows,
        {
          labelKey: "periodo",
          valueKey: "cantidadGraduados",
          orientation: "horizontal",
          fullLabels: true,
          labelChars: 38,
          maxLabelLines: 4,
          rowHeight: 66,
          width: 1060,
          ariaLabel: "Cantidad de graduados por período académico",
          emptyMessage: "No existen graduados para los filtros aplicados."
        }
      );

    return svgToPng(svg);
  }

  function imageParagraph(image, relationId, drawingId, maxWidthInches){
    if(!image || !relationId){
      return "";
    }

    var width = Math.max(
      1,
      number(image.width) || 1
    );

    var height = Math.max(
      1,
      number(image.height) || 1
    );

    var maxWidth =
      Math.round(
        number(maxWidthInches || 6.2) *
        914400
      );

    var cx = Math.min(
      maxWidth,
      Math.round(
        width * 9525
      )
    );

    var cy = Math.round(
      cx *
      height /
      width
    );

    return ""
      + '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>'
      + '<wp:inline distT="0" distB="0" distL="0" distR="0">'
      + '<wp:extent cx="' + cx + '" cy="' + cy + '"/>'
      + '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
      + '<wp:docPr id="' + drawingId + '" name="' + xml(image.name || "Imagen") + '"/>'
      + '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
      + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
      + '<pic:pic>'
      + '<pic:nvPicPr><pic:cNvPr id="0" name="' + xml(image.name || "Imagen") + '"/><pic:cNvPicPr/></pic:nvPicPr>'
      + '<pic:blipFill><a:blip r:embed="' + xml(relationId) + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
      + '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>'
      + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
      + '</pic:pic>'
      + '</a:graphicData></a:graphic>'
      + '</wp:inline>'
      + '</w:drawing></w:r></w:p>';
  }

  function bulletList(items){
    items = Array.isArray(items)
      ? items
      : [];

    return items.map(function(item){
      return paragraph(
        "• " + text(item),
        {
          left: 360,
          hanging: 240,
          after: 90,
          line: 300,
          keepLines: true
        }
      );
    }).join("");
  }

  function signatureParagraphs(signatures){
    signatures = Array.isArray(signatures)
      ? signatures
      : defaultSignatures();

    return signatures.map(function(signature, index){
      return ""
        + paragraph(
          signature.nombre,
          {
            bold: true,
            size: 19,
            before: index === 0
              ? 900
              : 1280,
            after: 0,
            keepNext: true,
            keepLines: true
          }
        )
        + paragraph(
          signature.cargo,
          {
            bold: true,
            size: 19,
            after: 0,
            keepNext:
              index < signatures.length - 1,
            keepLines: true
          }
        );
    }).join("");
  }

  function methodology(model){
    if(model.section.id === "graduados"){
      return (
        "Se considera graduado al estudiante cuyo requisito de aprobación de titulación se encuentra registrado como cumplido en la Base Local institucional. Cada estudiante se contabiliza una sola vez dentro de su período académico. Los períodos sin graduados no intervienen en el cálculo del promedio."
      );
    }

    return (
      "Los resultados corresponden a la información disponible en la Base Local institucional y a los filtros aplicados al momento de generar el informe."
    );
  }

  function documentXml(model, references){
    references = references || {};

    var body = [];

    if(references.logo){
      body.push(
        imageParagraph(
          references.logo.asset,
          references.logo.id,
          1,
          2.25
        )
      );
    }else{
      body.push(
        paragraph(
          config.branding &&
          config.branding.logoFallbackText
            ? config.branding.logoFallbackText
            : "Logo institucional",
          {
            align: "center",
            bold: true,
            color: "FFFFFF",
            size: 24,
            before: 220,
            after: 220
          }
        )
      );
    }

    body.push(
      paragraph(
        model.unit,
        {
          style: "Subtitle",
          align: "center",
          bold: true,
          color: "C9A227",
          before: 400,
          after: 180
        }
      )
    );

    body.push(
      paragraph(
        model.title,
        {
          style: "Title",
          align: "center",
          bold: true,
          color: "071A33",
          after: 260,
          keepLines: true
        }
      )
    );

    body.push(
      paragraph(
        "Informe institucional generado con la información disponible en la Base Local y los filtros seleccionados.",
        {
          align: "center",
          color: "526078",
          size: 22,
          after: 420,
          line: 320
        }
      )
    );

    body.push(
      paragraph(
        "Sección: " +
        text(model.section.label || "Global"),
        {
          align: "center",
          bold: true,
          after: 80
        }
      )
    );

    body.push(
      paragraph(
        "Fecha de generación: " +
        model.generatedAt,
        {
          align: "center",
          after: 0
        }
      )
    );

    body.push(
      pageBreak()
    );

    body.push(
      paragraph(
        "Alcance y filtros del informe",
        {
          style: "Heading1",
          keepNext: true
        }
      )
    );

    body.push(
      paragraph(
        "Los siguientes criterios delimitan la información incluida en este documento. Se muestran únicamente los filtros seleccionados por el usuario.",
        {
          color: "536177",
          line: 320,
          after: 160
        }
      )
    );

    body.push(
      twoColumnTable(
        model.filterRows
      )
    );

    body.push(
      paragraph(
        "Resumen ejecutivo",
        {
          style: "Heading1",
          before: 260,
          keepNext: true
        }
      )
    );

    body.push(
      bulletList(
        model.summary
      )
    );

    body.push(
      paragraph(
        "Hallazgos principales",
        {
          style: "Heading1",
          before: 200,
          keepNext: true
        }
      )
    );

    body.push(
      bulletList(
        model.observations
      )
    );

    body.push(
      pageBreak()
    );

    if(model.section.id === "graduados"){
      body.push(
        paragraph(
          "Indicadores de graduación",
          {
            style: "Heading1",
            keepNext: true
          }
        )
      );

      body.push(
        graduateMetrics(model)
      );

      body.push(
        paragraph(
          "Distribución de graduados por período académico",
          {
            style: "Heading1",
            before: 260,
            keepNext: true
          }
        )
      );

      body.push(
        paragraph(
          "El gráfico compara la cantidad de estudiantes graduados en cada período académico. La longitud de cada barra representa el número de graduados correspondiente.",
          {
            color: "536177",
            line: 320,
            after: 140
          }
        )
      );

      if(references.chart){
        body.push(
          imageParagraph(
            references.chart.asset,
            references.chart.id,
            references.logo ? 2 : 1,
            6.25
          )
        );
      }else{
        body.push(
          paragraph(
            "El gráfico no pudo incorporarse; la tabla siguiente conserva todos los valores del análisis.",
            {
              italic: true,
              color: "617089",
              after: 160
            }
          )
        );
      }

      body.push(
        paragraph(
          "Interpretación del gráfico",
          {
            style: "Heading2",
            before: 180,
            keepNext: true
          }
        )
      );

      body.push(
        bulletList(
          model.observations
        )
      );
    }

    body.push(
      paragraph(
        model.table.title ||
        "Detalle",
        {
          style: "Heading1",
          before: 260,
          keepNext: true
        }
      )
    );

    body.push(
      paragraph(
        model.tableExplanation,
        {
          color: "536177",
          line: 320,
          after: 160
        }
      )
    );

    body.push(
      reportTable(
        model.table,
        model.label
      )
    );

    body.push(
      paragraph(
        "Nota metodológica",
        {
          style: "Heading2",
          before: 280,
          keepNext: true
        }
      )
    );

    body.push(
      paragraph(
        methodology(model),
        {
          color: "445269",
          line: 320,
          after: 160,
          keepLines: true
        }
      )
    );

    body.push(
      paragraph(
        "Este informe fue generado automáticamente con base en la información registrada en la Base Local institucional y los filtros seleccionados por el usuario.",
        {
          style: "Small",
          color: "6D7A8D",
          before: 160,
          after: 0,
          keepLines: true
        }
      )
    );

    body.push(
      signatureParagraphs(
        model.signatures
      )
    );

    body.push(
      "<w:sectPr>"
      + '<w:pgSz w:w="11906" w:h="16838"/>'
      + '<w:pgMar w:top="794" w:right="737" w:bottom="850" w:left="737" w:header="300" w:footer="300" w:gutter="0"/>'
      + '<w:cols w:space="720"/>'
      + '<w:docGrid w:linePitch="360"/>'
      + "</w:sectPr>"
    );

    return ""
      + '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document'
      + ' xmlns:w="' + XMLNS_W + '"'
      + ' xmlns:r="' + XMLNS_R + '"'
      + ' xmlns:wp="' + XMLNS_WP + '"'
      + ' xmlns:a="' + XMLNS_A + '"'
      + ' xmlns:pic="' + XMLNS_PIC + '">'
      + "<w:body>"
      + body.join("")
      + "</w:body>"
      + "</w:document>";
  }

  function stylesXml(){
    var branding =
      config.branding || {};

    var navy =
      hexColor(
        branding.azulMarino,
        "071A33"
      );

    var navy2 =
      hexColor(
        branding.azulMarino2,
        "0B2447"
      );

    return ""
      + '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:styles xmlns:w="' + XMLNS_W + '">'
      + '<w:docDefaults>'
      + '<w:rPrDefault><w:rPr>'
      + '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>'
      + '<w:sz w:val="21"/><w:szCs w:val="21"/>'
      + '</w:rPr></w:rPrDefault>'
      + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault>'
      + '</w:docDefaults>'
      + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
      + '<w:name w:val="Normal"/><w:qFormat/>'
      + '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="1F2937"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>'
      + '</w:style>'
      + '<w:style w:type="paragraph" w:styleId="Title">'
      + '<w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
      + '<w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>'
      + '<w:rPr><w:b/><w:color w:val="' + navy + '"/><w:sz w:val="46"/><w:szCs w:val="46"/></w:rPr>'
      + '</w:style>'
      + '<w:style w:type="paragraph" w:styleId="Subtitle">'
      + '<w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
      + '<w:rPr><w:b/><w:color w:val="C9A227"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>'
      + '</w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading1">'
      + '<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
      + '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="260" w:after="120"/>'
      + '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C9A227"/></w:pBdr></w:pPr>'
      + '<w:rPr><w:b/><w:color w:val="' + navy + '"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>'
      + '</w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading2">'
      + '<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
      + '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="220" w:after="100"/></w:pPr>'
      + '<w:rPr><w:b/><w:color w:val="' + navy2 + '"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>'
      + '</w:style>'
      + '<w:style w:type="paragraph" w:styleId="Small">'
      + '<w:name w:val="Small"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'
      + '<w:rPr><w:color w:val="6D7A8D"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>'
      + '</w:style>'
      + '</w:styles>';
  }

  function contentTypesXml(images){
    var defaults = [
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>'
    ];

    var seen = Object.create(null);

    images.forEach(function(image){
      var extension =
        text(image.asset.extension || "png")
          .toLowerCase();

      if(seen[extension]){
        return;
      }

      seen[extension] = true;

      defaults.push(
        '<Default Extension="' +
        xml(extension) +
        '" ContentType="' +
        xml(
          image.asset.contentType ||
          (extension === "jpg" || extension === "jpeg"
            ? "image/jpeg"
            : "image/png")
        ) +
        '"/>'
      );
    });

    return ""
      + '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + defaults.join("")
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
      + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
      + '</Types>';
  }

  function rootRelationshipsXml(){
    return ""
      + '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
      + '</Relationships>';
  }

  function documentRelationshipsXml(images){
    return ""
      + '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
      + images.map(function(image){
        return '<Relationship Id="' +
          xml(image.id) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' +
          xml(image.filename) +
          '"/>';
      }).join("")
      + '</Relationships>';
  }

  function settingsXml(){
    return ""
      + '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:settings xmlns:w="' + XMLNS_W + '">'
      + '<w:zoom w:percent="100"/>'
      + '<w:defaultTabStop w:val="720"/>'
      + '<w:compat/>'
      + '</w:settings>';
  }

  function corePropertiesXml(model){
    var iso =
      new Date().toISOString();

    return ""
      + '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<cp:coreProperties'
      + ' xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
      + ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
      + ' xmlns:dcterms="http://purl.org/dc/terms/"'
      + ' xmlns:dcmitype="http://purl.org/dc/dcmitype/"'
      + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + '<dc:title>' + xml(model.title) + '</dc:title>'
      + '<dc:subject>Informe institucional Global</dc:subject>'
      + '<dc:creator>' + xml(model.unit) + '</dc:creator>'
      + '<cp:lastModifiedBy>' + xml(model.unit) + '</cp:lastModifiedBy>'
      + '<dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created>'
      + '<dcterms:modified xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:modified>'
      + '</cp:coreProperties>';
  }

  function appPropertiesXml(){
    return ""
      + '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"'
      + ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
      + '<Application>Global</Application>'
      + '<AppVersion>1.0</AppVersion>'
      + '</Properties>';
  }

  function createPackage(model, assets){
    assets = assets || {};

    var images = [];
    var references = {};
    var nextRelation = 3;
    var nextImage = 1;

    ["logo", "chart"].forEach(function(key){
      var asset = assets[key];

      if(
        !asset ||
        !asset.bytes ||
        !asset.bytes.length
      ){
        return;
      }

      var extension =
        text(
          asset.extension ||
          "png"
        ).toLowerCase();

      var item = {
        key: key,
        id: "rId" + nextRelation,
        filename:
          "image" +
          nextImage +
          "." +
          extension,
        asset: asset
      };

      nextRelation += 1;
      nextImage += 1;

      images.push(item);
      references[key] = item;
    });

    var files = [
      {
        name: "[Content_Types].xml",
        data: contentTypesXml(images)
      },
      {
        name: "_rels/.rels",
        data: rootRelationshipsXml()
      },
      {
        name: "word/document.xml",
        data: documentXml(
          model,
          references
        )
      },
      {
        name: "word/_rels/document.xml.rels",
        data: documentRelationshipsXml(
          images
        )
      },
      {
        name: "word/styles.xml",
        data: stylesXml()
      },
      {
        name: "word/settings.xml",
        data: settingsXml()
      },
      {
        name: "docProps/core.xml",
        data: corePropertiesXml(model)
      },
      {
        name: "docProps/app.xml",
        data: appPropertiesXml()
      }
    ];

    images.forEach(function(image){
      files.push({
        name:
          "word/media/" +
          image.filename,
        data:
          image.asset.bytes
      });
    });

    return zip(files);
  }

  function download(bytes, filename){
    var blob = new Blob(
      [bytes],
      {
        type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
    );

    var url =
      URL.createObjectURL(blob);

    var anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";

    (
      document.body ||
      document.documentElement
    ).appendChild(anchor);

    anchor.click();
    anchor.remove();

    window.setTimeout(function(){
      URL.revokeObjectURL(url);
    }, 1500);

    return true;
  }

  function generate(options){
    var model;

    try{
      model =
        buildReportModel(
          options || {}
        );
    }catch(error){
      return Promise.reject(error);
    }

    return Promise.all([
      loadLogo(),
      loadGraduateChart(model)
    ]).then(function(results){
      var bytes =
        createPackage(
          model,
          {
            logo: results[0],
            chart: results[1]
          }
        );

      var filename =
        safeFilename(
          model.title
        ) +
        "-" +
        fileDate() +
        ".docx";

      download(
        bytes,
        filename
      );

      try{
        window.dispatchEvent(
          new CustomEvent(
            "global:word-generated",
            {
              detail: {
                ok: true,
                filename: filename,
                section: model.section.id,
                at:
                  new Date()
                    .toISOString()
              }
            }
          )
        );
      }catch(eventError){}

      return true;
    });
  }

  window.GlobalWord = {
    version:
      VERSION,

    generate:
      generate,

    buildReportModel:
      buildReportModel,

    helpers: {
      createPackage:
        createPackage,

      zip:
        zip,

      crc32:
        crc32,

      documentXml:
        documentXml,

      stylesXml:
        stylesXml,

      imageDimensions:
        imageDimensions
    }
  };
})(window, document);
