# Agente Creador de Dashboard

## Alcance

El agente `dashboard_creator` convierte archivos de compras en un dashboard ejecutivo dentro de Buyer Nodus. Mantiene el mismo agente, `agent_key`, slug y ubicacion: Nodus IA -> Creador de Dashboard.

El objetivo del flujo es producir un unico `DashboardResult` que alimente la vista en plataforma y los descargables PDF, Excel, Word y PowerPoint.

## Flujo Completo

1. El usuario completa el formulario del agente y sube uno o varios archivos.
2. El backend valida archivos y genera `dataProfile`.
3. El LLM recibe el perfil de datos y devuelve un `dashboardPlan`.
4. Python/backend ejecuta calculos deterministicos permitidos por el perfil.
5. `dashboard_builder.py` construye el `DashboardResult` final.
6. `quality_validator.py` elimina o degrada indicadores sin soporte y agrega `missingData` o `qualityWarnings`.
7. El frontend renderiza el dashboard desde ese `DashboardResult`.
8. Los exportadores convierten el mismo `DashboardResult` a PDF, Excel, Word y PowerPoint.

## Rol de Python y Backend

Python/backend calcula. Lee datos estructurados, perfila columnas, detecta campos candidatos, calcula metricas, rankings, concentraciones, ahorro, cumplimiento, OTIF, NPS, pagos, ciclos e inventario solo cuando existen campos suficientes.

El backend tambien valida que cada KPI, grafico, tabla, hallazgo y recomendacion tenga respaldo real.

## Rol del LLM

El LLM interpreta y planifica. No calcula metricas criticas ni inventa porcentajes, ahorros, OTIF, NPS, Kraljic, pagos o ciclos.

El LLM devuelve un `dashboardPlan` con indicadores aplicables, indicadores omitidos, graficos sugeridos, tablas sugeridas, resumen preliminar, hallazgos permitidos, recomendaciones permitidas y limitaciones.

## Rol del Frontend

El frontend visualiza. No recalcula metricas y no llama al LLM. La vista del agente usa componentes dedicados de `src/features/dashboard-creator/components` y renderiza `DashboardResult` con estilo ejecutivo, fondo blanco y paleta Buyer Nodus.

## Rol de Exportadores

Los exportadores convierten. `src/lib/agentPdf.ts` es la ruta oficial usada por la UI para PDF, Excel, Word y PowerPoint. No recalcula, no llama al LLM y no genera analisis distinto al visible en plataforma.

## dataProfile

`dataProfile` resume la evidencia disponible:

- archivos analizados, tipo, tamano, hojas y tablas detectadas;
- columnas originales y normalizadas;
- tipos detectados, nulos y ejemplos;
- campos candidatos de compras;
- muestras limitadas de filas;
- estadisticas basicas;
- analisis posibles;
- analisis no posibles con motivo y campos faltantes;
- nivel de confianza.

## dashboardPlan

`dashboardPlan` es la decision interpretativa del LLM:

- informacion del reporte;
- indicadores seleccionados y motivo;
- indicadores omitidos y campos faltantes;
- plan de graficos;
- plan de tablas;
- resumen, hallazgos, recomendaciones y limitaciones permitidas.

El plan no es fuente de calculo final.

## DashboardResult

`DashboardResult` es la fuente unica de verdad:

- `metadata`
- `executiveSummary`
- `dataProfile`
- `dashboardPlan`
- `kpis`
- `charts`
- `tables`
- `findings`
- `recommendations`
- `missingData`
- `qualityWarnings`
- `visualConfig`

Todo lo que se muestra o descarga debe salir de este objeto.

## Reglas Anti-Invencion

- Todo KPI debe tener valor, fuente y unidad si aplica.
- Todo grafico debe tener datos, titulo, leyenda y tipo valido.
- Toda tabla debe tener columnas y filas.
- Todo indicador no calculable debe ir a `missingData`.
- Todo hallazgo debe estar asociado a KPI, grafico, tabla, perfil o faltante.
- Toda recomendacion debe tener evidencia o responder a un dato faltante.
- No se permite Kraljic sin riesgo e impacto.
- No se permite OTIF sin fechas y cantidades.
- No se permite NPS sin escala 0-10 valida.
- No se permite ahorro sin precio comparativo.
- No se permiten ciclos con una sola fecha.
- No se permiten condiciones de pago sin plazo, condicion o fecha de pago.

