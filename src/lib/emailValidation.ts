const TEMPORARY_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '20minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'yopmail.com',
]);

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateRealEmail(value: string) {
  const email = normalizeEmail(value);

  if (!email) {
    return 'El correo es obligatorio';
  }

  if (/\s/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'Ingresa un correo electronico valido';
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || domain.startsWith('.') || domain.endsWith('.') || !domain.includes('.')) {
    return 'Ingresa un correo electronico valido';
  }

  if (TEMPORARY_EMAIL_DOMAINS.has(domain)) {
    return 'No se permiten correos temporales. Usa un correo real.';
  }

  return true;
}
