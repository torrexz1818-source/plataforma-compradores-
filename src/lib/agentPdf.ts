import jsPDF from 'jspdf';
import type { AgentPdfMode, AgentPdfOptions } from '@/types';

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown, depth = 0): string[] {
  const prefix = depth > 0 ? '  '.repeat(depth) : '';

  if (value === null || value === undefined) return [`${prefix}No especificado`];
  if (Array.isArray(value)) {
    if (!value.length) return [`${prefix}Sin datos`];
    return value.flatMap((item) => (typeof item === 'object' && item !== null ? formatValue(item, depth + 1) : [`${prefix}- ${String(item)}`]));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      if (typeof item === 'object' && item !== null) return [`${prefix}${formatLabel(key)}:`, ...formatValue(item, depth + 1)];
      return [`${prefix}${formatLabel(key)}: ${String(item ?? 'No especificado')}`];
    });
  }

  return [`${prefix}${String(value)}`];
}

function getFooter(mode: AgentPdfMode, options?: AgentPdfOptions) {
  if (mode === 'standard_branded') return 'Generado por Buyer Nodus - Nodus IA';
  if (mode === 'custom_brand') return options?.branding.footerText || `Generado para ${options?.branding.companyName || 'tu empresa'}`;
  return 'Documento generado por asistente de inteligencia artificial';
}

export function downloadAgentResultPdf(input: {
  title: string;
  agentName?: string;
  userName?: string;
  result: unknown;
  fileName?: string;
  pdfMode?: AgentPdfMode;
  pdfOptions?: AgentPdfOptions;
}) {
  const mode = input.pdfMode ?? 'standard_branded';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  const primaryColor = input.pdfOptions?.branding.primaryColor || '#1d4ed8';
  let y = 18;

  const addFooter = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#64748b');
    doc.text(getFooter(mode, input.pdfOptions), marginX, pageHeight - 9);
    doc.text(String(doc.getNumberOfPages()), pageWidth - marginX, pageHeight - 9, { align: 'right' });
  };

  const ensurePage = (extra = 10) => {
    if (y > pageHeight - 18 - extra) {
      addFooter();
      doc.addPage();
      y = 18;
    }
  };

  const addLine = (text: string, size = 9.5, isBold = false, color = '#111827') => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
      ensurePage(size >= 13 ? 12 : 7);
      doc.text(line, marginX, y);
      y += size >= 13 ? 7 : 5.2;
    });
  };

  if (mode === 'standard_branded') {
    addLine('Buyer Nodus - Nodus IA', 9, true, primaryColor);
  } else if (mode === 'custom_brand') {
    addLine(input.pdfOptions?.branding.companyName || 'Documento corporativo', 9, true, primaryColor);
  }
  addLine(input.title, 18, true);
  addLine(`Agente: ${input.agentName || input.title}`, 9.5, false, '#475569');
  addLine(`Fecha: ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, 9.5, false, '#475569');
  addLine(`Usuario/empresa: ${input.userName || input.pdfOptions?.branding.companyName || 'No especificado'}`, 9.5, false, '#475569');
  y += 4;

  const result = input.result as Record<string, unknown>;
  const summary = result?.executive_summary ?? result?.summary ?? result?.final_recommendation;
  if (summary) {
    doc.setFillColor('#eef2ff');
    doc.roundedRect(marginX, y - 3, maxWidth, 18, 2, 2, 'F');
    y += 2;
    addLine('Resumen ejecutivo', 11, true, primaryColor);
    formatValue(summary).slice(0, 5).forEach((line) => addLine(line, 9.2));
    y += 5;
  }

  Object.entries(result ?? {}).forEach(([key, value]) => {
    if (['executive_summary', 'summary'].includes(key)) return;
    ensurePage(16);
    addLine(formatLabel(key), 11.5, true, primaryColor);
    formatValue(value).forEach((line) => addLine(line, 8.8));
    y += 2;
  });

  y += 4;
  addLine('Disclaimer', 10, true, primaryColor);
  addLine('Documento generado por Nodus IA como apoyo a decisiones de compra. Validar datos criticos antes de tomar decisiones finales.', 8.5, false, '#64748b');
  addFooter();

  doc.save(input.fileName ?? 'resultado-nodus-ia.pdf');
}
