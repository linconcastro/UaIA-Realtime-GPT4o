/* Mantém a funcionalidade atual de prompt + voz */
document.addEventListener("DOMContentLoaded", () => {
  const promptInput = document.getElementById("prompt");
  const form       = document.getElementById("prompt-form");
  const micBtn     = document.getElementById("mic-btn");

  /* Envio de texto */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = promptInput.value.trim();
    if (!value) return;
    /* Disparar para a lógica existente (back‑end da UaIA) */
    window.uaia?.submitPrompt?.(value);
    promptInput.value = "";
  });

  /* Gravação de voz */
  micBtn.addEventListener("click", () => {
    window.uaia?.startVoice?.();
  });
});