## Indicadores Soportados

- Compras: total comprado, promedio, periodos, monedas y registros.
- Categorias: ranking, participacion y concentracion.
- Proveedores: ranking, concentracion, dependencia y cumplimiento simple.
- Ahorro: ahorro real, porcentaje y beneficio cuando hay comparativos validos.
- Cumplimiento: cumplido, no cumplido y porcentaje.
- OTIF: On Time, In Full y OTIF completo cuando hay datos suficientes.
- NPS/satisfaccion: NPS con escala 0-10 o satisfaccion promedio si no aplica NPS.
- Ciclos: solicitud a OC, OC a cierre, aprobacion a OC, OC a entrega y ciclo total.
- Pagos: credito, contado, plazo promedio y rangos.
- Riesgo/concentracion: top proveedores, Pareto y dependencia.
- Inventario/liquidaciones: stock, productos con mayor o menor stock y oportunidades.

## Visual Buyer Nodus

La experiencia visual usa fondo blanco y colores Buyer Nodus:

- Primario: `#0E109E`
- Secundario: `#5A31D5`
- Riesgo: `#F3313F`
- Exito: `#B2EB4A`

## Librerias Usadas

- `echarts` y `echarts-for-react` para graficos del dashboard creator.
- `@tanstack/react-table` para tablas del dashboard creator.
- `xlsx` para Excel.
- `docx` para Word.
- `pptxgenjs` para PowerPoint.
- `jspdf` y `html2canvas` para PDF/exportacion frontend.
- `pandas` y `openpyxl` para lectura y calculos de datos estructurados.
- `Recharts` se conserva porque sigue usado por componentes globales.

## Como Probar

1. Ejecutar `npm run build`.
2. Ejecutar `npx tsc --noEmit`.
3. Ejecutar `python -m compileall ai-engine/app/agents/dashboard_creator ai-engine/app/utils`.
4. Probar archivos con proveedores cumplidos, proveedores con montos, categorias con montos, precios base/negociado, OTIF, calificaciones, pagos, stock y varios archivos.
5. Validar que la plataforma y los descargables usen el mismo resultado.

## Agregar Indicadores Nuevos

Para agregar un indicador:

1. Ampliar deteccion en `data_profiler.py`.
2. Definir requisitos minimos de campos.
3. Agregar calculo deterministico en backend.
4. Extender `dashboard_builder.py` para exponer KPI, grafico, tabla o faltante.
5. Agregar validacion anti-invencion.
6. Actualizar documentacion y pruebas.

## Estado de /generate-pdf

La ruta `/agents/dashboard-creator/generate-pdf` se mantiene como legacy compatible. La UI usa `src/lib/agentPdf.ts` como ruta oficial de exportacion.

La ruta legacy debe convertir el `DashboardResult` recibido. No debe recalcular metricas, no debe llamar al LLM y no debe generar un analisis distinto.

## Limitaciones Conocidas

- PDF frontend representa graficos mediante recursos visuales/tabulares generados desde la misma data; no es una captura pixel-perfect del canvas de ECharts.
- La union de varios archivos depende de claves logicas detectables; si no hay claves claras, se analizan por separado.
- OCR e interpretacion de documentos no estructurados dependen de la calidad del archivo.
- Kraljic completo requiere datos explicitos de impacto y riesgo.
- Valor monetario de inventario requiere costo o precio.

## Pendientes Futuros

- Limpieza formal de la ruta legacy `/generate-pdf` si se confirma que ningun cliente externo la usa.
- Pruebas e2e con sesion real de usuario y descargas desde navegador.
- Revision separada de vulnerabilidades `npm audit`.
- Posible code splitting para reducir el chunk principal despues de integrar ECharts.
