# Evaluacion de herramientas XLSX/CSV para dashboard_creator

Fecha: 2026-05-27

Alcance: esta evaluacion aplica solo al agente `dashboard_creator`. No propone cambios de `agent_key`, slug, rutas, otros agentes ni arquitectura global.

## Estado actual

Dependencias frontend ya instaladas:

- `xlsx`: lectura/escritura basica de hojas de calculo.
- `exceljs`: workbooks con estilos, hojas, formatos y mejor salida ejecutiva.
- `@tanstack/react-table`: tablas interactivas del dashboard.
- `echarts` y `echarts-for-react`: graficos visuales del dashboard.
- `jspdf`: PDF del lado frontend.
- `html2canvas`: disponible como dependencia transitiva de `jspdf` y usado por el exportador.
- `pptxgenjs`: PowerPoint ejecutivo.
- `docx`: disponible para otros flujos, aunque el DOCX esta oculto para `dashboard_creator`.
- `@playwright/test`: disponible en devDependencies para pruebas/capturas robustas si se requiere.

Dependencias backend ya instaladas:

- `pandas`: lectura, limpieza y calculo deterministico de datos.
- `openpyxl`: soporte Excel para pandas.
- `markitdown[pdf,docx,xlsx]`: extraccion documental auxiliar.
- `PyMuPDF`, `pypdf`, `python-docx`, `Pillow`, `pytesseract`: lectura de documentos e imagenes.

Herramientas no instaladas:

- `react-dropzone`
- `react-spreadsheet-import`
- `ag-grid-community`
- `handsontable`

## Tabla de evaluacion

| Libreria/repositorio | Para que sirve | Ya instalada | Conviene usarla | Prioridad | Riesgo de licencia | Riesgo tecnico | Beneficio para dashboard_creator | Recomendacion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SheetJS / `xlsx` | Leer y escribir XLSX/CSV de forma amplia. | Si | Si, como compatibilidad y lectura/escritura simple. | Media | Bajo-medio: Community Edition es Apache 2.0, pero el paquete npm publico va atrasado frente al canal oficial. | Medio: estilos limitados y mantenimiento npm menos claro. | Mantiene compatibilidad con flujos actuales y datos planos. | Mantener. No usarlo como base principal para Excel ejecutivo visual. |
| `exceljs` | Crear XLSX con hojas, estilos, formatos, anchos, bordes e imagenes. | Si | Si. | Alta | Bajo: MIT. | Medio: mayor API y peso que `xlsx`. | Mejora Excel ejecutivo sin recalcular metricas. | Usar como motor principal de exportacion Excel visual. |
| `react-spreadsheet-import` | Wizard de importacion con preview, validacion y mapeo de columnas. | No | Si, si se aprueba una fase de prevalidacion antes de generar dashboard. | Alta para preview/mapeo; media para el flujo actual. | Bajo: verificar licencia MIT del repo/paquete antes de instalar. | Medio: agrega flujo UI nuevo y requiere contrato de mapeo. | Permite que el usuario confirme columnas como monto, fecha, proveedor y categoria antes del analisis. | Instalar solo en una fase dedicada de "preview y mapeo". |
| `@tanstack/react-table` | Tablas interactivas, ordenamiento, paginacion y render controlado. | Si | Si. | Alta | Bajo: MIT. | Bajo-medio: es headless, requiere UI propia. | Ya encaja con dashboard ejecutivo y evita grids pesados. | Mantener como tabla principal del dashboard. |
| AG Grid Community | Data grid potente con filtros, virtualizacion y experiencia tipo Excel. | No | Solo si TanStack queda corto. | Media-baja | Bajo para Community: MIT; cuidado con features Enterprise comerciales. | Medio-alto: bundle y API mas grandes. | Mejor para datasets grandes, filtros avanzados y grid muy interactivo. | No instalar ahora. Evaluar si se pide preview masivo con filtros avanzados. |
| Handsontable | Spreadsheet editable tipo Excel. | No | No para esta fase. | Baja | Alto para producto comercial: licencia gratuita orientada a no comercial/evaluacion; comercial requiere licencia. | Medio-alto: costo/licencia y complejidad. | Experiencia spreadsheet editable avanzada. | Evitar salvo aprobacion comercial explicita. |
| `react-dropzone` | Drag & drop robusto con validacion de archivos. | No | Opcional. | Media | Bajo: MIT. | Bajo. | Mejora accesibilidad, errores y control de rechazos si el upload nativo queda corto. | No instalar ahora si el drag & drop nativo funciona. Instalar si se requiere UX mas robusta. |
| Apache ECharts | Graficos avanzados e interactivos. | Si | Si. | Alta | Bajo: Apache 2.0. | Medio: mapeos de opciones deben mantenerse limpios. | Es la mejor base visual actual para graficos tipo Power BI. | Mantener como motor de graficos. |
| `echarts-for-react` | Wrapper React para ECharts. | Si | Si. | Alta | Bajo: MIT. | Bajo. | Integra ECharts en componentes React actuales. | Mantener. |
| `html2canvas` | Capturar DOM/graficos como imagen para exportables. | Transitiva y usada | Si, primero. | Alta | Bajo: MIT. | Medio: puede fallar con estilos complejos, CORS o canvas. | Permite llevar visuales del dashboard a PDF/Word/PPT/Excel. | Usar primero para capturas visuales. |
| Playwright | Captura robusta desde navegador real y pruebas visuales. | Si, devDependency | Si, solo si html2canvas no basta. | Media | Bajo: Apache 2.0. | Medio-alto: requiere flujo server/CI y navegador. | Capturas mas fieles para PDFs/imagenes si el DOM complejo falla. | No mover a runtime ahora. Evaluar en fase de exportacion visual avanzada. |
| pandas + openpyxl | Lectura de hojas, limpieza, headers reales y calculos. | Si | Si. | Alta | Bajo: licencias open-source permisivas/compatibles. | Medio: requiere reglas de deteccion bien probadas. | Es la base correcta para calculos deterministas y lectura robusta. | Mantener como fuente principal para XLSX/CSV estructurados. |

