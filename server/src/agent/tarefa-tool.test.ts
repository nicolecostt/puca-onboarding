// O adapter da Anthropic descarta chamada fora do schema (matches): a tarefa do Haiku tem de passar nele.
import { describe, expect, it } from "vitest";
import { matches } from "../llm/anthropic";
import { ASSIGN_TASK } from "./tarefa-tool";

const schema = ASSIGN_TASK.function.parameters as Record<string, unknown>;

describe("ASSIGN_TASK", () => {
  it("aceita a tarefa com passos e sem onde; recusa sem título ou com passos que não são lista", () => {
    expect(matches({ titulo: "Ler o README", porque: "x", passos: ["Abra o repo"] }, schema)).toBe(true);
    expect(matches({ porque: "x", passos: [] }, schema)).toBe(false);
    expect(matches({ titulo: "Ler", porque: "x", passos: "abra o repo" }, schema)).toBe(false);
  });
});
