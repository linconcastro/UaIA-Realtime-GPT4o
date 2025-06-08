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

function getMemoryFile(user) {
  return path.join(__dirname, `memory_${user}.json`);
}

function appendMemory(user, message) {
  const file = getMemoryFile(user);
  let arr = [];
  if (fs.existsSync(file)) {
    arr = JSON.parse(fs.readFileSync(file, 'utf-8'));
  }
  arr.push(message);
  fs.writeFileSync(file, JSON.stringify(arr, null, 2));
}

async function streamChat(user, prompt, ws) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,
    messages: [
      { role: 'system', content: 'Você é o assistente UaIA.' },
      { role: 'user', content: prompt }
    ]
  });

  for await (const chunk of completion) {
    const content = chunk.choices?.[0]?.delta?.content || '';
    if (content) {
      ws.send(JSON.stringify({ type: 'assistant', content }));
    }
  }
}

wss.on('connection', (ws, req) => {
  let user = null;

  ws.on('message', async data => {
    const msg = JSON.parse(data);

    if (msg.type === 'login') {
      user = msg.user;
      users.set(user, ws);
      ws.send(JSON.stringify({ type: 'login', success: true }));
      return;
    }

    if (!user) return;

    if (msg.type === 'message') {
      const text = msg.content;
      appendMemory(user, { role: 'user', content: text });
      await streamChat(user, text, ws);
    }
  });

  ws.on('close', () => {
    if (user) users.delete(user);
  });
});

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log('erver running on ' + PORT));
