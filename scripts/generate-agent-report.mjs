import fs from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'docs');
const outputPath = path.join(outputDir, 'agentes-activos-prompts-logica.pdf');

fs.mkdirSync(outputDir, { recursive: true });

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const page = {
  width: doc.internal.pageSize.getWidth(),
  height: doc.internal.pageSize.getHeight(),
  marginX: 48,
  marginTop: 56,
  marginBottom: 52,
};

let y = page.marginTop;
let pageNumber = 1;

const colors = {
  navy: [21, 39, 73],
  teal: [15, 118, 110],
  blue: [37, 99, 235],
  slate: [71, 85, 105],
  gray: [100, 116, 139],
  light: [241, 245, 249],
  border: [203, 213, 225],
};

function setColor(rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function footer() {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(colors.gray);
  doc.text(`Buyer Nodus AI Engine - Prompts y logica | Pagina ${pageNumber}`, page.marginX, page.height - 28);
}

function addPage() {
  footer();
  doc.addPage();
  pageNumber += 1;
  y = page.marginTop;
}

function ensureSpace(height) {
  if (y + height > page.height - page.marginBottom) addPage();
}

function textBlock(text, options = {}) {
  const {
    size = 10,
    font = 'normal',
    color = colors.slate,
    leading = size * 1.35,
    indent = 0,
    spacingAfter = 8,
    maxWidth = page.width - page.marginX * 2 - indent,
  } = options;
  doc.setFont('helvetica', font);
  doc.setFontSize(size);
  setColor(color);
  const lines = doc.splitTextToSize(String(text).trim(), maxWidth);
  for (const line of lines) {
    ensureSpace(leading + 2);
    doc.text(line, page.marginX + indent, y);
    y += leading;
  }
  y += spacingAfter;
}

function heading(text, level = 1) {
  const size = level === 1 ? 18 : level === 2 ? 14 : 12;
  const color = level === 1 ? colors.navy : colors.teal;
  ensureSpace(size * 2.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  setColor(color);
  doc.text(text, page.marginX, y);
  y += size * 1.45;
  if (level === 1) {
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.line(page.marginX, y - 6, page.width - page.marginX, y - 6);
    y += 6;
  }
}

function codeBlock(text, label = 'Prompt') {
  const normalized = String(text).trim();
  const lines = doc.splitTextToSize(normalized, page.width - page.marginX * 2 - 24);
  const lineHeight = 10.5;
  let index = 0;
  while (index < lines.length) {
    const available = Math.floor((page.height - page.marginBottom - y - 46) / lineHeight);
    if (available < 6) addPage();
    const chunkSize = Math.max(6, Math.min(available, lines.length - index));
    const chunk = lines.slice(index, index + chunkSize);
    const boxHeight = chunk.length * lineHeight + 34;
    ensureSpace(boxHeight);
    doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.roundedRect(page.marginX, y, page.width - page.marginX * 2, boxHeight, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setColor(colors.blue);
    doc.text(label, page.marginX + 12, y + 16);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    setColor(colors.navy);
    let innerY = y + 30;
    for (const line of chunk) {
      doc.text(line, page.marginX + 12, innerY);
      innerY += lineHeight;
    }
    y += boxHeight + 10;
    index += chunkSize;
  }
}

function diagram(title, lines) {
  heading(title, 3);
  codeBlock(lines.join('\n'), 'Diagrama de flujo');
}

const prompts = {
  termsForm: `Actua como especialista senior en compras corporativas.
Lee la descripcion inicial del comprador y determina que tipo de requerimiento quiere crear.
Debes clasificar la categoria, detectar el tipo de requerimiento, seleccionar una plantilla recomendada y generar o ajustar un formulario detallado.
El formulario debe ser inteligente y depender de lo que el comprador quiere comprar, contratar o solicitar; evita preguntas irrelevantes.
Divide el formulario en pocos pasos claros y conserva solo campos minimos corporativos para que el documento final sea completo.
El formulario debe ser corto: evita pedir el mismo dato dos veces y no separes problema, beneficio e impacto en campos distintos.
No incluyas un campo llamado "Justificacion" ni "Justificacion" en el formulario.
No incluyas campos separados para "Problema que se busca resolver", "Beneficio esperado" o "Riesgo de no ejecutar".
Usa un solo campo llamado "Observaciones importantes" para riesgos, restricciones, antecedentes, impactos, urgencias o notas criticas.
Si necesitas contexto de justificacion, solicitalo dentro de "Observaciones importantes" sin hacerlo obligatorio.
Incluye campos especificos segun la categoria, ejemplos en placeholders, requisitos tecnicos, entregables, seguridad sugerida y documentos de apoyo recomendados.
No generes todavia el termino de referencia final.
Si la descripcion es vaga, genera un formulario base y agrega preguntas sugeridas en notes_for_buyer.
Devuelve exclusivamente JSON valido con las claves solicitadas.`,
  termsGenerate: `Actua como especialista senior en compras, abastecimiento y elaboracion de terminos de referencia para procesos de contratacion B2B.
Genera un documento profesional en espanol a partir de la descripcion inicial, categoria, formulario completado, documentos de apoyo, instrucciones adicionales y plantilla seleccionada.
El documento debe estar orientado a uso corporativo.
Incluye como minimo datos generales, objetivo, alcance, caracteristicas tecnicas, actividades requeridas, entregables, justificacion, requisitos SST/SSMA, condiciones para proveedores, estructura de informe final si aplica, cadena presupuestal si aplica, anexos sugeridos, informacion faltante y recomendaciones para el comprador.
Ademas genera apoyo operativo para compras: bases sugeridas para licitacion o solicitud de propuestas, correo sugerido para invitar proveedores y proceso sugerido de licitacion.
Reglas: no inventes datos especificos; usa "No especificado" cuando un dato no este disponible; si falta informacion, agregala en informacion faltante o puntos por validar; mejora la redaccion tecnica; usa tono corporativo claro y profesional; adapta el documento al tipo de servicio o compra; sugiere requisitos de seguridad razonables indicando que deben ser validados por el comprador.
Las bases de licitacion y el correo son una guia inicial operativa, no documentos legales definitivos, y deben incluir advertencia de revision interna/legal cuando aplique.
Si hay documentos de apoyo, usalos como contexto. Si hay planos o fichas tecnicas, extrae medidas, cantidades, equipos o condiciones relevantes cuando sea posible. Si hay fotos o anexos, usalos para reforzar la justificacion, alcance o anexos sugeridos.
Devuelve exclusivamente JSON valido. No devuelvas markdown fuera del JSON.`,
  proposal: `Actua como analista senior de compras corporativas.
Debes comparar propuestas de proveedores y generar una matriz de evaluacion ponderada.
No pidas criterios manuales al usuario.
Define automaticamente los criterios de evaluacion adecuados segun el tipo de compra/servicio, el objetivo del comprador y la informacion contenida en las propuestas.
Asigna pesos porcentuales que sumen 100%.
Califica a cada proveedor del 1 al 5 por criterio:
1 = Muy deficiente, 2 = Deficiente, 3 = Aceptable, 4 = Bueno, 5 = Excelente.
Explica en observaciones por que se asignan esas calificaciones.
Genera una guia de criterios con escala de 1 a 5 y fuente de verificacion.
Calcula el puntaje ponderado total: suma(valoracion * peso_percent / 100). El maximo posible es 5.00.
Recomienda el proveedor con mejor equilibrio tecnico, comercial y de riesgo.
No elijas automaticamente al proveedor mas barato.

Evalua precio, alcance tecnico, condiciones comerciales, forma de pago, garantia, certificaciones, experiencia, riesgo operativo, exclusiones, observaciones, claridad de propuesta e informacion faltante.
Detecta condiciones como pago adelantado, pago a 30 dias, 50% al inicio y 50% al final, contrato minimo, renovacion automatica, vigencia de oferta, reajustes, garantia, penalidades, descuentos por incumplimiento, exclusiones, servicios no incluidos, certificaciones ISO, SCTR, EPPs, supervision, app de control, plan de contingencias y referencias comerciales.

Reglas:
- Devuelve exclusivamente JSON valido, sin markdown ni comentarios.
- El resultado debe estar en espanol.
- No inventes datos no presentes en las propuestas.
- Si un dato no aparece, usa null o "No especificado".
- Penaliza informacion faltante, incumplimientos criticos y propuestas incompletas.
- Si falta informacion clave, el proveedor no debe recibir 5 en ese criterio.
- Precio no debe dominar todo el analisis por si solo.
- Justifica el ranking y la recomendacion.
- Senala informacion faltante y preguntas concretas para los proveedores.
- Manten un tono profesional, claro y util para un comprador corporativo.`,
  tco: `Eres un analista senior de compras corporativas especializado en TCO (Total Cost of Ownership),
costos ocultos, evaluacion economica, riesgos de abastecimiento e importacion vs compra local.

Reglas obligatorias:
- El analisis principal lo realizas tu como LLM con la informacion disponible.
- Analiza documentos, imagenes, cotizaciones, propuestas, Excel, CSV, fichas tecnicas, contratos y datos escritos por el usuario.
- Siempre entrega un analisis preliminar util aunque falten datos.
- Si falta informacion, incluye exactamente esta idea: "Con la informacion disponible se puede realizar este analisis preliminar. Para mejorar la precision del TCO, seria recomendable contar con los siguientes datos..."
- No elijas solo por precio inicial.
- No inventes impuestos, aranceles, tipo de cambio, fletes, seguros, costos legales ni regulaciones.
- No inventes marcas, modelos, proveedores, red de soporte, disponibilidad de repuestos, garantia, lead time, descuentos, mantenimiento incluido, condiciones tecnicas ni reputacion. Solo mencionalos si aparecen en los documentos o en el contexto escrito por el usuario.
- No infieras "amplia red de soporte", "repuestos disponibles", "garantia integral", "descuento comercial", "stock inmediato" ni beneficios similares por conocimiento general de mercado. Si el documento no lo dice, usa "No especificado".
- Si un dato no aparece, usa "No especificado".
- Separa datos encontrados, SUPUESTOS, datos faltantes y limitaciones.
- Todo supuesto debe empezar con la palabra "SUPUESTO".
- No presentes supuestos como datos reales.
- Cada dato clave debe indicar fuente en el texto cuando sea posible.
- Nunca coloques TCO, precio, ahorro, sobrecosto o costo esperado como 0 cuando el dato falta. Usa null o "No especificado".
- Siempre califica cada alternativa comparada con un puntaje de 0 a 100, aun si el analisis es preliminar.
- La calificacion debe ponderar TCO/costo total 35%, riesgo 25%, garantia/soporte 20%, disponibilidad/lead time 10% y calidad/confianza de informacion 10%.
- Incluye score_label con escala ejecutiva: Excelente, Muy buena, Buena, Regular, Debil.
- Sugiere preguntas concretas para proveedores.
- Devuelve exclusivamente JSON valido.
- Usa lenguaje ejecutivo, claro y profesional.
- Manten el disclaimer indicado.`,
  dashboard: `Actua como analista senior de compras, reporteria y business intelligence para procurement corporativo.

Tu trabajo en este agente es complementar los calculos confiables de Python y convertir informacion documental o parcialmente estructurada en un dashboard visual util.

Recibiras:
- contexto del usuario,
- perfil tecnico de archivos,
- muestras compactas de Excel/CSV,
- fragmentos relevantes de PDFs, Word o imagenes OCR,
- limitaciones de extraccion.

Debes:
- extraer KPIs reales si estan escritos en los documentos o tablas,
- crear graficos con puntos de datos que existan en el paquete,
- crear leyendas claras para cada grafico con etiqueta, valor numerico y porcentaje cuando aplique,
- asegurar que cada grafico tenga datos numericos visibles para el usuario,
- crear tablas resumen con la misma informacion del documento,
- respetar los KPIs, tablas y graficos calculados por Python cuando existan,
- redactar resumen ejecutivo,
- generar insights, observaciones y recomendaciones,
- indicar informacion faltante y limitaciones.

Reglas obligatorias:
- No inventes datos.
- No inventes montos, proveedores, fechas, categorias ni porcentajes.
- Si una cifra no esta explicitamente en el paquete, no la presentes como dato real.
- No uses nombres de columnas genericas como "Columna1" para inventar significado financiero.
- Si un dato viene de PDF o texto extraido, marca la confianza segun claridad de la fuente.
- Si la informacion es parcial, usa confidence="low" o "medium" y explicalo.
- El dashboard debe tener formato ejecutivo: KPIs, graficos, tablas, insights y recomendaciones.
- Todo grafico circular, de barras, lineas o areas debe poder leerse sin depender del tooltip.
- Devuelve exclusivamente JSON valido.
- No devuelvas markdown fuera del JSON.`,
};

function cover() {
  doc.setFillColor(colors.navy[0], colors.navy[1], colors.navy[2]);
  doc.rect(0, 0, page.width, 160, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text('Agentes IA Activos', page.marginX, 72);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Prompts, logica de funcionamiento y diagramas', page.marginX, 104);
  y = 205;
  heading('Alcance', 1);
  textBlock('Este documento resume los agentes activos en el catalogo base de Buyer Nodus: Elaboracion de terminos de referencia, Comparativos de propuestas de proveedores, Analisis de Costo Total / TCO y Creador de Dashboard.', { size: 11 });
  textBlock('Fuente: ai-engine/app/agents/*/prompts.py, ai-engine/app/agents/*/service.py y shared/nodusIaAgents.ts.', { size: 10, color: colors.gray });
}

function agentSection({ title, status, endpoints, promptBlocks, logic, diagramLines, outputs }) {
  addPage();
  heading(title, 1);
  textBlock(`Estado en catalogo: ${status}`, { size: 10, font: 'bold', color: colors.teal });
  textBlock(`Endpoints principales: ${endpoints.join(' | ')}`, { size: 9.5, color: colors.gray });
  heading('Logica de funcionamiento', 2);
  for (const item of logic) textBlock(`- ${item}`, { size: 10 });
  diagram('Diagrama', diagramLines);
  heading('Salidas esperadas', 2);
  for (const item of outputs) textBlock(`- ${item}`, { size: 10 });
  heading('Prompt principal', 2);
  for (const block of promptBlocks) codeBlock(block.text, block.label);
}

cover();

agentSection({
  title: '1. Elaboracion de Terminos de Referencia',
  status: 'active / isActive true',
  endpoints: ['/agents/terms-of-reference/form-schema', '/agents/terms-of-reference/generate', '/agents/terms-of-reference/generate-pdf'],
  logic: [
    'El comprador escribe una descripcion inicial de lo que necesita contratar o comprar.',
    'El AI Engine clasifica categoria, tipo de requerimiento, complejidad y plantilla recomendada.',
    'Se genera un formulario inteligente, corto y adaptado a la categoria.',
    'El comprador completa campos, puede adjuntar documentos y solicita la generacion.',
    'El servicio estructura el contexto documental temporal y arma la solicitud final.',
    'Claude devuelve JSON con documento, bases de licitacion, correo a proveedores, checklist y recomendaciones.',
    'El backend valida calidad, completa metricas faltantes y puede generar PDF.',
  ],
  diagramLines: [
    '[Usuario describe necesidad]',
    '          |',
    '          v',
    '[form-schema: clasificar y crear formulario]',
    '          |',
    '          v',
    '[Usuario completa formulario + adjunta documentos]',
    '          |',
    '          v',
    '[Lectura temporal de archivos]',
    '          |',
    '          v',
    '[Solicitud GENERATE + Claude JSON]',
    '          |',
    '          v',
    '[Validacion de calidad + checklist + metricas]',
    '          |',
    '          v',
    '[TdR + bases + correo + PDF]',
  ],
  outputs: ['Documento TdR estructurado', 'Bases sugeridas de licitacion', 'Correo de invitacion a proveedores', 'Checklist y metricas de completitud', 'PDF descargable'],
  promptBlocks: [
    { label: 'FORM_SCHEMA_SYSTEM_PROMPT', text: prompts.termsForm },
    { label: 'GENERATE_SYSTEM_PROMPT', text: prompts.termsGenerate },
  ],
});

agentSection({
  title: '2. Comparativos de Propuestas de Proveedores',
  status: 'active / isActive true',
  endpoints: ['/agents/proposal-comparison/analyze'],
  logic: [
    'El comprador sube minimo dos propuestas o cotizaciones.',
    'El servicio valida formatos permitidos y limite de archivos.',
    'Cada archivo se guarda temporalmente y se convierte en payload documental trazable.',
    'El agente arma una solicitud con servicio, objetivo y evidencia documental.',
    'Claude genera JSON con matriz ponderada, criterios automaticos, ranking, riesgos y recomendacion.',
    'El servicio normaliza ranking y verifica que existan al menos dos proveedores y criterios.',
    'Los archivos temporales se eliminan al finalizar.',
  ],
  diagramLines: [
    '[Usuario sube 2+ propuestas]',
    '          |',
    '          v',
    '[Validacion de archivos]',
    '          |',
    '          v',
    '[Lectura PDF/DOCX/XLSX/CSV/Imagen]',
    '          |',
    '          v',
    '[Solicitud comparativa + Claude JSON]',
    '          |',
    '          v',
    '[Normalizar ranking y matriz]',
    '          |',
    '          v',
    '[Comparativo + recomendacion + preguntas]',
  ],
  outputs: ['Matriz de evaluacion ponderada', 'Criterios y pesos generados por IA', 'Ranking de proveedores', 'Riesgos e informacion faltante', 'Recomendacion final'],
  promptBlocks: [{ label: 'SYSTEM_PROMPT', text: prompts.proposal }],
});

agentSection({
  title: '3. Analisis de Costo Total / TCO',
  status: 'active / isActive true',
  endpoints: ['/agents/tco-analysis/analyze', '/agents/tco-analysis/generate-pdf'],
  logic: [
    'El comprador ingresa contexto, alternativas manuales o documentos.',
    'El servicio valida campos obligatorios: titulo, item, tipo, horizonte, unidad y moneda.',
    'Estructura documentos y compacta evidencia relevante para TCO.',
    'Si hay imagenes, las manda como contenido multimodal a Claude.',
    'Claude realiza analisis documental, sin inventar datos faltantes.',
    'El servicio sanea resultados: evita ceros falsos, normaliza niveles de riesgo y completa defaults.',
    'Si Claude no responde, el endpoint devuelve un error controlado.',
  ],
  diagramLines: [
    '[Usuario: contexto + documentos + alternativas]',
    '          |',
    '          v',
    '[Validar campos TCO]',
    '          |',
    '          v',
    '[Extraer y compactar evidencia relevante]',
    '          |',
    '          v',
    '[Texto + imagenes -> Claude JSON]',
    '          |',
    '          v',
    '[Sanitizar totales, ranking, riesgos]',
    '          |',
    '          v',
    '[Matriz TCO + score + recomendacion]',
  ],
  outputs: ['Resumen ejecutivo TCO', 'Alternativas detectadas', 'Matriz de costos', 'Ranking con score 0-100', 'Riesgos, supuestos, datos faltantes y preguntas', 'PDF descargable'],
  promptBlocks: [{ label: 'SYSTEM_PROMPT', text: prompts.tco }],
});

agentSection({
  title: '4. Creador de Dashboard',
  status: 'active / isActive true',
  endpoints: ['/agents/dashboard-creator/generate', '/agents/dashboard-creator/generate-pdf'],
  logic: [
    'El comprador sube archivos de datos y define objetivo, audiencia, periodo y foco visual.',
    'El perfilador revisa archivos: columnas numericas, fechas, categorias, calidad de datos y muestras.',
    'El perfilador calcula KPIs, tablas, graficos base e insights basicos.',
    'Si se requiere interpretacion adicional o hay documentos poco estructurados, se envia el payload documental a Claude.',
    'Claude complementa resumen ejecutivo, KPIs documentales, graficos, tablas, observaciones y recomendaciones.',
    'El servicio fusiona resultados deterministas y documentales, normaliza charts y limita contenido para UI.',
    'Si Claude no responde, el dashboard conserva resultados deterministas cuando el flujo lo permite.',
  ],
  diagramLines: [
    '[Usuario sube datos + objetivo]',
    '          |',
    '          v',
    '[profile_files]',
    '          |',
    '          v',
    '[KPIs + graficos + tablas base]',
    '          |',
    '          v',
    '[LLM opcional con resumen compacto]',
    '          |',
    '          v',
    '[Fusion y normalizacion]',
    '          |',
    '          v',
    '[Dashboard visual + PDF]',
  ],
  outputs: ['Resumen ejecutivo', 'KPIs', 'Graficos con leyenda visible', 'Tablas', 'Insights y observaciones', 'Recomendaciones', 'PDF descargable'],
  promptBlocks: [{ label: 'SYSTEM_PROMPT', text: prompts.dashboard }],
});

addPage();
heading('Orquestacion General', 1);
diagram('Mapa general frontend/backend/AI Engine', [
  '[Frontend NexuIA]',
  '       | consulta catalogo',
  '       v',
  '[Backend Nest /agents]',
  '       | estado, permisos, uso, feedback, PDF options',
  '       v',
  '[AI Engine FastAPI]',
  '       | rutas especializadas por agente',
  '       v',
  '[Document processing + Prompt builder]',
  '       |',
  '       v',
  '[Claude Messages API]',
  '       |',
  '       v',
  '[Validacion / normalizacion / PDF]',
]);
textBlock('Nota operativa: el catalogo base define si un agente aparece como activo para compradores. El panel admin puede aplicar overrides de estado en backend. Para estos cuatro agentes, el catalogo base queda en active/isActive true.', { size: 10 });

footer();
doc.save(outputPath);
console.log(outputPath);
