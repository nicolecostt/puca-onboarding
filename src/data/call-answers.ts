// Respostas de exemplo da call inicial para os dois perfis da demo (?perfil=bruno | ana).
// A call usa quando a pessoa "responde por voz" na simulação; a calibragem de demo também sai daqui.
// Bruno: já trabalhou com filas, pouco de adquirência. Ana: pouco de filas, nunca viu adquirência.

export const callAnswers: Record<string, Record<string, string>> = {
  bruno: {
    vinculo: "Estou mudando de time, vim do Antifraude",
    confirma: "Isso, certinho",
    time_anterior: "Antifraude",
    experiencia: "No Antifraude eu cuidava dos consumidores Kafka que analisam as transações",
    aproveita: "Kafka e o jeito de investigar uma transação com problema",
    diferencas: "A parte de terminais e configuração, e o time é todo novo pra mim",
    pagamentos: "Um pouco, pelo lado da fraude, mas adquirência eu não conheço",
    mensageria: "Sim, uso Kafka todo dia",
    falhas: "Já, a gente tinha retry e DLQ nos consumidores",
    objetivos: "Entender o caminho da transação e fazer minha primeira mudança no terminal-config sozinho",
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
