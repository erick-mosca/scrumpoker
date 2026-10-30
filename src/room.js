import Peer from 'peerjs'
import { PEER_PREFIX, createRoomCode } from './constants.js'

/**
 * Host-centric room: host owns canonical state and broadcasts to guests.
 */
export function createRoomSession({
  mode,
  roomCode: existingCode,
  playerName,
  onState,
  onStatus,
  onError,
}) {
  const roomCode = (existingCode || createRoomCode()).toUpperCase()
  const isHost = mode === 'host'
  let peer = null
  let hostConn = null
  const guestConns = new Map()
  let myId = null
  let destroyed = false

  /** @type {{ roomCode: string, story: string, revealed: boolean, players: Array<{id:string,name:string,vote:string|null,isHost:boolean}> }} */
  let state = {
    roomCode,
    story: '',
    revealed: false,
    players: [],
  }

  function emitState() {
    onState?.({ ...state, players: state.players.map((p) => ({ ...p })) })
  }

  function setStatus(message, kind = 'info') {
    onStatus?.({ message, kind })
  }

  function broadcast() {
    const payload = { type: 'state', state }
    for (const conn of guestConns.values()) {
      if (conn.open) conn.send(payload)
    }
    emitState()
  }

  function upsertPlayer(id, name, isHostFlag) {
    const existing = state.players.find((p) => p.id === id)
    if (existing) {
      existing.name = name || existing.name
      return
    }
    state.players.push({
      id,
      name: name || 'Anônimo',
      vote: null,
      isHost: Boolean(isHostFlag),
    })
  }

  function removePlayer(id) {
    state.players = state.players.filter((p) => p.id !== id)
  }

  function handleHostAction(action) {
    if (!isHost) {
      if (hostConn?.open) hostConn.send(action)
      return
    }

    switch (action.type) {
      case 'join':
        upsertPlayer(action.playerId, action.name, false)
        broadcast()
        break
      case 'vote': {
        const player = state.players.find((p) => p.id === action.playerId)
        if (player && !state.revealed) {
          player.vote = action.value
          broadcast()
        }
        break
      }
      case 'leave':
        removePlayer(action.playerId)
        broadcast()
        break
      default:
        break
    }
  }

  function hostCommands(command) {
    if (!isHost) return

    switch (command.type) {
      case 'reveal':
        state.revealed = true
        broadcast()
        break
      case 'reset':
        state.revealed = false
        state.players = state.players.map((p) => ({ ...p, vote: null }))
        broadcast()
        break
      case 'story':
        state.story = command.story ?? ''
        broadcast()
        break
      case 'kick':
        removePlayer(command.playerId)
        broadcast()
        break
      default:
        break
    }
  }

  function vote(value) {
    if (!myId || state.revealed) return
    if (isHost) {
      const me = state.players.find((p) => p.id === myId)
      if (me) {
        me.vote = value
        broadcast()
      }
    } else {
      handleHostAction({ type: 'vote', playerId: myId, value })
      // optimistic
      const me = state.players.find((p) => p.id === myId)
      if (me) {
        me.vote = value
        emitState()
      }
    }
  }

  function setStory(story) {
    if (isHost) hostCommands({ type: 'story', story })
  }

  function reveal() {
    if (isHost) hostCommands({ type: 'reveal' })
  }

  function resetVotes() {
    if (isHost) hostCommands({ type: 'reset' })
  }

  function wireGuestConnection(conn) {
    conn.on('open', () => {
      guestConns.set(conn.peer, conn)
      setStatus('Alguém entrou na sala', 'ok')
    })
    conn.on('data', (data) => {
      if (!data?.type) return
      handleHostAction({ ...data, playerId: data.playerId || conn.peer })
    })
    conn.on('close', () => {
      guestConns.delete(conn.peer)
      removePlayer(conn.peer)
      broadcast()
    })
    conn.on('error', () => {
      guestConns.delete(conn.peer)
    })
  }

  function start() {
    setStatus('Conectando…', 'info')

    if (isHost) {
      peer = new Peer(PEER_PREFIX + roomCode, {
        debug: 0,
      })
    } else {
      peer = new Peer({ debug: 0 })
    }

    peer.on('open', (id) => {
      if (destroyed) return
      myId = id

      if (isHost) {
        upsertPlayer(id, playerName, true)
        setStatus('Sala pronta — compartilhe o código', 'ok')
        emitState()
      } else {
        setStatus('Entrando na sala…', 'info')
        hostConn = peer.connect(PEER_PREFIX + roomCode, { reliable: true })

        hostConn.on('open', () => {
          hostConn.send({ type: 'join', name: playerName, playerId: myId })
          setStatus('Conectado', 'ok')
        })

        hostConn.on('data', (data) => {
          if (data?.type === 'state' && data.state) {
            state = data.state
            emitState()
          }
        })

        hostConn.on('close', () => {
          setStatus('Host desconectou. Peça para recriar a sala.', 'error')
          onError?.('host-closed')
        })

        hostConn.on('error', () => {
          setStatus('Não foi possível conectar. Confira o código.', 'error')
          onError?.('connect-failed')
        })
      }
    })

    if (isHost) {
      peer.on('connection', (conn) => {
        wireGuestConnection(conn)
      })
    }

    peer.on('error', (err) => {
      const msg = String(err?.type || err?.message || err)
      if (msg.includes('unavailable-id') || msg.includes('ID is taken')) {
        onError?.('room-taken')
        setStatus('Esse código já está em uso. Crie outra sala.', 'error')
        return
      }
      if (msg.includes('peer-unavailable') || msg.includes('Could not connect')) {
        setStatus('Sala não encontrada. Confira o código e se o host está online.', 'error')
        onError?.('room-missing')
        return
      }
      setStatus(`Erro de conexão: ${msg}`, 'error')
      onError?.(msg)
    })
  }

  function destroy() {
    destroyed = true
    if (isHost && myId) {
      // nothing — guests will see close
    } else if (hostConn?.open && myId) {
      try {
        hostConn.send({ type: 'leave', playerId: myId })
      } catch {
        /* ignore */
      }
    }
    try {
      hostConn?.close()
    } catch {
      /* ignore */
    }
    for (const conn of guestConns.values()) {
      try {
        conn.close()
      } catch {
        /* ignore */
      }
    }
    try {
      peer?.destroy()
    } catch {
      /* ignore */
    }
  }

  return {
    start,
    destroy,
    vote,
    setStory,
    reveal,
    resetVotes,
    get isHost() {
      return isHost
    },
    get roomCode() {
      return roomCode
    },
    get myId() {
      return myId
    },
    getInviteUrl() {
      const url = new URL(window.location.href)
      url.hash = `join/${roomCode}`
      return url.toString()
    },
  }
}
