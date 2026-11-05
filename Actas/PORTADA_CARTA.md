# Portada institucional de actas — formato Carta

Este estándar se aplica a los PDF del módulo Actas de Requisitos y toma como referencia la aplicación [Ubicarportads](https://github.com/jeffer91/Ubicarportads).

## Tamaño de todas las páginas

- Papel: Carta / Letter vertical, **21,59 × 27,94 cm** (215,9 × 279,4 mm; PDF 612 × 792 pt).
- El mismo tamaño se utiliza en la portada y todas las páginas siguientes.
- Solo la primera página lleva cuadro de responsabilidades.

## Área de responsabilidades en la portada

| Elemento | Centímetros | Milímetros |
|---|---:|---:|
| Ancho máximo | 18,00 | 180,0 |
| Alto máximo | 4,20 | 42,0 |
| Margen izquierdo | 1,795 | 17,95 |
| Margen derecho | 1,795 | 17,95 |
| Margen inferior | 1,80 | 18,0 |
| Inicio desde arriba | 21,94 | 219,4 |
| Fin desde arriba | 26,14 | 261,4 |

En jsPDF, con unidades milimétricas y origen en la esquina superior izquierda, el rectángulo es x=17.95, y=219.4, ancho=180 y alto=42. Tres columnas iguales de 6 cm: ELABORADO, REVISADO y APROBADO.

Cada columna reserva una zona libre para firma, una fila de nombre y otra de cargo. No deben superponerse textos ni áreas; la aplicación no aplica firmas electrónicas.

## Exportación y folios

La descarga del período genera un ZIP con un PDF Carta por acta final habilitada, y un CSV con todos los expedientes (incluidos y excluidos). Cada PDF debe mantener el folio único de Firestore.

Los nuevos folios siguen los formatos CX-AAAA-CCCC-MM-NNNN y TT-AAAA-CCCC-MM-NNNN. El contador es institucional y mensual, compartido por las dos modalidades. Los folios antiguos sin prefijo se conservan sin renumeración.

**Despliegue**: antes de emitir nuevas actas CX/TT se deben publicar las reglas actualizadas de firestore.rules. El cambio en GitHub no las despliega automáticamente.
