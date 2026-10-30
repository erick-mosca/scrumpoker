# Scrum Poker

App de Planning Poker no navegador: crie uma sala, compartilhe o código (ou o link) e estime stories em Fibonacci com o time.

Feito com **Vite + Node** no build e deploy estático — funciona no **GitHub Pages**.

## Como usar

1. Abra o site e digite seu nome.
2. **Criar sala** (você vira o host) ou **Entrar** com o código.
3. Cada pessoa escolhe uma carta.
4. O host clica em **Revelar votos** e depois **Nova rodada**.

> O host precisa manter a aba aberta: a sincronização é peer-to-peer (PeerJS). Não há servidor próprio nem login.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

## Publicar no GitHub Pages

### Opção A — Actions (recomendada)

1. Crie um repositório no GitHub e faça push deste projeto.
2. Em **Settings → Pages → Build and deployment**, escolha **GitHub Actions**.
3. No push para `main`/`master`, o workflow `.github/workflows/deploy.yml` publica o site.

URL típica: `https://SEU_USUARIO.github.io/scrum/`

### Opção B — branch `gh-pages`

```bash
npm install
npm run deploy
```

Depois, em **Settings → Pages**, selecione a branch `gh-pages` / pasta `/ (root)`.

## Stack

- Vite (vanilla JS)
- PeerJS (salas em tempo real sem backend)
- GitHub Pages
