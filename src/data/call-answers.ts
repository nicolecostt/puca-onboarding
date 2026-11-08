// Respostas de exemplo da call inicial para os dois perfis da demo (?perfil=bruno | ana).
// A call usa quando a pessoa "responde por voz" na simulação; a calibragem de demo também sai daqui.
// Bruno: vem de Contas, conhece login e JWT, nunca mexeu com saldo e extrato. Ana: nunca trabalhou com banco.

export const callAnswers: Record<string, Record<string, string>> = {
  bruno: {
    vinculo: "Estou mudando de time, vim de Contas",
    confirma: "Isso, certinho",
    time_anterior: "Contas",
    experiencia: "Em Contas eu cuidava do login e do JWT no userservice",
    aproveita: "JWT e o jeito de investigar um login com problema",
    diferencas: "Saldo e extrato, Java no lugar de Python, e o time é todo novo pra mim",
    pagamentos: "Pouco, só pelo lado do login; transferência e saldo eu não conheço",
    mensageria: "Sim, usei filas no emprego anterior",
    falhas: "Já, no emprego anterior a gente tinha retry e DLQ nos consumidores",
    objetivos: "Entender o caminho de uma transferência e fazer minha primeira mudança no livro-razão sozinho",
  },
  ana: {
    vinculo: "Primeira vez",
    confirma: "Sim, está certo",
    experiencia: "Eu era desenvolvedora numa agência, fazia APIs para e-commerce",
    pagamentos: "Nunca trabalhei com pagamentos",
    mensageria: "Pouco, só vi num curso",
    falhas: "Não muito, retry eu sei o que é",
    objetivos: "Entender como o time funciona e entregar minha primeira tarefa com ajuda",
  },
};
