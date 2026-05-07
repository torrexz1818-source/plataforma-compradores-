import { useMutation } from '@tanstack/react-query';

import {
  createTermsFormSchema,
  downloadTermsPdf,
  generateTermsOfReference,
  type GenerateTermsPayload,
  type TermsResult,
} from './termsOfReferenceApi';

export function useTermsFormSchema() {
  return useMutation({
    mutationFn: (initialDescription: string) => createTermsFormSchema(initialDescription),
  });
}

export function useGenerateTermsOfReference() {
  return useMutation({
    mutationFn: (payload: GenerateTermsPayload) => generateTermsOfReference(payload),
  });
}

export function useDownloadTermsPdf() {
  return useMutation({
    mutationFn: (document: TermsResult) => downloadTermsPdf(document),
  });
}
