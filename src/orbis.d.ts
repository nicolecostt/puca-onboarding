// Ponte do app para Mac (docs/contratos.md, "App para Mac"). Só existe dentro do app; no navegador comum é undefined.
interface Orbis {
  /** Versão do app (a do package.json), ex.: "0.1.0". */
  versao: string;
  /** Navegador de Puca (contrato "Computer use", src/lib/orbis.ts). */
  navegador?: import("./lib/orbis").OrbisNavegador;
}

interface Window {
  orbis?: Orbis;
}
