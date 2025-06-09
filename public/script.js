const micBtn = document.getElementById('mic');
const input  = document.getElementById('prompt');

let recognition;
let listening = false;

/* ----------- Web Speech API ----------- */
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
  };

  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove('recording');
  };
}

/* ----------- Controle do botão ----------- */
micBtn.addEventListener('click', () => {
  if (!recognition) {
    alert('Speech Recognition not supported in this browser.');
    return;
  }
  if (!listening) {
    recognition.start();
    listening = true;
    micBtn.classList.add('recording');
  } else {
    recognition.stop();
  }
});

/* ----------- Animação de gravação ----------- */
const extraStyle = document.createElement('style');
extraStyle.textContent = `
  #mic.recording {
    animation: glowPulse 1s ease-in-out infinite;
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 12px rgba(66,135,245,0.9), 0 0 25px rgba(66,135,245,0.6); }
    50%      { box-shadow: 0 0 18px rgba(66,135,245,1), 0 0 35px rgba(66,135,245,0.8); }
  }
`;
document.head.appendChild(extraStyle);
