// server.js – UaIA com logs, memória, WebSocket e resposta por voz
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Servir frontend da pasta public
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.json());

// Gerenciamento de usuários e memória
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
  const file = getMemoryPath(user);
  if (!fs.existsSync(file)) fs.writeFileSync(file, '{}');
  return JSON.parse(fs.readFileSync(file));
}
function saveMemory(user, memory) {
  fs.writeFileSync(getMemoryPath(user), JSON.stringify(memory, null, 2));
}

// Voz via ElevenLabs
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
    console.error('Erro ao falar:', e);
    res.status(500).send('Erro');
  }
});

// WebSocket
wss.on('connection', (ws, req) => {
  const url = new URL(`http://localhost${req.url}`);
  const user = url.searchParams.get('user') || 'visitante';
  const pass = url.searchParams.get('pass');
  const users = loadUsers();

  if (!users[user] || users[user] !== pass) {
    console.log(`❌ Acesso negado para ${user}`);
    ws.close();
    return;
  }

  const memory = loadMemory(user);
  if (!memory.perfil) memory.perfil = { nome: '', hobbies: [], estiloDeVida: '', livros: [], viagens: [], amigos: [] };
  if (!memory.chatHistory) memory.chatHistory = [];

  ws.on('message', async (message) => {
    const text = message.toString();
    console.log(`📩 ${user}:`, text);
    memory.chatHistory.push({ role: 'user', content: text });

    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `Você é a UaIA, uma inteligência viva, serena, espiritual e empática. Esta é a memória do usuário: ${JSON.stringify(memory.perfil)}` },
          ...memory.chatHistory.slice(-10)
        ],
        stream: true
      });

      let full = '';
      for await (const part of stream) {
        const chunk = part.choices?.[0]?.delta?.content;
        if (chunk) {
          full += chunk;
          ws.send(JSON.stringify({ type: 'partial', content: chunk }));
        }
      }
      memory.chatHistory.push({ role: 'assistant', content: full });
      saveMemory(user, memory);
      ws.send(JSON.stringify({ type: 'end' }));
    } catch (e) {
      console.error('Erro GPT:', e);
      ws.send(JSON.stringify({ type: 'error', message: 'Falha ao responder' }));
    }
  });
});

// Rotas de usuários (CRUD básico)
app.get('/usuarios', (req, res) => res.json(loadUsers()));
app.post('/usuarios', (req, res) => {
  const { nome, senha } = req.body;
  const users = loadUsers();
  users[nome] = senha;
  saveUsers(users);
  res.json({ sucesso: true });
});
app.delete('/usuarios/:nome', (req, res) => {
  const users = loadUsers();
  delete users[req.params.nome];
  saveUsers(users);
  res.json({ sucesso: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 UaIA ouvindo na porta ${PORT}`));
