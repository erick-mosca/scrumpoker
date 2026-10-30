import './style.css'
import { renderLobby, renderRoom } from './ui.js'
import { createRoomSession } from './room.js'

const app = document.querySelector('#app')
const NAME_KEY = 'scrum-poker-name'

/** @type {'lobby' | 'room'} */
let view = 'lobby'
/** @type {ReturnType<typeof createRoomSession> | null} */
let session = null
/** @type {any} */
let roomState = null
/** @type {{ message: string, kind: string } | null} */
let status = null
let selectedVote = null

function savedName() {
  return localStorage.getItem(NAME_KEY) || ''
}

function parseHash() {
  const hash = window.location.hash.replace(/^#/, '')
  const join = hash.match(/^join\/([A-Za-z0-9]{3,8})$/)
  if (join) return { action: 'join', code: join[1].toUpperCase() }
  return { action: null, code: '' }
}

function setStatus(next) {
  status = next
  paint()
}

function paint() {
  if (view === 'lobby') {
    const { code } = parseHash()
    renderLobby(app, {
      defaultName: savedName(),
      defaultCode: code,
      status,
    })
    bindLobby()
    return
  }

  if (!roomState || !session) return

  renderRoom(app, {
    state: roomState,
    myId: session.myId,
    isHost: session.isHost,
    status,
    selectedVote,
  })
  bindRoom()
}

function bindLobby() {
  const nameInput = app.querySelector('#player-name')
  const codeInput = app.querySelector('#room-code')
  const createBtn = app.querySelector('#btn-create')
  const joinBtn = app.querySelector('#btn-join')

  const readName = () => {
    const name = String(nameInput?.value || '').trim()
    if (!name) {
      setStatus({ message: 'Digite seu nome para continuar.', kind: 'error' })
      return null
    }
    localStorage.setItem(NAME_KEY, name)
    return name
  }

  createBtn?.addEventListener('click', () => {
    const name = readName()
    if (!name) return
    enterRoom({ mode: 'host', playerName: name })
  })

  joinBtn?.addEventListener('click', () => {
    const name = readName()
    if (!name) return
    const code = String(codeInput?.value || '')
      .trim()
      .toUpperCase()
    if (code.length < 3) {
      setStatus({ message: 'Informe o código da sala.', kind: 'error' })
      return
    }
    enterRoom({ mode: 'guest', playerName: name, roomCode: code })
  })

  codeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinBtn?.click()
  })
  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createBtn?.click()
  })
}

function bindRoom() {
  app.querySelectorAll('[data-vote]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-vote')
      selectedVote = value
      session?.vote(value)
      paint()
    })
  })

  app.querySelector('#btn-reveal')?.addEventListener('click', () => {
    session?.reveal()
  })

  app.querySelector('#btn-reset')?.addEventListener('click', () => {
    selectedVote = null
    session?.resetVotes()
  })

  const storyInput = app.querySelector('#story-input')
  let storyTimer = null
  storyInput?.addEventListener('input', () => {
    clearTimeout(storyTimer)
    storyTimer = setTimeout(() => {
      session?.setStory(storyInput.value)
    }, 200)
  })

  app.querySelector('#btn-copy')?.addEventListener('click', async () => {
    const url = session?.getInviteUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setStatus({ message: 'Link copiado!', kind: 'ok' })
    } catch {
      setStatus({ message: `Link: ${url}`, kind: 'info' })
    }
  })

  app.querySelector('#btn-leave')?.addEventListener('click', () => {
    leaveRoom()
  })
}

function enterRoom({ mode, playerName, roomCode }) {
  session?.destroy()
  selectedVote = null
  status = { message: 'Conectando…', kind: 'info' }
  view = 'room'
  roomState = {
    roomCode: roomCode || '····',
    story: '',
    revealed: false,
    players: [],
  }

  session = createRoomSession({
    mode,
    roomCode,
    playerName,
    onState: (state) => {
      roomState = state
      if (mode === 'guest') {
        window.location.hash = `join/${state.roomCode}`
      } else {
        window.location.hash = `room/${state.roomCode}`
      }
      paint()
    },
    onStatus: (s) => {
      status = s
      paint()
    },
    onError: () => {
      /* status already set */
    },
  })

  paint()
  session.start()
}

function leaveRoom() {
  session?.destroy()
  session = null
  roomState = null
  selectedVote = null
  status = null
  view = 'lobby'
  window.location.hash = ''
  paint()
}

window.addEventListener('hashchange', () => {
  if (view === 'lobby') paint()
})

window.addEventListener('beforeunload', () => {
  session?.destroy()
})

// Boot
const boot = parseHash()
status = null
view = 'lobby'
paint()

if (boot.action === 'join' && savedName()) {
  // Prefill only; user clicks Entrar so Peer connects after gesture (more reliable on mobile)
}
