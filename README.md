# FocusQuest RPG ⚔️🧠

[![Netlify Status](https://api.netlify.com/api/v1/badges/d60ca84f-1c6f-4fd1-9599-4536ba7d4fde/deploy-status?branch=main)](https://app.netlify.com/projects/focusquest-rpg-tdah/deploys)

**Live Demo:** [https://focusquest-rpg-tdah.netlify.app](https://focusquest-rpg-tdah.netlify.app)

Um gerenciador de foco e tarefas gamificado em estilo RPG, desenhado especificamente para mentes neurodivergentes e pessoas com TDAH — focado em **dopamina imediata**, **micro-passos anti-paralisia** e **zero punição**.

## ✨ Principais Recursos

- **🔐 Login e Cadastro com Passkeys (WebAuthn / FIDO2):** Crie conta e entre com Touch ID, Face ID, Windows Hello ou chave de segurança sem precisar decorar senhas — com tela completa para gerenciar múltiplas Passkeys (adicionar, renomear, remover) e senha opcional de recuperação.
- **☁️ Persistência na Nuvem (Neon PostgreSQL + Netlify Functions):** Todo o progresso (nível, XP, moedas, missões, Brain Dump e recompensas) é salvo automaticamente no PostgreSQL, com importação em 1 clique caso exista progresso antigo salvo no `localStorage`.
- **🐉 Batalhas contra Chefões (Boss Quests):** Quebre tarefas grandes e assustadoras em micro-passos fáceis. Cada micro-passo concluído drena o HP do Boss e gera XP e moedas na hora.
- **🔥 Multiplicador de Combo (Modo On Fire):** Conclua ações dentro de 30 minutos para aumentar seu multiplicador de `1.0x` até `3.0x`. Se fizer uma pausa longa, o combo apenas volta para `1.0x` sem nenhuma perda de XP ou moedas.
- **🎯 Modo Túnel (Hiperfoco):** Isole apenas um único micro-passo na tela inteira para eliminar sobrecarga visual, com cronômetro flexível (Livre, Sprint 15m ou Pomodoro 25m).
- **🧠 Brain Dump (Bloco de Despejo):** Estacione pensamentos aleatórios e distrações em 3 segundos para não perder o foco atual e converta-os em missões depois com 1 clique.
- **🎁 Loja de Recompensas do Mundo Real:** Use as moedas conquistadas para resgatar pausas reais (redes sociais, café, videogame, série) 100% livre de culpa.

## 🚀 Como Rodar Localmente

1. Crie um banco gratuito no [Neon PostgreSQL](https://neon.tech) e copie a connection string (`DATABASE_URL`).
2. Copie o arquivo de exemplo de variáveis de ambiente (nunca commite o `.env` no Git):

```bash
cp .env.example .env
```

3. Preencha `DATABASE_URL` no seu `.env`. As tabelas definidas em [`db/schema.sql`](db/schema.sql) são criadas automaticamente na primeira requisição da API.
4. Instale as dependências e inicie o servidor de desenvolvimento (o Vite já monta as rotas `/api/*` localmente na mesma porta `http://localhost:5173`, compatível com Passkeys):

```bash
npm install
npm run dev
```

## 📦 Build & Deploy na Netlify

O deploy em produção na Netlify ocorre automaticamente via **GitHub Actions** a cada push na branch `main`.

Antes do primeiro uso em produção, configure as seguintes **Environment Variables** no painel da Netlify (**Site configuration → Environment variables**):

- `DATABASE_URL`: Connection string do Neon PostgreSQL
- `RP_NAME` *(opcional)*: `FocusQuest RPG`
- `RP_ID` *(opcional, recomendado em prod)*: `focusquest-rpg-tdah.netlify.app`
- `RP_ORIGIN` *(opcional, recomendado em prod)*: `https://focusquest-rpg-tdah.netlify.app`

```bash
npm run build
```