## Recomendacion por necesidad

### A. Drag & drop

Mantener el drag & drop nativo actual si las validaciones cumplen: extensiones, duplicados, maximo de archivos y mensajes claros. Instalar `react-dropzone` solo si se necesita una zona de carga mas accesible, estados de rechazo mas finos o manejo avanzado de multiples archivos.

Prioridad: media.

### B. Excel visual

Usar `exceljs` como motor principal para Excel ejecutivo. `xlsx` debe quedar como compatibilidad para datos planos y flujos legacy, pero no como base visual.

Prioridad: alta.

### C. Preview y mapeo de columnas

La mejora mas valiosa siguiente seria una fase de preview/mapeo con `react-spreadsheet-import` o un componente propio ligero. Esta fase permitiria que el usuario confirme:

- columna de monto principal;
- columna de fecha;
- proveedor;
- categoria;
- comprador;
- estado;
- moneda;
- hojas que deben incluirse o excluirse.

Esto reduciria errores como usar `Centro Costo` como monto y haria el dashboard mas parecido a un analista de Power BI.

Prioridad: alta si el usuario quiere control antes de generar el dashboard.

### D. Tablas grandes

Mantener `@tanstack/react-table`. AG Grid Community solo conviene si aparecen necesidades de:

- virtualizacion pesada;
- filtros tipo Excel;
- agrupaciones complejas;
- edicion masiva;
- pinned columns;
- datasets muy grandes en preview.

No instalar AG Grid ahora.

### E. Graficos

Mantener ECharts y `echarts-for-react`. Es suficiente para barras, lineas, dona, pareto, stacked bars, scatter, matriz Kraljic y visuales ejecutivos.

