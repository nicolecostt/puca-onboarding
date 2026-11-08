// Assinatura própria (ad hoc) do Orbis.app, sem conta da Apple (docs/stack.md §3.4). Roda no afterPack do electron-builder.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function assinar(ctx) {
  if (ctx.electronPlatformName !== "darwin") return;
  const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });
};
