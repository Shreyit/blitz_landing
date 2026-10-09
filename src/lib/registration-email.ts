export const EMAIL_DOMAINS = ["stud.tiss.ac.in", "tiss.edu"] as const;
export type EmailDomain = (typeof EMAIL_DOMAINS)[number];

export function registrationEmail(username: string, domain: EmailDomain): string {
  const local = username.trim().toLowerCase();
  return local ? `${local}@${domain}` : "";
}

// Browser autofill and pasted full addresses use the same two domain choices.
export function emailInput(value: string, currentDomain: EmailDomain) {
  const parts = value.trim().split("@");
  const domain = parts[1]?.toLowerCase();
  if (parts.length === 2 && EMAIL_DOMAINS.some((item) => item === domain)) {
    return { username: parts[0], domain: domain as EmailDomain };
  }
  return { username: value, domain: currentDomain };
}