### F. Captura visual

Usar `html2canvas` primero para capturar KPIs/graficos de la vista publica. Evaluar Playwright solo si:

- html2canvas no captura bien ECharts;
- las imagenes salen borrosas;
- hay problemas CORS;
- se necesita exportacion server-side mas fiel.

## Que instalar primero

No instalar nada en esta fase.

Si se aprueba una fase siguiente, el orden recomendado es:

1. `react-spreadsheet-import`, para preview y mapeo previo de columnas.
2. `react-dropzone`, solo si la zona nativa no alcanza el nivel UX deseado.
3. AG Grid Community, solo si TanStack no soporta la experiencia de grid requerida.

## Que no instalar

- Handsontable, salvo aprobacion comercial/licencia. Para un producto comercial, su licencia gratuita no es una base segura.
- Tremor u otro UI kit adicional para este agente, porque ya hay componentes propios, ECharts y TanStack.
- Playwright como dependencia runtime, salvo que se defina una arquitectura de captura server-side.

## Riesgos y mitigaciones

- Riesgo de licencia: evitar Handsontable en produccion comercial sin licencia.
- Riesgo de bundle: AG Grid puede aumentar peso y complejidad si se instala sin necesidad.
- Riesgo de doble fuente de verdad: preview/mapeo no debe recalcular; solo debe producir instrucciones/mapping para el backend.
- Riesgo de datos sensibles: no guardar archivos originales de forma permanente.
- Riesgo de CSV/Excel injection: al exportar valores a Excel/CSV, escapar celdas que empiecen con `=`, `+`, `-` o `@`.
- Riesgo de columnas ambiguas: el mapeo manual debe poder confirmar o corregir deteccion automatica.

## Estrategia recomendada para mejorar XLSX/CSV

1. Mantener pandas/openpyxl para lectura real de archivos y calculos.
2. Agregar una vista previa opcional antes de generar dashboard.
3. Permitir que el usuario confirme columnas criticas.
4. Enviar el mapping confirmado al backend como parte de las instrucciones del agente.
5. Usar el mapping para priorizar hojas, columnas y filtros.
6. Generar el DashboardResult publico limpio como unica fuente.
7. Exportar PDF, Excel y PowerPoint desde la misma salida publica.

## Prompt sugerido para Codex

```text
Implementa una fase de preview y mapeo de columnas solo para dashboard_creator.
No cambies agent_key, slug, rutas ni otros agentes.
Usa react-spreadsheet-import solo si esta aprobado e instalado.
El usuario debe poder confirmar monto principal, fecha, proveedor, categoria, comprador, moneda, estado y hojas a incluir.
El mapping confirmado debe enviarse al backend y usarse como instrucciones de analisis.
No recalcules metricas en frontend.
No muestres dataProfile, dashboardPlan ni informacion tecnica al usuario.
Ejecuta npm run build, npx tsc --noEmit y compileall del agente.
```

## Prompt sugerido para Claude

```text
Revisa el flujo dashboard_creator y disena una mejora incremental de preview/mapeo para Excel/CSV.
No crees otro agente ni cambies rutas.
Evalua si conviene react-spreadsheet-import o un componente propio con TanStack Table.
El objetivo es que el usuario valide columnas criticas antes del analisis.
Entrega arquitectura, riesgos, archivos a tocar y criterios de aceptacion.
No implementes ni instales dependencias sin aprobacion.
```

## Fuentes consultadas

- SheetJS Community Edition: licencia Apache 2.0.
- ExcelJS: licencia MIT.
- TanStack Table: licencia MIT.
- AG Grid: Community MIT y Enterprise comercial.
- Handsontable: uso gratuito orientado a no comercial/evaluacion; comercial requiere licencia.
- react-dropzone: licencia MIT.
- Apache ECharts: Apache 2.0.
- echarts-for-react: MIT.
- html2canvas: MIT.
- Playwright: Apache 2.0.
