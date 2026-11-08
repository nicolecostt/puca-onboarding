import { acharMarca } from "./achar";
import { trocarMarca } from "./trocar";

const raiz = process.argv[2];
if (!raiz) {
  console.error("uso: npm run kota:marca -- <raiz do repo>");
  process.exit(1);
}

try {
  const { alterados, renomeados } = trocarMarca(raiz);
  for (const [de, para] of renomeados) console.log(`renomeado  ${de} -> ${para}`);
  for (const a of alterados) console.log(`alterado   ${a}`);
  const sobra = acharMarca(raiz);
  for (const o of sobra) console.log(`sobrou     ${o.arquivo}:${o.linha}: ${o.texto}`);
  console.log(`\n${alterados.length} alterado(s), ${renomeados.length} renomeado(s), ${sobra.length} linha(s) para resolver à mão.`);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
