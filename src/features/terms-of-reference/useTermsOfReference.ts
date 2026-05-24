import { useMutation } from '@tanstack/react-query';

import {
  createTermsFormSchema,
  generateTermsOfReference,
  type GenerateTermsPayload,
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
