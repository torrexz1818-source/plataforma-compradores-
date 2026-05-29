import type { FileQualityReport, FileValidationInput, QualityIssue, QualityStatus } from './qualityTypes';
import { unique } from './qualityUtils';

const DEFAULT_ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'jpg', 'jpeg', 'png'];
const DEFAULT_MAX_FILES = 8;
const DEFAULT_MAX_FILE_SIZE_MB = 10;
const MIN_USEFUL_CSV_ROWS = 2;
const MIN_USEFUL_COLUMNS = 2;

function extensionOf(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? '';
}

function fileIssue(code: string, message: string, severity: QualityIssue['severity']): QualityIssue {
  return { code, message, severity, stage: 'Leyendo archivos', userCanOverride: severity !== 'blocking' };
}

function reportFromIssues(issues: QualityIssue[]): FileQualityReport {
  const blocking = issues.filter((issue) => issue.severity === 'blocking');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const suggestions = issues.filter((issue) => issue.severity === 'suggestion');
  const recoverable = issues.filter((issue) => issue.severity === 'recoverable');
  const status: QualityStatus = blocking.length
    ? 'blocked'
    : recoverable.length
      ? 'user_permission_required'
      : warnings.length || suggestions.length
        ? 'approved_with_warnings'
        : 'approved';

  return {
    status,
    score: status === 'blocked' ? 25 : status === 'approved' ? 100 : 82,
    criticalIssues: unique([...blocking, ...recoverable].map((issue) => issue.message), 8),
    warnings: unique(warnings.map((issue) => issue.message), 8),
    suggestions: unique([...suggestions, ...recoverable].map((issue) => issue.suggestion || issue.message), 8),
    userCanOverride: !blocking.length && Boolean(recoverable.length),
    requiresUserInput: status === 'user_permission_required',
    userMessage: status === 'blocked'
      ? 'No podemos procesar uno o mas archivos porque estan vacios, corruptos, no son legibles o tienen un formato no compatible.'
      : status === 'user_permission_required'
        ? 'La informacion cargada puede ser insuficiente. Puedes agregar datos, cambiar documento o continuar bajo tu responsabilidad si aplica.'
        : status === 'approved_with_warnings'
          ? 'Los archivos se pueden procesar, pero se detectaron advertencias que conviene revisar.'
          : 'Los archivos pasaron la validacion inicial.',
  };
}

async function startsWith(file: File, expected: number[]) {
  const buffer = await file.slice(0, expected.length).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return expected.every((byte, index) => bytes[index] === byte);
}

async function readFileText(file: File) {
  if (typeof file.text === 'function') return file.text();
  if (typeof file.arrayBuffer === 'function') return new TextDecoder().decode(await file.arrayBuffer());
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'));
    reader.readAsText(file);
  });
}

async function validateCsv(file: File, issues: QualityIssue[]) {
  const content = await readFileText(file);
  const rows = content
    .split(/\r?\n/)
    .map((row) => row.split(/[,;\t]/).map((cell) => cell.trim()).filter(Boolean))
    .filter((row) => row.length);
  const columnCount = Math.max(0, ...rows.map((row) => row.length));

  if (rows.length < MIN_USEFUL_CSV_ROWS || columnCount < MIN_USEFUL_COLUMNS) {
    issues.push(fileIssue(
      'file-csv-no-useful-data',
      `El archivo "${file.name}" no tiene filas y columnas suficientes para construir un analisis util.`,
      'blocking',
    ));
  }
}

