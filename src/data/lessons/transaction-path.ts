// Aula "O caminho de uma transação" (Figma: "03 · Aula no quadro — o wow").
// Posições e setas seguem o Figma, num quadro de 1440×844.
import type { Lesson } from "../types";

export const transactionPath: Lesson = {
  id: "transaction-path",
  title: "O caminho de uma transação",

  nodes: [
    {
      id: "pos", label: "Maquininha\nMaréPOS", kind: "external", x: 40, y: 300, w: 140,
      details: { what: "A maquininha do lojista. Lê o cartão e manda a transação para o pos-gateway." },
    },
    {
      id: "gateway", label: "pos-gateway", kind: "service", x: 230, y: 290, w: 160, ownerId: "diego",
      details: {
        what: "Recebe as transações das maquininhas, gera a chave de idempotência (serial + NSU) e chama o authorizer.",
        docs: ["ADR-012 · Idempotência por serial + NSU", "README do pos-gateway"],
        help: "#time-autorizacao",
      },
    },
    {
      id: "authorizer", label: "authorizer", kind: "service", x: 470, y: 140, w: 160, ownerId: "julia",
      details: {
        what: "Decide se a transação é aprovada e calcula o MDR (taxa cobrada do lojista).",
        docs: ["ADR-019 · Cálculo de MDR por plano", "fees/mdr.go"],
        help: "#time-autorizacao",
      },
    },
    {
      id: "common", label: "mare-common", kind: "service", x: 700, y: 150, w: 130,
      details: {
        what: "Biblioteca compartilhada. A ligação com o authorizer foi inferida do código, ainda sem confirmação do dono.",
        help: "Confirmar com a Júlia Paiva",
      },
    },
    {
      id: "topic", label: "transactions.authorized", kind: "topic", x: 470, y: 300, w: 230,
      details: { what: "Fila onde o gateway publica toda venda aprovada. É assim que o resto da empresa fica sabendo." },
    },
    {
      id: "settlement", label: "settlement-worker", kind: "blackbox", x: 780, y: 290, w: 180, ownerId: "rafa",
      note: "caixa preta · aguardando Carla",
      details: {
        what: "Consome as vendas aprovadas e manda para a liquidação. Não achei documentação confirmada.",
        help: "Pedido de explicação enviado para a Carla Mendes",
      },
    },
    {
      id: "settlementDay", label: "Liquidação D+1", kind: "service", x: 1040, y: 300, w: 160,
      details: { what: "Quando o lojista recebe o dinheiro: um dia depois da venda." },
    },
    {
      id: "dlq", label: "settlement.dlq", kind: "dlq", x: 780, y: 470, w: 180,
      details: { what: "Fila das mensagens que falharam 3 vezes. Alguém da Liquidação olha manualmente." },
    },
    // ---- "ainda não explicado": o que o time novo (Terminais) cuida ----
    { id: "configApi", label: "terminal-config-api", kind: "service", x: 230, y: 600, w: 180, ownerId: "lucas" },
    { id: "configTopic", label: "terminal.config.updated", kind: "topic", x: 470, y: 600, w: 230 },
    { id: "cdnPublisher", label: "firmware-cdn-publisher", kind: "service", x: 780, y: 600, w: 200, ownerId: "lucas" },
    { id: "cdn", label: "CDN", kind: "service", x: 1040, y: 600, w: 160, caption: "cdn.mare.dev" },
  ],

  edges: [
    {
      id: "pos-gateway", from: "pos", to: "gateway",
      path: "M184 327 C198 324.3 212 322.3 226 321", head: "M217 315 L226 321 L218 328",
      evidence: { kind: "proven", x: 168, y: 262 },
    },
    {
      id: "gateway-authorizer", from: "gateway", to: "authorizer",
      path: "M352 287 C365 230 410 180 466 172", head: "M455 166 L466 172 L457 180",
      label: { text: "HTTP POST /v1/authorize", x: 420, y: 218, font: "mono" },
      evidence: { kind: "proven", x: 420, y: 240 },
    },
    {
      id: "authorizer-common", from: "authorizer", to: "common", style: "inferred",
      path: "M633 168 C650 165.5 676 165.5 696 169", head: "M687 163 L696 169 L688 176",
      evidence: { kind: "inferred", x: 562, y: 112 },
    },
    {
      id: "gateway-topic", from: "gateway", to: "topic",
      path: "M393 318 C417.7 315.3 442 315.7 466 319", head: "M456 313 L466 319 L456 325",
      label: { text: "publica", x: 404, y: 292 },
      evidence: { kind: "proven", x: 396, y: 332 },
    },
    {
      id: "topic-settlement", from: "topic", to: "settlement",
      path: "M703 319 C727.7 322.3 752 323 776 321", head: "M766 315 L776 321 L766 328",
      label: { text: "consome", x: 710, y: 292 },
      evidence: { kind: "proven", x: 706, y: 332 },
    },
    {
      id: "settlement-day", from: "settlement", to: "settlementDay",
      path: "M963 318 C987.7 315.4 1012 315.7 1036 319", head: "M1026 313 L1036 319 L1027 326",
      evidence: { kind: "proven", x: 966, y: 332 },
    },
    {
      id: "settlement-dlq", from: "settlement", to: "dlq", style: "retry",
      path: "M868 382 C869.5 410 870.5 440 869 465", head: "M862 456 L869 466 L876 457",
      label: { text: "retry 3x → DLQ", x: 884, y: 416 },
    },
    {
      id: "config-topic", from: "configApi", to: "configTopic",
      path: "M413 625 C431 621.7 448.7 620.7 466 622", head: "M456 616 L466 622 L457 629",
    },
    {
      id: "topic-publisher", from: "configTopic", to: "cdnPublisher",
      path: "M703 620 C727.6 624 752 625.3 776 624", head: "M766 618 L776 624 L767 631",
    },
    {
      id: "publisher-cdn", from: "cdnPublisher", to: "cdn",
      path: "M983 627 C1000.9 623.7 1018.6 623 1036 625", head: "M1026 619 L1036 625 L1027 632",
    },
  ],

  labels: [{ id: "upcomingLabel", text: "ainda não explicado", x: 40, y: 616 }],

  upcoming: ["upcomingLabel", "configApi", "configTopic", "cdnPublisher", "cdn", "config-topic", "topic-publisher", "publisher-cdn"],

  sections: [
    {
      title: "Do cartão ao gateway",
      beats: [
        {
          say: "Vamos seguir uma transação do começo ao fim. Tudo começa na maquininha, a MaréPOS.",
          highlight: "Tudo começa na maquininha",
          reveal: ["pos"],
          focus: "pos",
        },
        {
          say: "Quando o cartão passa, a maquininha manda a transação para o pos-gateway, que é do time do Diego.",
          highlight: "manda a transação para o pos-gateway",
          reveal: ["gateway", "pos-gateway"],
          focus: "gateway",
        },
      ],
    },
    {
      title: "Autorização",
      beats: [
        {
          say: "O pos-gateway gera uma chave de idempotência com o serial do terminal mais o NSU e chama o authorizer.",
          highlight: "chama o authorizer",
          reveal: ["authorizer", "gateway-authorizer"],
          focus: "authorizer",
        },
        {
          say: "O authorizer calcula o MDR, 1,19% no débito e 2,49% no crédito à vista, e responde. Ele usa a mare-common, mas isso eu deduzi do código: o dono ainda não confirmou.",
          highlight: "o dono ainda não confirmou",
          reveal: ["common", "authorizer-common"],
          focus: "common",
        },
        {
          say: "Aí o gateway publica na fila transactions.authorized. É por ela que o resto da empresa fica sabendo que a venda aconteceu.",
          highlight: "Aí o gateway publica na fila transactions.authorized",
          reveal: ["topic", "gateway-topic"],
          focus: "topic",
        },
      ],
    },
    {
      title: "Liquidação",
      beats: [
        {
          say: "Quem consome essa fila é o settlement-worker, do Rafa. Ele é uma caixa preta pra mim: não achei documentação confirmada, então pedi para a Carla explicar.",
          highlight: "não achei documentação confirmada",
          reveal: ["settlement", "topic-settlement"],
          focus: "settlement",
        },
        {
          say: "Ele junta as vendas e manda para a liquidação em D+1, que é quando o lojista recebe.",
          highlight: "liquidação em D+1",
          reveal: ["settlementDay", "settlement-day"],
          focus: "settlementDay",
        },
        {
          say: "Se der erro, ele tenta de novo três vezes. Se continuar falhando, a mensagem vai para a settlement.dlq, a fila das mensagens com problema.",
          highlight: "vai para a settlement.dlq",
          reveal: ["dlq", "settlement-dlq"],
          focus: "dlq",
        },
        {
          say: "Esse é o caminho de uma transação. Embaixo ficou o que o seu time novo cuida: a gente vê isso na próxima aula.",
          highlight: "o que o seu time novo cuida",
          focus: null,
        },
      ],
    },
  ],

  questions: [
    {
      question: "e se o settlement cair?",
      answer:
        "Nada se perde: as vendas ficam esperando na fila transactions.authorized. Quando o settlement-worker volta, ele continua de onde parou. Se uma mensagem falhar três vezes, vai para a settlement.dlq.",
      focus: "dlq",
    },
    {
      question: "onde está o cálculo de MDR?",
      answer:
        "No authorizer, no módulo fees/mdr. As taxas vêm de uma tabela por plano do lojista. Quem conhece os detalhes é a Júlia Paiva.",
      focus: "authorizer",
    },
    {
      question: "quem é dono do quê?",
      answer:
        "O pos-gateway e o authorizer são do time de Autorização, com o Diego e a Júlia. O settlement-worker é da Liquidação, com o Rafa, e a Carla é a referência. O que está embaixo é do seu time novo, com o Lucas.",
    },
  ],
};
