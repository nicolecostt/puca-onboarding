// Call inicial: o agente se apresenta e coleta as infos iniciais do usuário.
// Por enquanto a conversa é simulada (roteiro abaixo). A pessoa pode responder
// "por voz" (resposta de exemplo depois de alguns segundos) ou digitando no chat.
(function () {
  const $ = (id) => document.getElementById(id);

  // ---- Roteiro ----
  const FIELDS = [
    { key: "nome", label: "Como prefere ser chamado", sample: "Bruno" },
    { key: "cargo", label: "Cargo", sample: "Engenheiro de backend" },
    { key: "time", label: "Time", sample: "TMS — fraud-score" },
    { key: "gestor", label: "Gestor(a)", sample: "Marcos Vidal" },
    { key: "ferramentas", label: "Ferramentas que já usa", sample: "GitHub, Slack e Jira" },
    { key: "aprender", label: "Como prefere aprender", sample: "Fazendo junto com alguém" },
  ];

  const QUESTIONS = {
    nome: () => "Oi! Eu sou o agente que vai te acompanhar na sua primeira semana. Antes de começar, quero te conhecer um pouco. Como você prefere ser chamado?",
    cargo: (a) => `Prazer, ${a.nome}! Qual vai ser o seu cargo aqui?`,
    time: () => "Legal. Em qual time você vai entrar?",
    gestor: () => "E quem é a pessoa que vai ser sua gestora ou gestor?",
    ferramentas: () => "Quais ferramentas você já usa no dia a dia?",
    aprender: () => "E pra fechar: você aprende melhor lendo, vendo alguém fazer ou fazendo junto?",
  };
  const OUTRO = (a) => `Perfeito, ${a.nome}. Já tenho o que preciso. Vou montar sua primeira semana com o time ${a.time} e te mostro em seguida.`;

  // ---- Estado ----
  const answers = {};
  const state = { paused: false, ended: false, muted: false, seconds: 0, done: false };
  let pendingAnswer = null; // resolve da pergunta atual quando a resposta chega pelo chat

  // ---- Componentes ----
  const chat = ChatPanel.mount({ title: "Transcrição da call", messages: [] });
  const call = CallBar.mount({ status: "Conectando…", chat });

  // Guarda a resposta sem mostrar na tela: a pessoa vive uma entrevista,
  // não vê o que está sendo coletado. Fica em window.onboardingAnswers e no evento abaixo.
  function remember(key, value) {
    answers[key] = value;
    document.dispatchEvent(new CustomEvent("onboarding:answer", { detail: { key, value, answers: { ...answers } } }));
  }
  window.onboardingAnswers = answers;

  // ---- Visual do agente ----
  // Se o teste da Iris estiver carregado, ela entra no lugar do círculo neutro.
  let iris = null;
  if (window.IrisAgent) {
    const orb = $("orb");
    orb.classList.add("has-iris");
    const holder = document.createElement("div");
    holder.className = "agent__iris";
    orb.appendChild(holder);
    iris = IrisAgent.mount(holder);
  }
  const IRIS_STATE = { idle: "idle", speaking: "talk", listening: "idle", thinking: "think", paused: "idle", ended: "idle", done: "think" };

  // ---- Estados do agente ----
  const LABELS = { idle: "Conectando…", speaking: "Falando", listening: "Ouvindo você", thinking: "Pensando…", paused: "Pausado", ended: "Call encerrada", done: "Montando sua semana…" };
  const STATUS = { speaking: "Agente falando…", listening: "Ouvindo você…", thinking: "Pensando na sua resposta…", paused: "Call pausada", done: "Montando sua primeira semana…" };
  let agentState = "idle";

  function setAgent(s) {
    agentState = s;
    render();
  }

  // estado visível = pausa/encerramento têm prioridade sobre o que o agente está fazendo
  function render() {
    const shown = state.ended ? "ended" : state.paused ? "paused" : agentState;
    $("orb").dataset.state = shown;
    if (iris) {
      iris.setState(IRIS_STATE[shown]);
      iris.setWarm(agentState === "thinking"); // continua quente mesmo se pausar no meio
    }
    $("agent-state").textContent = LABELS[shown];
    if (STATUS[shown]) call.setStatus(STATUS[shown]);
    $("live").classList.toggle("is-off", state.ended);
    $("caption-hint").textContent =
      shown === "listening" && state.muted ? "Seu microfone está mudo. Responda pelo chat." :
      shown === "listening" ? "Fale normalmente ou responda pelo chat." :
      shown === "ended" ? "Use “Ligar para o agente” para continuar de onde parou." : "";
  }

  // ---- Tempo que só corre com a call ativa ----
  function wait(ms) {
    return new Promise((resolve) => {
      let left = ms;
      const t = setInterval(() => {
        if (state.paused || state.ended) return;
        left -= 50;
        if (left <= 0) { clearInterval(t); resolve(); }
      }, 50);
    });
  }

  setInterval(() => {
    if (state.paused || state.ended || state.done) return;
    state.seconds++;
    const m = String(Math.floor(state.seconds / 60)).padStart(2, "0");
    const s = String(state.seconds % 60).padStart(2, "0");
    $("timer").textContent = `${m}:${s}`;
  }, 1000);

  // Agente "fala": a legenda aparece palavra por palavra
  async function say(text) {
    setAgent("speaking");
    $("caption-user").textContent = "";
    const words = text.split(" ");
    const out = $("caption-agent");
    out.textContent = "";
    for (let i = 0; i < words.length; i++) {
      out.textContent = words.slice(0, i + 1).join(" ");
      await wait(140);
    }
    chat.addMessage({ from: "agent", text });
    await wait(300);
  }

  // Agente "ouve": resposta chega pelo chat ou, sem mudo, pela "voz" de exemplo
  function listen(field) {
    setAgent("listening");
    return new Promise((resolve) => {
      let finished = false;
      const finish = (text, fromChat) => {
        if (finished) return;
        finished = true;
        pendingAnswer = null;
        if (!fromChat) chat.addMessage({ from: "user", text });
        $("caption-user").textContent = text;
        resolve(text);
      };
      pendingAnswer = (text) => finish(text, true);
      (async () => {
        await wait(2600);
        while (state.muted && !finished) await wait(200); // mudo: espera o chat
        finish(field.sample, false);
      })();
    });
  }

  document.addEventListener("chatpanel:send", (e) => {
    if (pendingAnswer) pendingAnswer(e.detail.text.trim());
  });

  // ---- Barra de call ----
  document.addEventListener("callbar:pause", (e) => { state.paused = e.detail.on; render(); });
  document.addEventListener("callbar:mute", (e) => { state.muted = e.detail.on; render(); });
  document.addEventListener("callbar:end", () => { state.ended = true; render(); });
  document.addEventListener("callbar:start", () => { state.ended = false; render(); });

  // ---- Conversa ----
  async function run() {
    await wait(900);
    for (let i = 0; i < FIELDS.length; i++) {
      const f = FIELDS[i];
      await say(QUESTIONS[f.key](answers));
      const answer = await listen(f);
      // depois da resposta, ela "pensa" um pouco antes de anotar
      setAgent("thinking");
      await wait(1800);
      remember(f.key, answer);
      await wait(400);
    }
    await say(OUTRO(answers));
    state.done = true;
    setAgent("done");
  }

  render();
  run();
})();
