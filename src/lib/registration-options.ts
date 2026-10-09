import options from "../../shared/registration-options.json";

export const VOLUNTEER_DEPARTMENTS = options.volunteerDepartments;
export const GENDERS = options.genders;
export const REGIONS = options.regions;

export const DEPARTMENT_DESCRIPTIONS: Record<string, string> = {
  "Digital & Marketing": "Content, design, photography, and spreading the word.",
  Operations: "Set-up, scheduling, logistics, and keeping the event moving.",
  Medical: "Support the medical team and help coordinate participant care.",
  Sustainability: "Waste reduction, responsible resources, and a cleaner campus.",
};

export function genderLabel(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}
