/**
 * Normalise a WhatsApp number to E.164 (+919876543210). Bare 10-digit numbers,
 * 0-prefixed numbers and 91-prefixed numbers are treated as Indian mobiles.
 * Returns null when the input is not a plausible number.
 */
export function normaliseWhatsapp(input: string): string | null {
  const raw = input.trim().replace(/[\s().-]/g, "");
  if (!raw) return null;
  let digits: string;
  if (raw.startsWith("+")) digits = raw.slice(1);
  else if (/^0\d{10}$/.test(raw)) digits = "91" + raw.slice(1);
  else if (/^\d{10}$/.test(raw)) digits = "91" + raw;
  else digits = raw;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (digits.startsWith("91") && !/^91[6-9]\d{9}$/.test(digits)) return null;
  return "+" + digits;
}

/** +919876543210 → +91 98765 43210, for display only. */
export function formatWhatsapp(value: string | null | undefined): string {
  if (!value) return "Not provided";
  const indian = /^\+91(\d{5})(\d{5})$/.exec(value);
  return indian ? `+91 ${indian[1]} ${indian[2]}` : value;
}
