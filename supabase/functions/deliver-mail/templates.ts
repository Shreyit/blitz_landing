import { EMAIL_ART } from './email-art.ts';

export type InlineImage = {filename:string;contentType:string;content:string;encoding:'base64';cid:string};
export type RenderedMail = {subject:string;text:string;html?:string;attachments?:InlineImage[]};
type Job = {subject:string;body:string;template?:string;data?:unknown};
const escape = (value:unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const label = (value:string) => value ? value[0].toUpperCase()+value.slice(1) : '';
const SPORT_LABELS:Record<string,string> = {Weightlifting:'Power lifting','Table tennis':'Table Tennis','Tug of war':'Tug of War'};
const sportLabel = (value:string) => SPORT_LABELS[value] || value;
const money = (value:number) => `₹${value.toLocaleString('en-IN')}`;
function website(value:unknown) {
  try { const url=new URL(String(value)); if(['http:','https:'].includes(url.protocol) && !url.username && !url.password) return url.origin; } catch { /* Use the configured public deployment below. */ }
  return 'https://blitz-landing-theta.vercel.app';
}
function details(rows:[string,unknown][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows.map(([key,value])=>`<tr><td width="37%" valign="top" style="padding:12px 8px 12px 0;border-bottom:1px solid #e5e9dd;font:12px/1.6 Arial,sans-serif;color:#6b7468">${escape(key)}</td><td valign="top" style="padding:12px 0;border-bottom:1px solid #e5e9dd;font:14px/1.6 Arial,sans-serif;color:#202820;overflow-wrap:anywhere;word-break:break-word">${escape(value)}</td></tr>`).join('')}</table>`;
}
function sectionTitle(value:string) { return `<p style="margin:28px 0 12px;font:700 11px/1.5 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#315a36">${escape(value)}</p>`; }
function sports(values:string[]) {
  return `<div style="margin:0 0 8px">${values.map(sport=>`<span style="display:inline-block;margin:0 6px 8px 0;padding:10px 15px;border:1px solid #dce4cd;border-radius:8px;background:#edf2e4;color:#315a36;font:700 13px/1.4 Arial,sans-serif">${escape(sportLabel(sport))}</span>`).join('')}</div>`;
}
function layout({preheader,kicker,title,intro,content,art,link,linkLabel,reference}:{preheader:string;kicker:string;title:string;intro:string;content:string;art:'registration'|'assignment';link:string;linkLabel:string;reference:string}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Bachelor’s BLITZ</title><style>@media only screen and (max-width:480px){.mail-pad{padding-left:22px!important;padding-right:22px!important}.mail-title{font-size:38px!important}.mail-wrap{width:100%!important}.mail-outside{padding:12px 8px!important}}</style></head><body style="margin:0;padding:0;background:#eef1e8;color:#202820;-webkit-text-size-adjust:100%"><div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1e8"><tr><td class="mail-outside" align="center" style="padding:36px 16px"><table class="mail-wrap" role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#f9faf5;border:1px solid #dce3d3;border-radius:20px;overflow:hidden">
<tr><td class="mail-pad" style="padding:28px 38px;border-bottom:1px solid #e3e8da"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td><span style="display:block;font:700 10px/1.4 Arial,sans-serif;letter-spacing:1px;color:#315a36">Bachelor’s</span><span style="font:900 35px/1 Arial Black,Arial,sans-serif;letter-spacing:-2px;color:#202820">BLITZ<span style="color:#537a43">.</span></span></td><td align="right" style="font:700 10px/1.5 Arial,sans-serif;letter-spacing:1px;color:#6b7468">YOUR CAMPUS.<br>YOUR GAME.</td></tr></table></td></tr>
<tr><td class="mail-pad" style="padding:32px 38px 22px"><span style="display:inline-block;background:#d9f46b;border-radius:30px;padding:8px 12px;font:700 10px/1.3 Arial,sans-serif;letter-spacing:1.3px;color:#25462b">${escape(kicker)}</span><h1 class="mail-title" style="margin:20px 0 16px;font:800 48px/1.05 Arial,sans-serif;letter-spacing:-2px;color:#202820">${title}</h1><p style="margin:0;font:15px/1.8 Arial,sans-serif;color:#5f6d59">${intro}</p></td></tr>
<tr><td class="mail-pad" style="padding:0 38px 4px"><img src="cid:${EMAIL_ART[art].cid}" alt="${art==='registration'?'Your place in the game — BLITZ sports field':'Your new chapter — the BLITZ trophy'}" width="524" height="187" style="display:block;width:100%;height:auto;border:0;border-radius:14px;background:#315a36"></td></tr>
<tr><td class="mail-pad" style="padding:0 38px 30px">${content}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0"><tr><td bgcolor="#315a36" style="border-radius:8px"><a href="${escape(link)}" style="display:inline-block;padding:15px 23px;border:1px solid #315a36;border-radius:8px;text-decoration:none;color:#ffffff;font:700 13px/1.4 Arial,sans-serif">${escape(linkLabel)} &nbsp; ↗</a></td></tr></table></td></tr>
<tr><td class="mail-pad" style="padding:24px 38px;background:#eaf0df;border-top:1px solid #dce4ce"><p style="margin:0 0 8px;font:700 15px/1.5 Arial,sans-serif;color:#315a36">Good games. Better connections.</p><p style="margin:0;font:12px/1.8 Arial,sans-serif;color:#64715b">Hosted by Bachelors in Analytics and Sustainability Studies,<br>TISS Mumbai. Questions? Reply to this email.</p>${reference?`<p style="margin:12px 0 0;font:10px/1.5 Arial,sans-serif;color:#738068;overflow-wrap:anywhere">Registration reference: ${escape(reference)}</p>`:''}</td></tr>
</table><p style="margin:18px 0 0;font:11px/1.6 Arial,sans-serif;color:#7b8574">Bachelor’s BLITZ · Made for the campus.</p></td></tr></table></body></html>`;
}

export function renderMail(job:Job):RenderedMail {
  if(!job.template || job.template==='legacy') return {subject:job.subject,text:job.body};
  if(!['registration','assignment'].includes(job.template)) throw new Error('Unknown mail template.');
  if(!job.data || typeof job.data!=='object' || Array.isArray(job.data)) throw new Error('Missing mail details.');
  const d=job.data as Record<string,unknown>;
  const name=typeof d.name==='string'?d.name:'';
  const role=d.role;
  const selected=Array.isArray(d.sports)?d.sports.filter((item):item is string=>typeof item==='string'):[];
  if(!name || !['player','volunteer'].includes(String(role)) || (role==='player' && !selected.length)) throw new Error('Incomplete mail details.');
  const base=website(d.website_url),reference=typeof d.registration_id==='string'?d.registration_id:'';
  const greeting=`Hi <strong style="color:#202820">${escape(name)}</strong>, `;
  if(job.template==='registration') {
    const player=role==='player';
    const subject='BLITZ: your registration is complete';
    const roleDetails=player ? sectionTitle('Your sports')+sports(selected)
      : sectionTitle('Your volunteer department')+`<p style="margin:0;padding:16px 18px;background:#edf2e4;border-radius:10px;font:700 19px/1.4 Arial,sans-serif;color:#315a36">${escape(d.department)}</p>`;
    const rows:[string,unknown][]=[['Name',name],['Institutional email',d.email],['Role',label(String(role))],['Programme',`${d.programme} · Year ${d.year}`],['Age',d.age],['Gender',label(String(d.gender || ''))],['Home state / UT',d.region],['Played BLITZ before',d.played_before===true?'Yes':'No']];
    const next=player?'You’re in the player pool. After your auction assignment, we’ll email you your team and final price.':'You’re part of the volunteer crew. The organising team will share your next steps.';
    const content=roleDetails+sectionTitle('Your registration details')+details(rows)
      +(!player && d.rationale?sectionTitle('Your contribution')+`<p style="margin:0;font:14px/1.8 Arial,sans-serif;color:#5f6d59;white-space:pre-wrap;overflow-wrap:anywhere">${escape(d.rationale)}</p>`:'')
      +`<div style="margin-top:24px;padding:18px 20px;background:#edf2e4;border-left:3px solid #315a36;border-radius:0 10px 10px 0"><p style="margin:0;font:14px/1.8 Arial,sans-serif;color:#315a36">${escape(next)}</p></div>`;
    const text=`Hi ${name},\n\nYour Bachelor’s BLITZ ${role} registration is complete.\n\n${player?'Your sports: '+selected.map(sportLabel).join(', '):'Department: '+String(d.department || '')}\n\n${rows.map(([key,value])=>`${key}: ${value ?? ''}`).join('\n')}\n${!player && d.rationale?'\nYour contribution: '+d.rationale+'\n':''}\n${next}\n\nMeet the teams: ${base}/teams\n\nThe BLITZ organising team`;
    return {subject,text,html:layout({preheader:`Registration complete. ${player?selected.map(sportLabel).join(' · '):String(d.department || '')}`,kicker:'REGISTRATION COMPLETE',title:player?'You’re in.<br>Let’s play.':'You’re in.<br>Let’s make it happen.',intro:greeting+'your place at Bachelor’s BLITZ is confirmed. Here’s everything you signed up for.',content,art:'registration',link:base+'/teams',linkLabel:'Meet the six teams',reference}),attachments:[EMAIL_ART.registration]};
  }
  const team=typeof d.team==='string'?d.team:'';
  const price=d.price;
  if(!team || typeof price!=='number' || !Number.isInteger(price) || price<0 || !['auction','random'].includes(String(d.source))) throw new Error('Invalid assignment details.');
  const allocated=d.source==='random';
  const color=typeof d.team_color==='string' && /^#[a-f\d]{6}$/i.test(d.team_color)?d.team_color:'#315a36';
  const subject=allocated?`BLITZ: welcome to ${team}`:`BLITZ: sold to ${team} for ${money(price)}`;
  const sentence=allocated?`you’ve been allocated to <strong>${escape(team)}</strong>. Your next chapter starts with your new teammates.`:`you’ve been sold to <strong>${escape(team)}</strong> for <strong>${escape(money(price))}</strong>. Time to bring your game.`;
  const content=sectionTitle('Your new team')+`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#25462b;border-top:5px solid ${color};border-radius:14px"><tr><td style="padding:24px"><p style="margin:0 0 12px;color:#ffffff;font:700 11px/1.5 Arial,sans-serif;letter-spacing:2px">${allocated?'TEAM ALLOCATION':'AUCTION RESULT'}</p><p style="margin:0 0 18px;color:#ffffff;font:800 34px/1.15 Arial,sans-serif;letter-spacing:-1px;overflow-wrap:anywhere">${escape(team)}</p><span style="display:inline-block;padding:10px 15px;border-radius:8px;background:#d9f46b;color:#203e28;font:800 25px/1.2 Arial,sans-serif">${escape(money(price))}</span><p style="margin:12px 0 0;color:#ffffff;font:12px/1.7 Arial,sans-serif">${allocated?'Random allocation · No auction charge':'Final auction price · Team purse updated'}</p></td></tr></table>`
    +sectionTitle('Your sports')+sports(selected)+sectionTitle('Player details')+details([['Player',name],['Programme',`${d.programme} · Year ${d.year}`],['Team',team],['Assignment',allocated?'Random allocation':'Auction sale']])
    +`<p style="margin:24px 0 0;font:14px/1.8 Arial,sans-serif;color:#5f6d59">Your assignment is recorded. Open the team roster to meet the people you’ll be playing alongside.</p>`;
  const text=`Hi ${name},\n\n${allocated?'You have been allocated to '+team+' at no cost.':'You have been sold to '+team+' for '+money(price)+'.'}\n\nYour sports: ${selected.map(sportLabel).join(', ')}\nProgramme: ${d.programme} · Year ${d.year}\n\nYour team roster: ${base}/teams\n\nThe BLITZ organising team`;
  return {subject,text,html:layout({preheader:`${team} · ${money(price)} · Your BLITZ team is ready.`,kicker:allocated?'TEAM ALLOCATED':'SOLD · IT’S OFFICIAL',title:'New team.<br>Same game face.',intro:greeting+sentence,content,art:'assignment',link:base+'/teams',linkLabel:'Meet your teammates',reference}),attachments:[EMAIL_ART.assignment]};
}
