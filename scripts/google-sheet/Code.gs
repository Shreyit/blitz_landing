/** @OnlyCurrentDoc */

/**
 * Bachelor's BLITZ: live registrations sheet for the core organising team.
 *
 * Paste this whole file into Extensions → Apps Script in your Google Sheet.
 * Setup steps are in docs/GOOGLE_SHEET.md. The secret token is stored in
 * Project Settings → Script properties as BLITZ_SHEETS_TOKEN, never in this file.
 */

const SITE = 'https://blitz-landing-theta.vercel.app';
const REFRESH_MINUTES = 10; // Google allows 1, 5, 10, 15 or 30.

const YEARS = { 1: '1st year', 2: '2nd year', 3: '3rd year', 4: '4th year' };
const GENDERS = { male: 'Male', female: 'Female', others: 'Others' };

/** Adds a "BLITZ" menu so anyone with edit access can refresh by hand. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('BLITZ')
    .addItem('Refresh now', 'refreshBlitz')
    .addItem(`Turn on auto-refresh (every ${REFRESH_MINUTES} min)`, 'turnOnAutoRefresh')
    .addToUi();
}

/** Run once: refreshes now, then every REFRESH_MINUTES minutes. Safe to run again. */
function turnOnAutoRefresh() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'refreshBlitz')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshBlitz').timeBased().everyMinutes(REFRESH_MINUTES).create();
  refreshBlitz();
}

function refreshBlitz() {
  const token = PropertiesService.getScriptProperties().getProperty('BLITZ_SHEETS_TOKEN');
  if (!token) throw new Error('Add the BLITZ_SHEETS_TOKEN script property first (see docs/GOOGLE_SHEET.md).');
  const response = UrlFetchApp.fetch(`${SITE}/api/sheets/registrations`, {
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  if (status === 401) throw new Error('The token is wrong. Copy SHEETS_EXPORT_TOKEN from Vercel again.');
  if (status === 404) throw new Error('The website has no SHEETS_EXPORT_TOKEN yet, or it was not redeployed after adding it.');
  if (status !== 200) throw new Error(`The website answered ${status}: ${response.getContentText().slice(0, 200)}`);

  const data = JSON.parse(response.getContentText());
  const rows = data.rows || [];
  const book = SpreadsheetApp.getActive();
  book.setSpreadsheetTimeZone('Asia/Kolkata');

  const players = rows.filter((r) => r.role === 'player');
  const volunteers = rows.filter((r) => r.role === 'volunteer');

  writeTable(book, 'Players', [
    'Registered', 'Name', 'Email', 'WhatsApp', 'Programme', 'Year', 'Age', 'Gender',
    'Home state / UT', 'Played BLITZ before', 'Sports', 'Team', 'Price (₹)', 'How assigned',
  ], players.map((r) => [
    when(r.created_at), r.name, r.email, r.whatsapp || 'Not provided', r.programme, YEARS[r.year] || r.year,
    r.age, GENDERS[r.gender] || r.gender, r.region, yesNo(r.played_before), (r.sports || []).join(', '),
    r.team || '', r.price == null ? '' : r.price,
    r.assignment === 'auction' ? 'Auction' : r.assignment === 'random' ? 'Random allocation' : '',
  ]));

  writeTable(book, 'Volunteers', [
    'Registered', 'Name', 'Email', 'WhatsApp', 'Programme', 'Year', 'Age', 'Gender',
    'Home state / UT', 'Played BLITZ before', 'Department', 'Why they are suitable',
  ], volunteers.map((r) => [
    when(r.created_at), r.name, r.email, r.whatsapp || 'Not provided', r.programme, YEARS[r.year] || r.year,
    r.age, GENDERS[r.gender] || r.gender, r.region, yesNo(r.played_before), r.volunteer_department,
    r.volunteer_rationale,
  ]));

  writeSummary(book, data, players, volunteers);
}

function writeSummary(book, data, players, volunteers) {
  const sheet = sheetNamed(book, 'Summary', 0);
  sheet.clear();
  const out = [];
  const sectionRows = [];
  const section = (title) => { out.push([title, '']); sectionRows.push(out.length); };
  const count = (list, key) => {
    const tally = {};
    list.forEach((r) => [].concat(key(r)).forEach((k) => { if (k) tally[k] = (tally[k] || 0) + 1; }));
    return Object.keys(tally).sort((a, b) => tally[b] - tally[a]).map((k) => [k, tally[k]]);
  };

  out.push(['Bachelor’s BLITZ registrations', '']);
  out.push(['Last updated', new Date()]);
  out.push(['Auction status', { idle: 'Not started', active: 'Running', allocation: 'Final allocation', complete: 'Complete' }[data.auction_phase] || data.auction_phase]);
  out.push(['', '']);
  section('Totals');
  out.push(['All registrations', players.length + volunteers.length]);
  out.push(['Players', players.length]);
  out.push(['Volunteers', volunteers.length]);
  out.push(['Players assigned to a team', players.filter((r) => r.team).length]);
  out.push(['', '']);
  section('Players per sport');
  count(players, (r) => r.sports || []).forEach((row) => out.push(row));
  out.push(['', '']);
  section('Players by programme and year');
  count(players, (r) => `${r.programme} · ${YEARS[r.year] || r.year}`).forEach((row) => out.push(row));
  out.push(['', '']);
  section('Players by gender');
  count(players, (r) => GENDERS[r.gender] || r.gender).forEach((row) => out.push(row));
  out.push(['', '']);
  section('Volunteers by department');
  count(volunteers, (r) => r.volunteer_department).forEach((row) => out.push(row));
  out.push(['', '']);
  section('Sign-ups per day');
  const days = {};
  players.concat(volunteers).forEach((r) => {
    const day = Utilities.formatDate(new Date(r.created_at), 'Asia/Kolkata', 'yyyy-MM-dd (EEE)');
    days[day] = (days[day] || 0) + 1;
  });
  Object.keys(days).sort().reverse().forEach((day) => out.push([day, days[day]]));

  sheet.getRange(1, 1, out.length, 2).setValues(out.map((r) => r.map(safe)));
  sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');
  sheet.getRange(2, 2).setNumberFormat('d mmm yyyy, h:mm am/pm').setHorizontalAlignment('left');
  sectionRows.forEach((row) => sheet.getRange(row, 1, 1, 2).setFontWeight('bold').setBackground('#d9f46b'));
  sheet.setColumnWidth(1, 300);
  sheet.setColumnWidth(2, 180);
}

function writeTable(book, name, header, rows) {
  const sheet = sheetNamed(book, name);
  sheet.clear();
  if (sheet.getFilter()) sheet.getFilter().remove();
  const values = [header].concat(rows).map((r) => r.map(safe));
  const range = sheet.getRange(1, 1, values.length, header.length);
  range.setValues(values);
  if (rows.length) sheet.getRange(2, 1, rows.length, 1).setNumberFormat('d mmm yyyy, h:mm am/pm');
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#315a36').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  range.createFilter();
  sheet.autoResizeColumns(1, header.length);
}

function sheetNamed(book, name, index) {
  return book.getSheetByName(name) || book.insertSheet(name, index === undefined ? book.getSheets().length : index);
}

/** Text that starts with = + - @ would run as a formula; store it as plain text. */
function safe(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function when(iso) {
  return iso ? new Date(iso) : '';
}

function yesNo(value) {
  return value === true ? 'Yes' : value === false ? 'No' : '';
}