async function validateWorkbook(file: File, issues: QualityIssue[]) {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', sheetRows: 50 });
    if (!workbook.SheetNames.length) {
      issues.push(fileIssue('file-workbook-empty', `El archivo "${file.name}" no contiene hojas utiles.`, 'blocking'));
      return;
    }

    const hasUsefulSheet = workbook.SheetNames.some((sheetName) => {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, blankrows: false });
      const usefulRows = rows.filter((row) => Array.isArray(row) && row.filter((cell) => String(cell ?? '').trim()).length >= 2);
      const usefulColumns = Math.max(0, ...usefulRows.map((row) => row.length));
      return usefulRows.length >= 2 && usefulColumns >= 2;
    });

    if (!hasUsefulSheet) {
      issues.push(fileIssue(
        'file-workbook-no-useful-data',
        `El archivo "${file.name}" no tiene filas y columnas suficientes para el agente.`,
        'blocking',
      ));
    }
  } catch {
    issues.push(fileIssue('file-workbook-corrupt', `El archivo "${file.name}" no se pudo leer como hoja de calculo.`, 'blocking'));
  }
}

async function validateSignature(file: File, issues: QualityIssue[]) {
  const extension = extensionOf(file);
  try {
    if (extension === 'pdf' && !(await startsWith(file, [0x25, 0x50, 0x44, 0x46]))) {
      issues.push(fileIssue('file-pdf-corrupt', `El archivo "${file.name}" no parece ser un PDF valido.`, 'blocking'));
    }
    if ((extension === 'docx' || extension === 'xlsx') && !(await startsWith(file, [0x50, 0x4b]))) {
      issues.push(fileIssue('file-zip-corrupt', `El archivo "${file.name}" no se puede leer con su formato declarado.`, 'blocking'));
    }
    if (extension === 'xls') {
      const isZipWorkbook = await startsWith(file, [0x50, 0x4b]);
      const isOleWorkbook = await startsWith(file, [0xd0, 0xcf, 0x11, 0xe0]);
      if (!isZipWorkbook && !isOleWorkbook) {
        issues.push(fileIssue('file-xls-corrupt', `El archivo "${file.name}" no se puede leer con su formato declarado.`, 'blocking'));
      }
    }
    if (extension === 'png' && !(await startsWith(file, [0x89, 0x50, 0x4e, 0x47]))) {
      issues.push(fileIssue('file-png-corrupt', `El archivo "${file.name}" no parece ser una imagen PNG valida.`, 'blocking'));
    }
    if ((extension === 'jpg' || extension === 'jpeg') && !(await startsWith(file, [0xff, 0xd8, 0xff]))) {
      issues.push(fileIssue('file-jpg-corrupt', `El archivo "${file.name}" no parece ser una imagen JPG valida.`, 'blocking'));
    }
  } catch {
    issues.push(fileIssue('file-unreadable', `El archivo "${file.name}" no se pudo leer.`, 'blocking'));
  }
}

export async function validateFilesBeforeAgentRun(input: FileValidationInput): Promise<FileQualityReport> {
  const issues: QualityIssue[] = [];
  const allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS;
  const maxFiles = input.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileSize = (input.maxFileSizeMb ?? DEFAULT_MAX_FILE_SIZE_MB) * 1024 * 1024;

  if (input.requireFiles && !input.files.length) {
    issues.push(fileIssue('file-required', 'Agrega al menos un archivo para procesar este agente.', 'blocking'));
  }

  if (input.files.length > maxFiles) {
    issues.push(fileIssue('file-too-many', `Puedes subir como maximo ${maxFiles} archivos.`, 'blocking'));
  }

  for (const file of input.files) {
    const extension = extensionOf(file);
    if (!allowedExtensions.includes(extension)) {
      issues.push(fileIssue('file-unsupported-format', `El formato de "${file.name}" no es compatible.`, 'blocking'));
      continue;
    }
    if (file.size <= 0) {
      issues.push(fileIssue('file-empty', `El archivo "${file.name}" esta vacio.`, 'blocking'));
      continue;
    }
    if (file.size > maxFileSize) {
      issues.push(fileIssue('file-too-large', `El archivo "${file.name}" supera el tamano permitido.`, 'blocking'));
      continue;
    }

    await validateSignature(file, issues);
    if (extension === 'csv') await validateCsv(file, issues);
    if (extension === 'xlsx' || extension === 'xls') await validateWorkbook(file, issues);
  }

  return reportFromIssues(issues);
}
