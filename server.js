require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static('public'));

// ---------- Helpers ----------
function getContext(){
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  const timeStr = now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  return `Hoje é ${dateStr}, ${timeStr}.`;
}

const systemPrompt = `Você é a UaIA – uma inteligência artificial emocional, proativa, empática e mágica. 
Ajude o usuário antecipando necessidades e oferecendo sugestões úteis.`;

function memPath(u){return path.join(__dirname,`memory_${u}.json`);}
function loadMem(u){
  const p=memPath(u);
  if(fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf8'));
  return {perfil:{},preferencias:{},rotina:{},afetivo:{},conversacional:[],last_topic:''};
}
function saveMem(u,m){fs.writeFileSync(memPath(u),JSON.stringify(m,null,2));}

async function extractProfile(u,text){
  const mem=loadMem(u);
  const prompt=`Texto: "${text}"\nPerfil atual: ${JSON.stringify(mem.perfil)}\nExtraia nome, idade, hobbies, estilo de vida, amigos (JSON).`;
  const r=await openai.chat.completions.create({
    model:'gpt-4o-mini',
    messages:[{role:'system',content:'Extraia dados de perfil.'},{role:'user',content:prompt}]
  });
  try{Object.assign(mem.perfil,JSON.parse(r.choices[0].message.content));saveMem(u,mem);}catch(e){}
}

function needsLastTopic(text){return /isso|aquilo|mais sobre|continuar/i.test(text);}

// ---------- Chat ----------
async function chat(u,text,ws){
  const mem=loadMem(u);
  const ctx=getContext();
  const msgs=[
    {role:'system',content:systemPrompt},
    {role:'system',content:`Contexto: ${ctx}`},
    {role:'system',content:`Memória: ${JSON.stringify(mem)}`},
    {role:'user',content: needsLastTopic(text)?`${mem.last_topic}\n\n${text}`:text}
  ];
  const stream=await openai.chat.completions.create({model:'gpt-4o-mini',stream:true,messages:msgs});
  let assistant='';
  for await(const chunk of stream){
    const c=chunk.choices?.[0]?.delta?.content||'';
    if(c){assistant+=c;ws.send(JSON.stringify({type:'assistant',content:c}));}
  }
  mem.conversacional.push({user:text,assistant});
  mem.last_topic=assistant.slice(-300); // resumo do assunto
  saveMem(u,mem);
  extractProfile(u,text).catch(console.error);
}

// ---------- WebSocket ----------
wss.on('connection',ws=>{
  let user=null;
  ws.on('message',d=>{
    const m=JSON.parse(d);
    if(m.type==='login'){user=m.user;return;}
    if(m.type==='message'&&user)chat(user,m.content,ws);
  });
});

server.listen(process.env.PORT||3000,()=>console.log('Server on '+(process.env.PORT||3000)));
