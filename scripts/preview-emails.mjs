import {writeFile,mkdir} from 'node:fs/promises';
import {renderMail} from '../supabase/functions/deliver-mail/templates.ts';
const data={registration_id:'preview-registration',name:'Campus Player',email:'player@example.test',role:'player',programme:'BSASS',year:2,age:20,gender:'female',region:'Maharashtra',played_before:false,
  sports:['Football','Cricket','Badminton','Table tennis','Weightlifting','Chess','Tug of war','Dodgeball'],website_url:'https://blitz-landing-theta.vercel.app'};
const cases={
  registration:{template:'registration',data},
  volunteer:{template:'registration',data:{...data,name:'Campus Volunteer',email:'volunteer@example.test',role:'volunteer',sports:[],department:'Operations',rationale:'I can coordinate equipment, welcome participants, and help keep the event running on time.'}},
  assignment:{template:'assignment',data:{...data,team:'Court Kings',team_color:'#4c7051',price:225,source:'auction'}},
  allocation:{template:'assignment',data:{...data,team:'Court Kings',team_color:'#4c7051',price:0,source:'random'}},
};
await mkdir('docs/email-previews',{recursive:true});
for(const [name,job] of Object.entries(cases)) {
  const rendered=renderMail({...job,subject:'Preview',body:'Preview'});
  let html=rendered.html;
  for(const image of rendered.attachments || []) html=html.replaceAll(`cid:${image.cid}`,`data:${image.contentType};base64,${image.content}`);
  html=html.replace('<body ', '<body data-preview="Design preview — sample details only" ');
  await writeFile(`docs/email-previews/${name}.html`,html);
}
console.log('Built four standalone email design previews with sample details. No email sent.');
