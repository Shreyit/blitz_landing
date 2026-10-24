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

/** Calling codes for the WhatsApp country picker. India first, then common NRI homes, then A–Z. */
const PRIORITY: [string, string][] = [
  ["India", "91"], ["United Arab Emirates", "971"], ["Saudi Arabia", "966"], ["Qatar", "974"],
  ["Oman", "968"], ["Kuwait", "965"], ["Bahrain", "973"], ["United States", "1"],
  ["United Kingdom", "44"], ["Canada", "1"], ["Singapore", "65"], ["Australia", "61"],
  ["Nepal", "977"], ["Bangladesh", "880"], ["Sri Lanka", "94"], ["Bhutan", "975"],
];
const OTHERS: [string, string][] = [
  ["Afghanistan", "93"], ["Argentina", "54"], ["Austria", "43"], ["Belgium", "32"],
  ["Brazil", "55"], ["Brunei", "673"], ["Cambodia", "855"], ["China", "86"], ["Cyprus", "357"],
  ["Czech Republic", "420"], ["Denmark", "45"], ["Egypt", "20"], ["Ethiopia", "251"],
  ["Fiji", "679"], ["Finland", "358"], ["France", "33"], ["Germany", "49"], ["Ghana", "233"],
  ["Greece", "30"], ["Guyana", "592"], ["Hong Kong", "852"], ["Hungary", "36"],
  ["Indonesia", "62"], ["Iran", "98"], ["Iraq", "964"], ["Ireland", "353"], ["Israel", "972"],
  ["Italy", "39"], ["Japan", "81"], ["Jordan", "962"], ["Kazakhstan", "7"], ["Kenya", "254"],
  ["Kyrgyzstan", "996"], ["Laos", "856"], ["Lebanon", "961"], ["Malaysia", "60"],
  ["Maldives", "960"], ["Mauritius", "230"], ["Mexico", "52"], ["Mongolia", "976"],
  ["Morocco", "212"], ["Mozambique", "258"], ["Myanmar", "95"], ["Netherlands", "31"],
  ["New Zealand", "64"], ["Nigeria", "234"], ["Norway", "47"], ["Pakistan", "92"],
  ["Philippines", "63"], ["Poland", "48"], ["Portugal", "351"], ["Romania", "40"],
  ["Russia", "7"], ["Rwanda", "250"], ["Seychelles", "248"], ["South Africa", "27"],
  ["South Korea", "82"], ["Spain", "34"], ["Suriname", "597"], ["Sweden", "46"],
  ["Switzerland", "41"], ["Taiwan", "886"], ["Tajikistan", "992"], ["Tanzania", "255"],
  ["Thailand", "66"], ["Trinidad and Tobago", "1"], ["Turkey", "90"], ["Uganda", "256"],
  ["Ukraine", "380"], ["Uzbekistan", "998"], ["Vietnam", "84"], ["Yemen", "967"],
  ["Zambia", "260"], ["Zimbabwe", "263"],
];
export const WHATSAPP_COUNTRIES = [...PRIORITY, ...OTHERS].map(([name, code]) => ({ name, code }));
export const DEFAULT_WHATSAPP_COUNTRY = "India";

/** Combine the picker's calling code with the typed number. A typed "+…" number wins. */
export function whatsappFromParts(country: string, local: string): string | null {
  const typed = local.trim();
  if (typed.startsWith("+")) return normaliseWhatsapp(typed);
  const code = WHATSAPP_COUNTRIES.find((c) => c.name === country)?.code;
  if (!code) return null;
  const digits = typed.replace(/[\s().-]/g, "").replace(/^0+/, "");
  if (!/^\d+$/.test(digits)) return null;
  // People often type the code again ("91 98765 43210"); accept it once.
  const national = code === "91" && /^91[6-9]\d{9}$/.test(digits) ? digits.slice(2) : digits;
  return normaliseWhatsapp("+" + code + national);
}
