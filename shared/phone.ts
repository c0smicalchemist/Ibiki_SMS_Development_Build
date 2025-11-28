export function strip(input: string): { raw: string; hadPlus: boolean } {
  const trimmed = String(input || '').trim();
  const hadPlus = /^\+/.test(trimmed);
  const digits = trimmed.replace(/[^0-9]/g, '');
  return { raw: digits, hadPlus };
}

export function coerceInternationalPrefix(digits: string, original: string): { prefixed: boolean; value: string } {
  const s = original.trim();
  if (/^00/.test(s)) return { prefixed: true, value: s.replace(/^00+/, '+') };
  if (/^011/.test(s)) return { prefixed: true, value: s.replace(/^011+/, '+') };
  return { prefixed: false, value: s };
}

export function isValidE164(e: string): boolean {
  return /^\+[1-9][0-9]{7,14}$/.test(e);
}

export function normalizePhone(input: string, defaultDial: string = '+1'): string | null {
  if (!input) return null;
  const coerced = coerceInternationalPrefix(input.replace(/\s+/g, ''), input);
  const s = coerced.value;
  if (s.startsWith('+')) {
    const e = '+' + s.replace(/[^0-9]/g, '');
    return isValidE164(e) ? e : null;
  }

  const { raw } = strip(s);
  const def = String(defaultDial || '+1');
  const defDigits = def.replace(/[^0-9]/g, '');

  if (raw.length === 0) return null;

  if (raw.startsWith(defDigits)) {
    const e = '+' + raw;
    return isValidE164(e) ? e : null;
  }

  if (raw.length >= 6 && raw.length <= 15) {
    const e = '+' + defDigits + raw;
    return isValidE164(e) ? e : null;
  }
  return null;
}

export function normalizeMany(inputs: string[], defaultDial: string = '+1'): { ok: string[]; invalid: string[] } {
  const okSet = new Set<string>();
  const invalid: string[] = [];
  for (const item of inputs || []) {
    const n = normalizePhone(item, defaultDial);
    if (n) okSet.add(n); else invalid.push(item);
  }
  return { ok: Array.from(okSet), invalid };
}
