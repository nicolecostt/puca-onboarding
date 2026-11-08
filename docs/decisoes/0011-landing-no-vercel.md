# 0011 — A landing fica no Vercel

- Data: 2026-11-08 · Quem: malu-zinha
- Status: valendo

**Contexto:** o jurado precisa de um endereço público com o comando de instalar o app para Mac (#48). O app usa o
servidor do Fly, mas a landing não precisa de servidor: é uma página estática do build do Vite.

**Decisão:** a landing é publicada no Vercel como site estático. O `vercel.json` roda `vite build` (sem `tsc`; o CI já
confere os tipos), instala sem scripts (`--ignore-scripts`, para não baixar o Electron) e serve
`src/screens/landing/` na raiz do site. As outras telas também vão no build, mas só a landing é divulgada.

**Consequências:** sem chave nem variável de ambiente no Vercel. O deploy é pelo `npx vercel deploy --prod` na pasta
do projeto, ou pela integração com o GitHub, se o repositório for conectado ao projeto no Vercel.
