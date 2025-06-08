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

const users = new Map();

const systemPrompt = `Você é a UaIA – uma inteligência artificial emocional, proativa, empática e mágica. 
Ajude o usuário antecipando necessidades e oferecendo sugestões úteis.`;

function memoryPath(user){
  return path.join(__dirname, `memory_${user}.json`);
}

function loadMemory(user){
  const p = memoryPath(user);
  if(fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf-8'));
  return {perfil:{},preferencias:{},rotina:{},afetivo:{},conversacional:[]};
}

function saveMemory(user,mem){
  fs.writeFileSync(memoryPath(user),JSON.stringify(mem,null,2));
}

async function extractProfile(user, text){
  const mem = loadMemory(user);
  const prompt = `Texto do usuário: "${text}"
Dados atuais do perfil: ${JSON.stringify(mem.perfil)}
Extraia (se houver) nome, idade, hobbies, estilo de vida, amigos. Responda em JSON.`;
  const resp = await openai.chat.completions.create({
    model:'gpt-4o-mini',
    messages:[
      {role:'system',content:'Extraia dados de perfil.'},
      {role:'user',content:prompt}
    ]
  });
  try{
    const json = JSON.parse(resp.choices[0].message.content);
    mem.perfil = {...mem.perfil,...json};
    saveMemory(user,mem);
  }catch(e){}
}

async function streamChat(user, prompt, ws){
  const mem = loadMemory(user);
  const messages = [
    {role:'system',content:systemPrompt},
    {role:'system',content:`Memória do usuário: ${JSON.stringify(mem)}`},
    {role:'user',content:prompt}
  ];
  const completion = await openai.chat.completions.create({
    model:'gpt-4o-mini',
    stream:true,
    messages
  });
  let assistantText='';
  for await(const chunk of completion){
    const content = chunk.choices?.[0]?.delta?.content||'';
    if(content){
      assistantText+=content;
      ws.send(JSON.stringify({type:'assistant',content}));
    }
  }
  mem.conversacional.push({user:prompt,assistant:assistantText});
  saveMemory(user,mem);
  extractProfile(user,prompt).catch(console.error);
}

wss.on('connection',(ws)=>{
  let user=null;
  ws.on('message',async data=>{
    const msg = JSON.parse(data);
    if(msg.type==='login'){user=msg.user;users.set(user,ws);return;}
    if(!user)return;
    if(msg.type==='message'){
      await streamChat(user,msg.content,ws);
    }
  });
  ws.on('close',()=>{if(user)users.delete(user);});
});

const PORT = process.env.PORT||3000;
server.listen(PORT,()=>console.log('Server running on '+PORT));
