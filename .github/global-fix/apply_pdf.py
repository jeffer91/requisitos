from pathlib import Path

path = Path("Global/global.pdf.js")
content = path.read_text(encoding="utf-8")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(
            f"No se encontró una única ancla para {label}: {count}"
        )
    return source.replace(old, new, 1)


content = replace_once(
    content,
    "- Incluir resumen ejecutivo, explicaciones, observaciones, tabla y gráfico.",
    "- Incluir resumen ejecutivo, explicaciones, observaciones, tabla, gráfico y firmas institucionales.",
    "descripción PDF",
)

content = replace_once(
    content,
    '    "1.2.1-active-filters-only";',
    '    "1.3.0-signatures-and-word-model";',
    "versión PDF",
)

functions = '''  function institutionalSignatures(){
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

  function signatureBlock(){
    return ""
      + '<section class="signature-block"'
      + ' aria-label="Firmas institucionales">'

      + institutionalSignatures()
        .map(function(signature){
          return ""
            + '<div class="signature-item">'
            + '<strong class="signature-name">'
            + esc(signature.nombre)
            + "</strong>"
            + '<span class="signature-role">'
            + esc(signature.cargo)
            + "</span>"
            + "</div>";
        })
        .join("")

      + "</section>";
  }

'''

content = replace_once(
    content,
    "  function institutionalCss(){",
    functions + "  function institutionalCss(){",
    "funciones de firmas",
)

signature_css = '''      + ".signature-block{"
      + "margin-top:42px;"
      + "padding-top:24px;"
      + "min-height:235px;"
      + "break-inside:avoid;"
      + "page-break-inside:avoid;"
      + "text-align:left;"
      + "}"

      + ".signature-item{"
      + "width:300px;"
      + "break-inside:avoid;"
      + "page-break-inside:avoid;"
      + "}"

      + ".signature-item + .signature-item{"
      + "margin-top:88px;"
      + "}"

      + ".signature-name,"
      + ".signature-role{"
      + "display:block;"
      + "color:#000;"
      + "font-size:10.5px;"
      + "line-height:1.15;"
      + "}"

      + ".signature-name{"
      + "font-weight:700;"
      + "}"

      + ".signature-role{"
      + "font-weight:700;"
      + "max-width:245px;"
      + "}"

'''

content = replace_once(
    content,
    '      + ".footer-note{"',
    signature_css + '      + ".footer-note{"',
    "estilos de firmas",
)

content = replace_once(
    content,
    '''      + ".report-block,"
      + ".metric-card,"
      + ".info-card{"''',
    '''      + ".report-block,"
      + ".metric-card,"
      + ".info-card,"
      + ".signature-block,"
      + ".signature-item{"''',
    "protección de saltos de página",
)

content = replace_once(
    content,
    '''      + "seleccionados por el usuario."

      + "</p>"

      + "</section>"''',
    '''      + "seleccionados por el usuario."

      + "</p>"

      + signatureBlock()

      + "</section>"''',
    "bloque final de firmas",
)

content = replace_once(
    content,
    '''    filterRows:
      filterRows
  };''',
    '''    filterRows:
      filterRows,

    label:
      label,

    tableExplanation:
      tableExplanation,

    getSignatures:
      function(){
        return institutionalSignatures()
          .map(function(item){
            return {
              nombre: item.nombre,
              cargo: item.cargo
            };
          });
      },

    signatureBlock:
      signatureBlock
  };''',
    "API compartida del PDF",
)

path.write_text(content, encoding="utf-8")
