import options from '../../shared/registration-options.json' with { type: 'json' };
import { SPORTS } from './event.ts';
import { normaliseWhatsapp } from './whatsapp.ts';

export class InputError extends Error {
  status: number;
  constructor(message: string, status = 422) { super(message); this.status=status; }
}

export function registrationData(form: FormData) {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value.trim() : '';
  };
  const name = text('name'), email = text('email').toLowerCase(), role = text('role');
  if (name.length < 2 || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) throw new InputError('Enter a valid full name.');
  if (email.length > 200 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(stud\.tiss\.ac\.in|stud\.tiss\.edu)$/.test(email))
    throw new InputError('Use an @stud.tiss.ac.in or @stud.tiss.edu email address.');
  if (!['player', 'volunteer'].includes(role)) throw new InputError('Choose Player or Volunteer.');
  const whatsapp = normaliseWhatsapp(text('whatsapp'));
  if (!whatsapp) throw new InputError('Enter a valid WhatsApp number, for example 98765 43210.');
  const programme = text('programme');
  if (!['BSASS', 'BSW'].includes(programme)) throw new InputError('Choose a valid programme.');
  const year = Number(text('year')), age = Number(text('age'));
  if (!Number.isInteger(year) || year < 1 || year > 4) throw new InputError('Choose a valid programme year.');
  if (!Number.isInteger(age) || age < 1 || age > 120) throw new InputError('Enter your age in whole years, from 1 to 120.');
  const gender = text('gender'), region = text('region');
  if (!options.genders.includes(gender)) throw new InputError('Select your gender.');
  if (!options.regions.includes(region)) throw new InputError('Select a valid Indian state or union territory.');
  if (!['yes','no'].includes(text('played_before'))) throw new InputError('Tell us whether you have played Bachelor’s BLITZ before.');
  if (text('consent') !== 'true') throw new InputError('Consent is required to register.');
  let sports: unknown;
  try { sports = JSON.parse(text('sports') || '[]'); } catch { throw new InputError('Choose valid sports.'); }
  if (!Array.isArray(sports) || sports.some(s => !(SPORTS as readonly unknown[]).includes(s)) ||
    new Set(sports).size !== sports.length || (role === 'player' && sports.length === 0))
    throw new InputError('Choose valid, distinct sports.');
  const department = text('volunteer_department'), rationale = text('volunteer_rationale');
  if (role === 'volunteer') {
    if (sports.length || !options.volunteerDepartments.includes(department)) throw new InputError('Choose exactly one volunteer department instead of sports.');
    if (!rationale || rationale.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(rationale))
      throw new InputError('Explain your suitability and contribution in up to 2,000 characters.');
  } else if (department || rationale) throw new InputError('Volunteer details belong in a separate volunteer registration.');
  return { name, email, whatsapp, role, programme, year, age, gender, region,
    played_before: text('played_before') === 'yes', sports: sports as string[],
    volunteer_department: department || null, volunteer_rationale: rationale || null, consent: true };
}
