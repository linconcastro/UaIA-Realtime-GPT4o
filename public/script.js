// script.js - conecta interface da UaIA ao backend com WebSocket e voz
const params = new URLSearchParams(window.location.search);
const user = params.get('user') || 'visitante';
const pass = params.get('pass') || 'senha';

let ws;
let wsReady = false;
let currentResponseEl = null;
let currentResponseText = '';


function conectarWs() {
  ws = new WebSocket(`wss://${window.location.host}/?user=${user}&pass=${pass}`);

  ws.onopen = () => {
    wsReady = true;
    console.log("🟢 Conectado com sucesso!");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "partial") {
      renderResposta(data.content);
  }
      if (data.type === "end") {
        finalizarResposta();
      }
; // libera para próxima resposta
    }
29
30
31
32
33
34
35
36
37
38
39
40

  };
}

function renderResposta(texto) {
  if (!currentResponseEl) {
    currentResponseEl = document.createElement("div");
    currentResponseEl.className = "msg uaia";
    document.getElementById("chat").appendChild(currentResponseEl);
  }
  currentResponseText += texto;
  currentResponseEl.innerText = currentResponseText;
  currentResponseEl.scrollIntoView({ behavior: 'smooth' });
}

function finalizarResposta() {
  if (currentResponseText) {
    speak(currentResponseText);
  }
  currentResponseEl = null;
  currentResponseText = '';
}

function enviarMensagem() {
  const input = document.querySelector("input[type='text']");
  const msg = input.value.trim();
  if (!msg || !wsReady) return;
  const eu = document.createElement("div");
  eu.className = "msg user";
  eu.innerText = msg;
 document.getElementById("chat").appendChild(eu);
  ws.send(msg);
  input.value = "";
}

async function speak(text) {
  try {
    const response = await fetch("/fala", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: text })
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play();
  } catch (err) {
    console.error("Erro ao falar:", err);
  }
}

function startListening() {
  if (!('webkitSpeechRecognition' in window)) {
    alert("Seu navegador não suporta entrada por voz.");
    return;
  }
  const recognition = new webkitSpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.onresult = function (event) {
    const text = event.results[0][0].transcript;
    document.querySelector("input[type='text']").value = text;
    enviarMensagem();
  };
  recognition.onerror = function (event) {
    console.error("Erro no reconhecimento de voz:", event.error);
  };
  recognition.start();
}

document.addEventListener("DOMContentLoaded", () => {
  conectarWs();
  document.querySelector("button").addEventListener("click", enviarMensagem);
});
