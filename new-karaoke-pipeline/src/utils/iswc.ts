export function normalizeISWC(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  // Remove spaces, hyphens, dots, and any other non-alphanumeric characters
  const cleaned = upper.replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return null;

  // If the first character is a digit, assume a missing prefix (default to 'T')
  if (/^\d{10}$/.test(cleaned)) {
    return `T${cleaned}`;
  }

  const prefix = cleaned[0];
  const digits = cleaned.slice(1).replace(/[^0-9]/g, '');

  if (!/[A-Z]/.test(prefix)) {
    // Unexpected format; return full cleaned string to avoid data loss
    return cleaned;
  }

  if (digits.length === 0) {
    return prefix;
  }

  if (digits.length === 9) {
    // Some sources omit the leading zero before the registrant code
    return `${prefix}0${digits}`;
  }

  if (digits.length >= 10) {
    return `${prefix}${digits.slice(0, 10)}`;
  }

  // For any other unexpected length, return what we have to surface discrepancies
  return `${prefix}${digits}`;
}
