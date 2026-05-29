import { ArrowLeft, Download, FileText, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { DeliverableQualityReport } from '@/lib/deliverableQuality';

type QualityPermissionDialogProps = {
  open: boolean;
  report: DeliverableQualityReport | null;
  manualDraft: string;
  showManualForm: boolean;
  onOpenChange: (open: boolean) => void;
  onManualDraftChange: (value: string) => void;
  onToggleManualForm: (show: boolean) => void;
  onApplyManualInput: () => void;
  onChangeDocument: () => void;
  onDownloadTemplate: () => void;
  onCancelProcess: () => void;
  onConfirmOverride: () => void;
};

export function QualityPermissionDialog({
  open,
  report,
  manualDraft,
  showManualForm,
  onOpenChange,
  onManualDraftChange,
  onToggleManualForm,
  onApplyManualInput,
  onChangeDocument,
  onDownloadTemplate,
  onCancelProcess,
  onConfirmOverride,
}: QualityPermissionDialogProps) {
  const issues = report
    ? (report.criticalIssues.length ? report.criticalIssues : report.warnings).slice(0, 6)
    : [];
  const isBlocked = report?.status === 'blocked';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Antes de continuar</DialogTitle>
          <DialogDescription>
            {isBlocked
              ? 'No se puede generar un entregable confiable con la informacion actual. Cambia el documento o agrega informacion minima y vuelve a procesar.'
              : 'Detectamos que la informacion cargada puede no ser suficiente para generar un entregable completamente profesional.'}
          </DialogDescription>
        </DialogHeader>

        {report ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Problemas detectados</p>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900/80">
                {issues.map((issue) => (
                  <li key={issue}>- {issue}</li>
                ))}
              </ul>
            </div>

            {showManualForm ? (
              <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-4">
                <label className="text-sm font-medium text-foreground">Agregar nota o contexto adicional</label>
                <Textarea
                  value={manualDraft}
                  onChange={(event) => onManualDraftChange(event.target.value)}
                  placeholder="Ejemplo: proveedor, precio, plazo, condiciones comerciales, criterios de evaluacion, responsables, horizonte de analisis o supuestos relevantes."
                  className="min-h-[120px] rounded-2xl border-primary/15 bg-white"
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Esta informacion se incluira como consideracion del entregable, pero no recalcula automaticamente el modelo. Para recalcular, vuelve a ejecutar el agente con el dato agregado en el formulario principal.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" className="rounded-full bg-white" onClick={() => onToggleManualForm(false)}>
                    Volver
                  </Button>
                  <Button type="button" className="rounded-full bg-primary hover:bg-primary" onClick={onApplyManualInput}>
                    Guardar informacion
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start rounded-xl bg-white"
                  onClick={isBlocked ? onChangeDocument : () => onToggleManualForm(true)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {isBlocked ? 'Agregar informacion minima' : 'Agregar nota o contexto adicional'}
                </Button>
                <Button type="button" variant="outline" className="justify-start rounded-xl bg-white" onClick={onChangeDocument}>
                  <Upload className="mr-2 h-4 w-4" />
                  Cambiar documento
                </Button>
                <Button type="button" variant="outline" className="justify-start rounded-xl bg-white" onClick={onDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar plantilla base
                </Button>
                <Button type="button" variant="outline" className="justify-start rounded-xl bg-white" onClick={onCancelProcess}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            )}

            {!showManualForm ? (
              <div className="rounded-xl border border-primary/10 bg-white p-4 text-xs leading-5 text-muted-foreground">
                {isBlocked ? (
                  <p>Este caso no permite continuar bajo responsabilidad porque podria generar un resultado falso o enganoso.</p>
                ) : (
                  <p>
                    Al continuar bajo responsabilidad, confirmas: "Entiendo que el archivo se generara con la informacion disponible y que puede no alcanzar la maxima calidad posible por falta de datos complementarios."
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            type="button"
            className="rounded-full bg-primary hover:bg-primary"
            onClick={onConfirmOverride}
            disabled={!report?.userCanOverride || showManualForm}
          >
            Continuar bajo mi responsabilidad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
