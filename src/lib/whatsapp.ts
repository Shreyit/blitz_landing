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
const PRIORITY: [string, string, string][] = [
  ["India", "91", "IN"], ["United Arab Emirates", "971", "AE"], ["Saudi Arabia", "966", "SA"], ["Qatar", "974", "QA"],
  ["Oman", "968", "OM"], ["Kuwait", "965", "KW"], ["Bahrain", "973", "BH"], ["United States", "1", "US"],
  ["United Kingdom", "44", "GB"], ["Canada", "1", "CA"], ["Singapore", "65", "SG"], ["Australia", "61", "AU"],
  ["Nepal", "977", "NP"], ["Bangladesh", "880", "BD"], ["Sri Lanka", "94", "LK"], ["Bhutan", "975", "BT"],
];
const OTHERS: [string, string, string][] = [
  ["Afghanistan", "93", "AF"], ["Argentina", "54", "AR"], ["Austria", "43", "AT"], ["Belgium", "32", "BE"],
  ["Brazil", "55", "BR"], ["Brunei", "673", "BN"], ["Cambodia", "855", "KH"], ["China", "86", "CN"], ["Cyprus", "357", "CY"],
  ["Czech Republic", "420", "CZ"], ["Denmark", "45", "DK"], ["Egypt", "20", "EG"], ["Ethiopia", "251", "ET"],
  ["Fiji", "679", "FJ"], ["Finland", "358", "FI"], ["France", "33", "FR"], ["Germany", "49", "DE"], ["Ghana", "233", "GH"],
  ["Greece", "30", "GR"], ["Guyana", "592", "GY"], ["Hong Kong", "852", "HK"], ["Hungary", "36", "HU"],
  ["Indonesia", "62", "ID"], ["Iran", "98", "IR"], ["Iraq", "964", "IQ"], ["Ireland", "353", "IE"], ["Israel", "972", "IL"],
  ["Italy", "39", "IT"], ["Japan", "81", "JP"], ["Jordan", "962", "JO"], ["Kazakhstan", "7", "KZ"], ["Kenya", "254", "KE"],
  ["Kyrgyzstan", "996", "KG"], ["Laos", "856", "LA"], ["Lebanon", "961", "LB"], ["Malaysia", "60", "MY"],
  ["Maldives", "960", "MV"], ["Mauritius", "230", "MU"], ["Mexico", "52", "MX"], ["Mongolia", "976", "MN"],
  ["Morocco", "212", "MA"], ["Mozambique", "258", "MZ"], ["Myanmar", "95", "MM"], ["Netherlands", "31", "NL"],
  ["New Zealand", "64", "NZ"], ["Nigeria", "234", "NG"], ["Norway", "47", "NO"], ["Pakistan", "92", "PK"],
  ["Philippines", "63", "PH"], ["Poland", "48", "PL"], ["Portugal", "351", "PT"], ["Romania", "40", "RO"],
  ["Russia", "7", "RU"], ["Rwanda", "250", "RW"], ["Seychelles", "248", "SC"], ["South Africa", "27", "ZA"],
  ["South Korea", "82", "KR"], ["Spain", "34", "ES"], ["Suriname", "597", "SR"], ["Sweden", "46", "SE"],
  ["Switzerland", "41", "CH"], ["Taiwan", "886", "TW"], ["Tajikistan", "992", "TJ"], ["Tanzania", "255", "TZ"],
  ["Thailand", "66", "TH"], ["Trinidad and Tobago", "1", "TT"], ["Turkey", "90", "TR"], ["Uganda", "256", "UG"],
  ["Ukraine", "380", "UA"], ["Uzbekistan", "998", "UZ"], ["Vietnam", "84", "VN"], ["Yemen", "967", "YE"],
  ["Zambia", "260", "ZM"], ["Zimbabwe", "263", "ZW"],
];
/** "IN" → 🇮🇳 using regional indicator symbols. */
const flag = (iso: string) => String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0)));
export const WHATSAPP_COUNTRIES = [...PRIORITY, ...OTHERS].map(([name, code, iso]) => ({ name, code, flag: flag(iso) }));
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
