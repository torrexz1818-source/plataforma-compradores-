import type {
  QualityGateOptions,
  QualityIssue,
  QualityStatus,
  QualityUserPermission,
} from './qualityTypes';
import { unique } from './qualityUtils';

type PolicyInput = {
  issues: QualityIssue[];
  options?: QualityGateOptions;
  stats?: {
    placeholdersRemoved: number;
    internalMentionsRemoved: number;
  };
};

function hasManualInput(options?: QualityGateOptions) {
  const text = options?.manualQualityInput?.text?.trim();
  const fields = Object.values(options?.manualQualityInput?.fields ?? {}).filter((value) => value.trim());
  return Boolean(text || fields.length);
}

function accepted(permission?: QualityUserPermission) {
  return Boolean(permission?.accepted);
}

export function resolveUserPermissionPolicy(input: PolicyInput) {
  const blocking = input.issues.filter((issue) => issue.severity === 'blocking');
  const recoverable = input.issues.filter((issue) => issue.severity === 'recoverable');
  const warnings = input.issues.filter((issue) => issue.severity === 'warning');
  const suggestions = input.issues.filter((issue) => issue.severity === 'suggestion');
  const manualInput = hasManualInput(input.options);
  const permissionAccepted = accepted(input.options?.qualityPermission);
  const userCanOverride = !blocking.length && recoverable.every((issue) => issue.userCanOverride !== false);

  let status: QualityStatus = 'approved';
  if (blocking.length) {
    status = 'blocked';
  } else if (recoverable.length && !permissionAccepted && !manualInput) {
    status = 'user_permission_required';
  } else if (
    recoverable.length ||
    warnings.length ||
    suggestions.length ||
    permissionAccepted ||
    manualInput
  ) {
    status = 'approved_with_warnings';
  }

  const criticalIssues = unique([...blocking, ...recoverable].map((issue) => issue.message), 8);
  const warningMessages = unique(warnings.map((issue) => issue.message), 8);
  const suggestionMessages = unique(
    [...suggestions, ...recoverable]
      .map((issue) => issue.suggestion || issue.message)
      .filter(Boolean),
    8,
  );
  const penalty =
    blocking.length * 28 +
    recoverable.length * 14 +
    warnings.length * 7 +
    Math.min(input.stats?.placeholdersRemoved ?? 0, 18) +
    Math.min(input.stats?.internalMentionsRemoved ?? 0, 12);
  const score = status === 'blocked'
    ? Math.min(59, Math.max(20, 100 - penalty))
    : status === 'user_permission_required'
      ? Math.min(79, Math.max(55, 100 - penalty))
      : status === 'approved_with_warnings'
        ? Math.min(89, Math.max(70, 100 - penalty))
        : Math.max(90, 100 - penalty);

  const userMessage = status === 'approved'
    ? 'Tu entregable paso la revision de calidad y esta listo para descargar.'
    : status === 'approved_with_warnings'
      ? 'Tu entregable puede generarse con la informacion disponible. Se incluiran consideraciones ejecutivas cuando existan limitaciones.'
      : status === 'user_permission_required'
        ? 'Detectamos informacion insuficiente o recuperable. Puedes agregar datos, cambiar documento o continuar bajo tu responsabilidad si esta permitido.'
        : 'No se puede generar un entregable confiable con la informacion actual. Cambia el documento o agrega informacion minima.';

  return {
    status,
    score,
    criticalIssues,
    warnings: warningMessages,
    suggestions: suggestionMessages,
    userCanOverride,
    requiresUserInput: status === 'user_permission_required',
    userMessage,
  };
}
