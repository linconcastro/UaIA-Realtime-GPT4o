// server.js - backend da UaIA com memória, voz e múltiplos perfis
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname)));
app.use(express.json());

const USERS_FILE = path.join(__dirname, 'usuarios.json');
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '{}');
  return JSON.parse(fs.readFileSync(USERS_FILE));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function getMemoryPath(user) {
  return path.join(__dirname, `memory_${user}.json`);
}
function loadMemory(user) {
  const path = getMemoryPath(user);
  if (!fs.existsSync(path)) fs.writeFileSync(path, '{}');
  return JSON.parse(fs.readFileSync(path));
}
function saveMemory(user, data) {
  fs.writeFileSync(getMemoryPath(user), JSON.stringify(data, null, 2));
}

app.post('/fala', async (req, res) => {
  const { texto } = req.body;
  try {
    const resposta = await fetch("https://api.elevenlabs.io/v1/text-to-speech/exAVrFY2a7RCaz7Tz9QU/stream", {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVEN_API_KEY
      },
      body: JSON.stringify({
        text: texto,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    });
    if (!resposta.ok) return res.status(500).send('Erro ao gerar voz');
    res.set({ 'Content-Type': 'audio/mpeg' });
    resposta.body.pipe(res);
  } catch (e) {
    console.error('Erro na fala:', e);
    res.status(500).send('Erro');
  }
});

wss.on('connection', (ws, req) => {
  const url = new URL(`http://localhost${req.url}`);
  const user = url.searchParams.get('user') || 'visitante';
  const pass = url.searchParams.get('pass');
  const users = loadUsers();
  if (users[user] !== pass) {
    ws.close();
    return;
  }

  const memory = loadMemory(user);
  if (!memory.perfil) memory.perfil = { nome: '', hobbies: [], estiloDeVida: '', livros: [], viagens: [], amigos: [] };
  if (!memory.chatHistory) memory.chatHistory = [];

  ws.on('message', async msg => {
    const text = msg.toString();
    memory.chatHistory.push({ role: 'user', content: text });
    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `Você é a UaIA, uma presença viva, gentil e consciente. Use as informações abaixo como memória: ${JSON.stringify(memory.perfil)}` },
          ...memory.chatHistory.slice(-10)
        ],
        stream: true
      });
      let response = '';
      for await (const part of stream) {
        const chunk = part.choices?.[0]?.delta?.content;
        if (chunk) {
          response += chunk;
          ws.send(JSON.stringify({ type: 'partial', content: chunk }));
        }
      }
      memory.chatHistory.push({ role: 'assistant', content: response });
      saveMemory(user, memory);
      ws.send(JSON.stringify({ type: 'end' }));
    } catch (e) {
      console.error('Erro no GPT:', e);
      ws.send(JSON.stringify({ type: 'error', message: 'Erro ao responder' }));
    }
  });
});

app.get('/usuarios', (req, res) => res.json(loadUsers()));
app.post('/usuarios', (req, res) => {
  const { nome, senha } = req.body;
  const u = loadUsers();
  u[nome] = senha;
  saveUsers(u);
  res.json({ sucesso: true });
});
app.delete('/usuarios/:nome', (req, res) => {
  const u = loadUsers();
  delete u[req.params.nome];
  saveUsers(u);
  res.json({ sucesso: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("🚀 UaIA pronta na porta", PORT));
