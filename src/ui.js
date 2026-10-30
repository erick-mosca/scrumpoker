import { CARDS, averageLabel } from './constants.js'

function esc(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function renderLobby(root, { defaultName, defaultCode, status }) {
  root.innerHTML = `
    <div class="shell lobby">
      <header class="brand">
        <p class="brand-mark">Scrum Poker</p>
        <h1>Estime juntos.<br />Revele na hora certa.</h1>
        <p class="lede">Crie uma sala, compartilhe o código e vote em Fibonacci — tudo no navegador, sem login.</p>
      </header>

      <section class="panel" aria-label="Entrar na sala">
        <label class="field">
          <span>Seu nome</span>
          <input id="player-name" type="text" maxlength="24" placeholder="Ex.: Ana" value="${esc(defaultName)}" autocomplete="nickname" />
        </label>

        <div class="actions-split">
          <button type="button" class="btn btn-primary" id="btn-create">Criar sala</button>
          <div class="join-row">
            <input id="room-code" type="text" maxlength="6" placeholder="Código" value="${esc(defaultCode)}" autocomplete="off" spellcheck="false" />
            <button type="button" class="btn btn-secondary" id="btn-join">Entrar</button>
          </div>
        </div>

        ${status ? `<p class="status status-${status.kind}" role="status">${esc(status.message)}</p>` : ''}
      </section>

      <footer class="foot">
        <p>Host precisa manter a aba aberta. Ideal para times remotos no planning.</p>
      </footer>
    </div>
  `
}

export function renderRoom(root, { state, myId, isHost, status, selectedVote }) {
  const votes = state.players.map((p) => p.vote).filter(Boolean)
  const votedCount = state.players.filter((p) => p.vote != null).length
  const avg = state.revealed ? averageLabel(votes) : '—'

  root.innerHTML = `
    <div class="shell room">
      <header class="room-top">
        <div>
          <p class="brand-mark compact">Scrum Poker</p>
          <p class="room-code-line">Sala <strong id="code-display">${esc(state.roomCode)}</strong></p>
        </div>
        <div class="room-top-actions">
          <button type="button" class="btn btn-ghost" id="btn-copy">Copiar link</button>
          <button type="button" class="btn btn-ghost" id="btn-leave">Sair</button>
        </div>
      </header>

      <section class="story-block">
        ${
          isHost
            ? `<label class="field">
                <span>O que estamos estimando?</span>
                <input id="story-input" type="text" maxlength="120" placeholder="Ex.: Login com SSO" value="${esc(state.story)}" />
              </label>`
            : `<p class="story-readonly">${state.story ? esc(state.story) : 'Aguardando o host definir a story…'}</p>`
        }
      </section>

      <section class="board" aria-live="polite">
        <div class="board-meta">
          <span>${votedCount}/${state.players.length} votaram</span>
          <span class="avg">Média: <strong>${esc(avg)}</strong></span>
        </div>
        <ul class="players">
          ${state.players
            .map((p) => {
              const mine = p.id === myId
              let face = '…'
              if (!p.vote) face = '—'
              else if (state.revealed) face = p.vote
              else face = '✓'
              return `
                <li class="player-card ${mine ? 'is-me' : ''} ${p.vote ? 'has-vote' : ''} ${state.revealed ? 'is-revealed' : ''}">
                  <span class="player-vote">${esc(face)}</span>
                  <span class="player-name">${esc(p.name)}${p.isHost ? ' · host' : ''}${mine ? ' · você' : ''}</span>
                </li>
              `
            })
            .join('')}
        </ul>
      </section>

      <section class="deck" aria-label="Cartas">
        <div class="deck-grid">
          ${CARDS.map(
            (c) => `
            <button type="button" class="card ${selectedVote === c ? 'is-selected' : ''} ${state.revealed ? 'is-disabled' : ''}" data-vote="${esc(c)}" ${state.revealed ? 'disabled' : ''}>
              ${esc(c)}
            </button>
          `,
          ).join('')}
        </div>
      </section>

      ${
        isHost
          ? `<div class="host-bar">
              <button type="button" class="btn btn-primary" id="btn-reveal" ${state.revealed ? 'disabled' : ''}>Revelar votos</button>
              <button type="button" class="btn btn-secondary" id="btn-reset">Nova rodada</button>
            </div>`
          : `<p class="guest-hint">${state.revealed ? 'Votos revelados. Aguarde a próxima rodada.' : 'Escolha uma carta. O host revela quando todos votarem.'}</p>`
      }

      ${status ? `<p class="status status-${status.kind}" role="status">${esc(status.message)}</p>` : ''}
    </div>
  `
}
