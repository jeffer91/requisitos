/* =========================================================
Nombre completo: global.chart.js
Ruta o ubicación: /Requisitos/Global/global.chart.js
Función o funciones:
- Renderizar gráficos de barras sin librerías externas.
- Mostrar etiquetas completas, incluso en períodos académicos largos.
- Generar SVG reutilizable en pantalla y en el PDF institucional.
- Adaptar automáticamente orientación, márgenes y altura.
Con qué se conecta:
- global.app.js
- global.pdf.js
- global.css
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.1.0-full-labels";
  var SVG_NS = "http://www.w3.org/2000/svg";

  function text(value){
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function number(value){
    var parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function clamp(value, min, max){
    return Math.max(
      min,
      Math.min(max, value)
    );
  }

  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveMount(target){
    if(!target){
      return null;
    }

    if(typeof target === "string"){
      return document.querySelector(target);
    }

    if(
      target &&
      target.nodeType === 1
    ){
      return target;
    }

    return null;
  }

  function normalizeData(data, options){
    options = options || {};

    var labelKey = text(
      options.labelKey || "label"
    ) || "label";

    var valueKey = text(
      options.valueKey || "value"
    ) || "value";

    return (
      Array.isArray(data)
        ? data
        : []
    ).map(function(item, index){
      item = item || {};

      return {
        index:
          index,

        label:
          text(
            item[labelKey] != null
              ? item[labelKey]
              : item.label
          ),

        value:
          number(
            item[valueKey] != null
              ? item[valueKey]
              : item.value
          ),

        raw:
          item
      };
    }).filter(function(item){
      return !!item.label;
    });
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

  function niceMax(value){
    value = Math.max(
      0,
      number(value)
    );

    if(value <= 5){
      return 5;
    }

    var magnitude = Math.pow(
      10,
      Math.floor(
        Math.log10(value)
      )
    );

    var normalized =
      value / magnitude;

    var nice;

    if(normalized <= 1){
      nice = 1;
    }else if(normalized <= 2){
      nice = 2;
    }else if(normalized <= 5){
      nice = 5;
    }else{
      nice = 10;
    }

    return nice * magnitude;
  }

  function tickValues(maxValue, count){
    count = clamp(
      Math.round(
        number(count) || 5
      ),
      2,
      10
    );

    var max =
      niceMax(maxValue);

    var values = [];

    for(
      var index = 0;
      index <= count;
      index += 1
    ){
      values.push(
        Math.round(
          (max / count) * index
        )
      );
    }

    return values;
  }

  function shorten(value, maxLength){
    value = text(value);

    maxLength = Math.max(
      8,
      Number(maxLength || 30)
    );

    if(value.length <= maxLength){
      return value;
    }

    return (
      value.slice(
        0,
        maxLength - 1
      ) + "…"
    );
  }

  function wrapWords(
    value,
    maxChars,
    maxLines
  ){
    var words =
      text(value)
        .split(/\s+/)
        .filter(Boolean);

    maxChars = Math.max(
      10,
      Number(maxChars || 32)
    );

    maxLines = Math.max(
      1,
      Number(maxLines || 3)
    );

    var lines = [];
    var current = "";

    words.forEach(function(word){
      var candidate =
        current
          ? current + " " + word
          : word;

      if(candidate.length <= maxChars){
        current = candidate;
      }else{
        if(current){
          lines.push(current);
        }

        current = word;
      }
    });

    if(current){
      lines.push(current);
    }

    if(lines.length > maxLines){
      var retained =
        lines.slice(
          0,
          maxLines
        );

      retained[maxLines - 1] =
        retained[maxLines - 1] +
        " " +
        lines
          .slice(maxLines)
          .join(" ");

      lines = retained;
    }

    return lines.length
      ? lines
      : [""];
  }

  function svgTextLines(
    lines,
    x,
    y,
    options
  ){
    options = options || {};

    var anchor =
      options.anchor ||
      "start";

    var className =
      options.className ||
      "global-chart-category";

    var lineHeight =
      Number(
        options.lineHeight || 17
      );

    return ""
      + '<text class="' + esc(className) + '"'
      + ' x="' + x + '"'
      + ' y="' + y + '"'
      + ' text-anchor="' + esc(anchor) + '">'

      + lines.map(function(line, index){
        return ""
          + '<tspan x="' + x + '"'
          + ' dy="' + (
            index === 0
              ? 0
              : lineHeight
          ) + '">'
          + esc(line)
          + "</tspan>";
      }).join("")

      + "</text>";
  }

  function emptySVG(options){
    options = options || {};

    var width = Math.max(
      520,
      Number(options.width || 900)
    );

    var height = Math.max(
      220,
      Number(options.height || 280)
    );

    var message = esc(
      options.emptyMessage ||
      "No existen datos para graficar con los filtros aplicados."
    );

    return ""
      + '<svg xmlns="' + SVG_NS + '"'
      + ' class="global-chart-svg"'
      + ' viewBox="0 0 ' + width + " " + height + '"'
      + ' role="img"'
      + ' aria-label="' + message + '">'

      + '<rect class="global-chart-background"'
      + ' x="0"'
      + ' y="0"'
      + ' width="' + width + '"'
      + ' height="' + height + '"'
      + ' rx="16"></rect>'

      + '<text class="global-chart-empty-text"'
      + ' x="' + (width / 2) + '"'
      + ' y="' + (height / 2) + '"'
      + ' text-anchor="middle">'
      + message
      + "</text>"

      + "</svg>";
  }

  function buildVerticalBarSVG(
    data,
    options
  ){
    options = options || {};

    var rows =
      normalizeData(
        data,
        options
      );

    if(!rows.length){
      return emptySVG(options);
    }

    var fullLabels =
      options.fullLabels === true;

    var width = Math.max(
      720,
      Number(options.width || 980)
    );

    var longest = Math.max.apply(
      Math,
      rows.map(function(row){
        return row.label.length;
      })
    );

    var bottomMargin =
      fullLabels
        ? clamp(
          105 + longest * 2.2,
          145,
          230
        )
        : 110;

    var height = Math.max(
      400,
      Number(
        options.height ||
        (
          430 +
          (
            bottomMargin -
            110
          )
        )
      )
    );

    var margin = {
      top: 42,
      right: 30,
      bottom: bottomMargin,
      left: 72
    };

    var plotWidth =
      width -
      margin.left -
      margin.right;

    var plotHeight =
      height -
      margin.top -
      margin.bottom;

    var maximumValue = Math.max.apply(
      Math,
      rows.map(function(row){
        return row.value;
      })
    );

    var maxValue =
      niceMax(maximumValue);

    var ticks = tickValues(
      maxValue,
      options.tickCount || 5
    );

    var slotWidth =
      plotWidth / rows.length;

    var barWidth = clamp(
      slotWidth * 0.58,
      18,
      72
    );

    var parts = [];

    parts.push(
      '<svg xmlns="' + SVG_NS + '"'
      + ' class="global-chart-svg"'
      + ' viewBox="0 0 ' + width + " " + height + '"'
      + ' role="img"'
      + ' aria-label="'
      + esc(
        options.ariaLabel ||
        options.title ||
        "Gráfico de barras"
      )
      + '">'
    );

    parts.push(
      '<rect class="global-chart-background"'
      + ' x="0"'
      + ' y="0"'
      + ' width="' + width + '"'
      + ' height="' + height + '"'
      + ' rx="16"></rect>'
    );

    ticks.forEach(function(tick){
      var y =
        margin.top +
        plotHeight -
        (
          (tick / maxValue) *
          plotHeight
        );

      parts.push(
        '<line class="global-chart-grid-line"'
        + ' x1="' + margin.left + '"'
        + ' y1="' + y + '"'
        + ' x2="' + (width - margin.right) + '"'
        + ' y2="' + y + '"></line>'
      );

      parts.push(
        '<text class="global-chart-axis-text"'
        + ' x="' + (margin.left - 12) + '"'
        + ' y="' + (y + 5) + '"'
        + ' text-anchor="end">'
        + formatInteger(tick)
        + "</text>"
      );
    });

    rows.forEach(function(row, index){
      var x =
        margin.left +
        slotWidth * index +
        (
          (
            slotWidth -
            barWidth
          ) / 2
        );

      var barHeight =
        maxValue
          ? (
            row.value /
            maxValue
          ) * plotHeight
          : 0;

      var y =
        margin.top +
        plotHeight -
        barHeight;

      var center =
        x +
        barWidth / 2;

      var labelY =
        margin.top +
        plotHeight +
        28;

      var label =
        fullLabels
          ? row.label
          : shorten(
            row.label,
            options.maxLabelLength || 26
          );

      parts.push(
        '<g class="global-chart-bar-group"'
        + ' data-chart-index="' + index + '">'
      );

      parts.push(
        "<title>"
        + esc(
          row.label +
          ": " +
          formatInteger(row.value)
        )
        + "</title>"
      );

      parts.push(
        '<rect class="global-chart-bar"'
        + ' x="' + x + '"'
        + ' y="' + y + '"'
        + ' width="' + barWidth + '"'
        + ' height="' + Math.max(0, barHeight) + '"'
        + ' rx="6"></rect>'
      );

      parts.push(
        '<text class="global-chart-value"'
        + ' x="' + center + '"'
        + ' y="' + Math.max(22, y - 9) + '"'
        + ' text-anchor="middle">'
        + formatInteger(row.value)
        + "</text>"
      );

      parts.push(
        '<text class="global-chart-category"'
        + ' transform="translate('
        + center + " "
        + labelY
        + ') rotate(-38)"'
        + ' text-anchor="end">'
        + esc(label)
        + "</text>"
      );

      parts.push("</g>");
    });

    parts.push(
      '<line class="global-chart-axis-line"'
      + ' x1="' + margin.left + '"'
      + ' y1="' + (margin.top + plotHeight) + '"'
      + ' x2="' + (width - margin.right) + '"'
      + ' y2="' + (margin.top + plotHeight) + '"></line>'
    );

    parts.push("</svg>");

    return parts.join("");
  }

  function buildHorizontalBarSVG(
    data,
    options
  ){
    options = options || {};

    var rows =
      normalizeData(
        data,
        options
      );

    if(!rows.length){
      return emptySVG(options);
    }

    var fullLabels =
      options.fullLabels === true;

    var width = Math.max(
      760,
      Number(options.width || 980)
    );

    var longest = Math.max.apply(
      Math,
      rows.map(function(row){
        return row.label.length;
      })
    );

    var labelChars = clamp(
      Number(options.labelChars || 34),
      20,
      50
    );

    var maxLines = clamp(
      Number(options.maxLabelLines || 3),
      1,
      5
    );

    var leftMargin =
      fullLabels
        ? clamp(
          230 +
          Math.min(
            longest,
            70
          ) * 2.2,
          270,
          390
        )
        : 250;

    var wrapped =
      rows.map(function(row){
        return fullLabels
          ? wrapWords(
            row.label,
            labelChars,
            maxLines
          )
          : [
            shorten(
              row.label,
              options.maxLabelLength || 38
            )
          ];
      });

    var maxLineCount = Math.max.apply(
      Math,
      wrapped.map(function(lines){
        return lines.length;
      })
    );

    var rowHeight = clamp(
      Number(
        options.rowHeight ||
        (
          50 +
          (
            maxLineCount -
            1
          ) * 15
        )
      ),
      48,
      95
    );

    var height = Math.max(
      320,
      Number(
        options.height ||
        (
          rows.length *
          rowHeight +
          110
        )
      )
    );

    var margin = {
      top: 34,
      right: 90,
      bottom: 52,
      left: leftMargin
    };

    var plotWidth =
      width -
      margin.left -
      margin.right;

    var plotHeight =
      height -
      margin.top -
      margin.bottom;

    var maximumValue = Math.max.apply(
      Math,
      rows.map(function(row){
        return row.value;
      })
    );

    var maxValue =
      niceMax(maximumValue);

    var ticks = tickValues(
      maxValue,
      options.tickCount || 5
    );

    var slotHeight =
      plotHeight / rows.length;

    var barHeight = clamp(
      slotHeight * 0.48,
      16,
      32
    );

    var parts = [];

    parts.push(
      '<svg xmlns="' + SVG_NS + '"'
      + ' class="global-chart-svg"'
      + ' viewBox="0 0 ' + width + " " + height + '"'
      + ' role="img"'
      + ' aria-label="'
      + esc(
        options.ariaLabel ||
        options.title ||
        "Gráfico de barras"
      )
      + '">'
    );

    parts.push(
      '<rect class="global-chart-background"'
      + ' x="0"'
      + ' y="0"'
      + ' width="' + width + '"'
      + ' height="' + height + '"'
      + ' rx="16"></rect>'
    );

    ticks.forEach(function(tick){
      var x =
        margin.left +
        (
          (tick / maxValue) *
          plotWidth
        );

      parts.push(
        '<line class="global-chart-grid-line"'
        + ' x1="' + x + '"'
        + ' y1="' + margin.top + '"'
        + ' x2="' + x + '"'
        + ' y2="' + (height - margin.bottom) + '"></line>'
      );

      parts.push(
        '<text class="global-chart-axis-text"'
        + ' x="' + x + '"'
        + ' y="' + (height - 18) + '"'
        + ' text-anchor="middle">'
        + formatInteger(tick)
        + "</text>"
      );
    });

    rows.forEach(function(row, index){
      var y =
        margin.top +
        slotHeight * index +
        (
          (
            slotHeight -
            barHeight
          ) / 2
        );

      var barWidth =
        maxValue
          ? (
            row.value /
            maxValue
          ) * plotWidth
          : 0;

      var lineHeight = 16;
      var labelLines = wrapped[index];

      var labelBlockHeight =
        (
          labelLines.length -
          1
        ) * lineHeight;

      var labelY =
        y +
        barHeight / 2 +
        5 -
        labelBlockHeight / 2;

      var valueY =
        y +
        barHeight / 2 +
        5;

      parts.push(
        '<g class="global-chart-bar-group"'
        + ' data-chart-index="' + index + '">'
      );

      parts.push(
        "<title>"
        + esc(
          row.label +
          ": " +
          formatInteger(row.value)
        )
        + "</title>"
      );

      parts.push(
        svgTextLines(
          labelLines,
          margin.left - 14,
          labelY,
          {
            anchor: "end",
            className:
              "global-chart-category",
            lineHeight:
              lineHeight
          }
        )
      );

      parts.push(
        '<rect class="global-chart-bar"'
        + ' x="' + margin.left + '"'
        + ' y="' + y + '"'
        + ' width="' + Math.max(0, barWidth) + '"'
        + ' height="' + barHeight + '"'
        + ' rx="6"></rect>'
      );

      parts.push(
        '<text class="global-chart-value"'
        + ' x="' + (
          margin.left +
          barWidth +
          12
        ) + '"'
        + ' y="' + valueY + '"'
        + ' text-anchor="start">'
        + formatInteger(row.value)
        + "</text>"
      );

      parts.push("</g>");
    });

    parts.push(
      '<line class="global-chart-axis-line"'
      + ' x1="' + margin.left + '"'
      + ' y1="' + (height - margin.bottom) + '"'
      + ' x2="' + (width - margin.right) + '"'
      + ' y2="' + (height - margin.bottom) + '"></line>'
    );

    parts.push("</svg>");

    return parts.join("");
  }

  function buildBarSVG(data, options){
    options = options || {};

    var orientation =
      text(
        options.orientation
      ).toLowerCase();

    if(orientation === "auto"){
      var rows =
        normalizeData(
          data,
          options
        );

      var longest =
        rows.reduce(
          function(max, row){
            return Math.max(
              max,
              row.label.length
            );
          },
          0
        );

      orientation =
        rows.length >= 6 ||
        longest >= 24
          ? "horizontal"
          : "vertical";
    }

    if(orientation === "horizontal"){
      return buildHorizontalBarSVG(
        data,
        options
      );
    }

    return buildVerticalBarSVG(
      data,
      options
    );
  }

  function buildCardHTML(data, options){
    options = options || {};

    var title =
      text(
        options.title || "Gráfico"
      );

    var description =
      text(
        options.description || ""
      );

    var svg =
      buildBarSVG(
        data,
        options
      );

    return ""
      + '<section class="global-chart-card"'
      + " data-global-chart-card>"

      + '<div class="global-chart-card-head">'
      + "<div>"

      + (
        title
          ? '<h3 class="global-chart-title">'
            + esc(title)
            + "</h3>"
          : ""
      )

      + (
        description
          ? '<p class="global-chart-description">'
            + esc(description)
            + "</p>"
          : ""
      )

      + "</div>"
      + "</div>"

      + '<div class="global-chart-canvas">'
      + svg
      + "</div>"

      + "</section>";
  }

  function renderBar(target, options){
    options = options || {};

    var mount =
      resolveMount(target);

    if(!mount){
      return {
        ok: false,
        error:
          "No se encontró el contenedor del gráfico."
      };
    }

    var data =
      Array.isArray(options.data)
        ? options.data
        : [];

    mount.innerHTML =
      buildCardHTML(
        data,
        options
      );

    mount.setAttribute(
      "data-global-chart-ready",
      "true"
    );

    return {
      ok: true,
      mount: mount,

      rows:
        normalizeData(
          data,
          options
        ).length,

      svg:
        mount.querySelector("svg"),

      version:
        VERSION
    };
  }

  function render(target, options){
    options = options || {};

    var type =
      text(
        options.type || "bar"
      ).toLowerCase();

    if(type !== "bar"){
      return {
        ok: false,

        error:
          "Tipo de gráfico no compatible: " +
          type
      };
    }

    return renderBar(
      target,
      options
    );
  }

  function clear(target){
    var mount =
      resolveMount(target);

    if(!mount){
      return false;
    }

    mount.innerHTML = "";

    mount.removeAttribute(
      "data-global-chart-ready"
    );

    return true;
  }

  function svgToDataUri(svgMarkup){
    var value =
      text(svgMarkup);

    if(!value){
      return "";
    }

    return (
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(value)
    );
  }

  window.GlobalChart = {
    version:
      VERSION,

    render:
      render,

    renderBar:
      renderBar,

    clear:
      clear,

    buildBarSVG:
      buildBarSVG,

    buildCardHTML:
      buildCardHTML,

    svgToDataUri:
      svgToDataUri,

    helpers: {
      normalizeData:
        normalizeData,

      formatInteger:
        formatInteger,

      niceMax:
        niceMax,

      shorten:
        shorten,

      wrapWords:
        wrapWords,

      esc:
        esc
    }
  };

  try{
    window.dispatchEvent(
      new CustomEvent(
        "global:chart-ready",
        {
          detail: {
            ok: true,
            version: VERSION,
            at:
              new Date()
                .toISOString()
          }
        }
      )
    );
  }catch(error){}
})(window, document);