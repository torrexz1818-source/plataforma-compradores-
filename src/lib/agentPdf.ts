import jsPDF from 'jspdf';

function formatValue(value: unknown, depth = 0): string[] {
  const prefix = depth > 0 ? '  '.repeat(depth) : '';

  if (value === null || value === undefined) {
    return [`${prefix}No especificado`];
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      return [`${prefix}Sin datos`];
    }

    return value.flatMap((item) => {
      if (typeof item === 'object' && item !== null) {
        return formatValue(item, depth + 1);
      }
      return [`${prefix}- ${String(item)}`];
    });
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      if (typeof item === 'object' && item !== null) {
        return [`${prefix}${key}:`, ...formatValue(item, depth + 1)];
      }

      return [`${prefix}${key}: ${String(item ?? 'No especificado')}`];
    });
  }

  return [`${prefix}${String(value)}`];
}

export function downloadAgentResultPdf(input: {
  title: string;
  userName?: string;
  result: unknown;
  fileName?: string;
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = 18;

  const addLine = (text: string, size = 10, isBold = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth);

    lines.forEach((line: string) => {
      if (y > pageHeight - 18) {
        doc.addPage();
        y = 18;
      }

      doc.text(line, marginX, y);
      y += size >= 14 ? 7 : 5.5;
    });
  };

  addLine(input.title, 16, true);
  addLine(`Usuario: ${input.userName || 'No especificado'}`, 10);
  addLine(`Fecha: ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, 10);
  y += 3;

  formatValue(input.result).forEach((line) => addLine(line, 9));

  doc.save(input.fileName ?? 'resultado-nodus-ia.pdf');
}
