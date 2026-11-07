# puca-onboarding

Telas do agente de onboarding (Puca & Iris), em HTML/CSS/JS puro.

## Estrutura

```
src/
  components/        peças reutilizáveis entre telas
    call-bar/        barra de call flutuante (Figma: "Session control bar")
      call-bar.css
      call-bar.js
      icons/         ícones exportados do Figma
    chat-panel/      painel "Journey copilot" que abre pelo botão de chat da barra
      chat-panel.css
      chat-panel.js
      icons/
    agent-cam/       "câmera" do agente no canto inferior direito (quadrado branco)
      agent-cam.css
      agent-cam.js
  screens/           telas (uma pasta por tela)
    onboarding-call/ call inicial: agente coleta as infos do usuário
demos/               páginas para testar componentes isolados
```

## Usar a barra de call (com o chat) numa tela

```html
<link rel="stylesheet" href="../../components/call-bar/call-bar.css">
<link rel="stylesheet" href="../../components/chat-panel/chat-panel.css">
<script src="../../components/chat-panel/chat-panel.js"></script>
<script src="../../components/call-bar/call-bar.js"></script>
<script>
  const chat = ChatPanel.mount();
  const call = CallBar.mount({ status: "Clicking “Compare plans”…", chat });
</script>
```

Encerrar a call deixa na tela o botão "Ligar para o agente", que traz a barra de volta.

Teste isolado: abra `demos/call-bar.html` no navegador.
