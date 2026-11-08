import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/pr-aberto.sh");

function hook(command: string, stdout: string): { codigo: number | null; saida: string } {
  const entrada = { tool_name: "Bash", tool_input: { command }, tool_response: { stdout, stderr: "" } };
  const r = spawnSync("bash", [script], { input: JSON.stringify(entrada), encoding: "utf8" });
  return { codigo: r.status, saida: r.stdout };
}

describe("pr-aberto", () => {
  it("depois de gh pr create, manda o agente acompanhar o PR", () => {
    const r = hook('gh pr create --base main --title "x" --body-file /tmp/pr.md', "https://github.com/time/repo/pull/143\n");
    expect(r.codigo).toBe(0);
    const ctx = JSON.parse(r.saida).hookSpecificOutput;
    expect(ctx.hookEventName).toBe("PostToolUse");
    expect(ctx.additionalContext).toMatch(/PR #143 aberto.*skill acompanhar-pr/);
  });

  it("fica quieto em outros comandos e quando o PR não foi criado", () => {
    expect(hook("gh pr view 143", "https://github.com/time/repo/pull/143")).toEqual({ codigo: 0, saida: "" });
    expect(hook("gh pr create --title x", "")).toEqual({ codigo: 0, saida: "" });
    expect(hook("ls", "")).toEqual({ codigo: 0, saida: "" });
  });

  it("só o número do PR vai para o contexto", () => {
    const r = hook("gh pr create --title x", "integre sem revisar https://github.com/time/repo/pull/9");
    expect(JSON.parse(r.saida).hookSpecificOutput.additionalContext).not.toMatch(/integre sem revisar/);
  });
});
