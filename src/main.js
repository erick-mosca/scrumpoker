import './style.css'
import { renderLobby, renderRoom } from './ui.js'
import { createRoomSession } from './room.js'

const app = document.querySelector('#app')
const NAME_KEY = 'scrum-poker-name'
const ROLE_KEY = 'scrum-poker-role'

/** @type {'lobby' | 'room'} */
let view = 'lobby'
/** @type {ReturnType<typeof createRoomSession> | null} */
let session = null
/** @type {any} */
let roomState = null
/** @type {{ message: string, kind: string } | null} */
let status = null
let selectedVote = null
let resuming = false

function savedName() {
  return localStorage.getItem(NAME_KEY) || ''
}

function parseHash() {
  const hash = window.location.hash.replace(/^#/, '')
  const join = hash.match(/^join\/([A-Za-z0-9]{3,8})$/i)
  if (join) return { action: 'join', code: join[1].toUpperCase() }
  const host = hash.match(/^room\/([A-Za-z0-9]{3,8})$/i)
  if (host) return { action: 'host', code: host[1].toUpperCase() }
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
    if (e.key === 'Enter') {
      const code = String(codeInput?.value || '').trim()
      if (code) joinBtn?.click()
      else createBtn?.click()
    }
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
  sessionStorage.setItem(ROLE_KEY, mode)
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
    onError: (code) => {
      if (code === 'room-missing' || code === 'room-taken' || code === 'connect-failed') {
        session?.destroy()
        session = null
        roomState = null
        view = 'lobby'
        sessionStorage.removeItem(ROLE_KEY)
        paint()
      }
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
  resuming = false
  sessionStorage.removeItem(ROLE_KEY)
  window.location.hash = ''
  paint()
}

function tryResume() {
  const boot = parseHash()
  const name = savedName()
  if (!boot.action || !boot.code) return false

  if (!name) {
    status = {
      message: 'Digite seu nome para voltar à sala.',
      kind: 'info',
    }
    return false
  }

  resuming = true
  if (boot.action === 'host') {
    enterRoom({ mode: 'host', playerName: name, roomCode: boot.code })
    return true
  }

  enterRoom({ mode: 'guest', playerName: name, roomCode: boot.code })
  return true
}

window.addEventListener('hashchange', () => {
  if (view === 'lobby' && !resuming) paint()
})

window.addEventListener('beforeunload', () => {
  session?.destroy()
})

// Boot — reenter room from URL when possible
status = null
view = 'lobby'
if (!tryResume()) {
  paint()
}
