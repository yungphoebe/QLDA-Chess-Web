import { useState, useEffect } from 'react'
import Auth from './Auth.jsx'
import Lobby from './Lobby.jsx'
import Game from './Game.jsx'
import SavedGamesModal from './SavedGamesModal.jsx'
import OnlineInvitationModal from './OnlineInvitationModal.jsx'
import { socket } from './socket.js'

function getInitialRoom() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  let roomParam = params.get('room')
  if (!roomParam) {
    const matchPath = window.location.pathname.match(/\/room\/([A-Za-z0-9]+)/)
    if (matchPath) roomParam = matchPath[1]
  }
  return roomParam ? { mode: 'online', roomId: roomParam.toUpperCase(), action: 'join' } : null
}

export default function App() {
  const initialRoom = getInitialRoom()
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('auth_user')
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed?.user || null
      }
    } catch {}
    return null
  })

  const [match, setMatch] = useState(initialRoom)
  const [playing, setPlaying] = useState(Boolean(initialRoom && user))
  const [showSavedModal, setShowSavedModal] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [incomingInvitation, setIncomingInvitation] = useState(null)

  // 2. Kết nối Socket.IO toàn cục để theo dõi người online và nhận lời mời
  useEffect(() => {
    if (!user) return

    socket.emit('register_online', { username: user.username })

    function onOnlineUpdated(list) {
      setOnlineUsers(list || [])
    }

    function onInvitation(invitation) {
      setIncomingInvitation(invitation)
    }

    function onInvitationResponse({ respondent, accept }) {
      if (!accept) {
        alert(`${respondent} đã từ chối lời mời chơi.`)
      }
    }

    socket.on('online_users_updated', onOnlineUpdated)
    socket.on('game_invitation', onInvitation)
    socket.on('invitation_response', onInvitationResponse)

    return () => {
      socket.off('online_users_updated', onOnlineUpdated)
      socket.off('game_invitation', onInvitation)
      socket.off('invitation_response', onInvitationResponse)
    }
  }, [user])

  // Xử lý gửi lời mời chơi cho người khác
  function handleInviteUser(targetUsername, existingRoomId) {
    if (existingRoomId) {
      socket.emit('invite_player', {
        targetUsername,
        roomId: existingRoomId,
        fromUsername: user.username,
      })
    } else {
      // Tạo phòng mới rồi gửi lời mời
      socket.emit('create_room', { username: user.username, preferredColor: 'r' }, (res) => {
        if (res?.roomId) {
          socket.emit('invite_player', {
            targetUsername,
            roomId: res.roomId,
            fromUsername: user.username,
          })
          setMatch({ mode: 'online', roomId: res.roomId, action: 'join' })
          setPlaying(true)
        }
      })
    }
  }

  // Chấp nhận lời mời chơi
  function handleAcceptInvitation() {
    if (!incomingInvitation) return
    const roomId = incomingInvitation.roomId
    socket.emit('respond_invitation', {
      fromUsername: incomingInvitation.fromUsername,
      roomId,
      accept: true,
      respondent: user.username,
    })
    setIncomingInvitation(null)
    setMatch({ mode: 'online', roomId, action: 'join' })
    setPlaying(true)
  }

  // Từ chối lời mời
  function handleDeclineInvitation() {
    if (!incomingInvitation) return
    socket.emit('respond_invitation', {
      fromUsername: incomingInvitation.fromUsername,
      roomId: incomingInvitation.roomId,
      accept: false,
      respondent: user.username,
    })
    setIncomingInvitation(null)
  }

  // Tải lại ván cờ đã lưu
  function handleLoadSavedGame(savedGame) {
    setMatch({
      mode: savedGame.mode || 'pvp',
      level: savedGame.level || 'medium',
      savedGame,
    })
    setPlaying(true)
  }

  function handleLogout() {
    localStorage.removeItem('auth_user')
    setUser(null)
    setMatch(null)
    setPlaying(false)
  }

  if (!user) {
    return (
      <Auth
        onLogin={(loggedUser) => {
          setUser(loggedUser)
          // Nếu có mã phòng chờ sẵn từ URL, vào thẳng trận
          if (match?.roomId) {
            setPlaying(true)
          }
        }}
      />
    )
  }

  return (
    <>
      {!playing ? (
        <Lobby
          user={user}
          initial={match}
          onlineUsers={onlineUsers}
          onPlay={(m) => {
            setMatch(m)
            setPlaying(true)
          }}
          onLogout={handleLogout}
          onOpenSavedGames={() => setShowSavedModal(true)}
          onInviteUser={handleInviteUser}
        />
      ) : (
        <Game
          {...match}
          user={user}
          onlineUsers={onlineUsers}
          onExit={() => {
            setPlaying(false)
            // Xóa query param trên url nếu có
            if (window.location.search.includes('room=')) {
              window.history.replaceState({}, document.title, window.location.pathname)
            }
          }}
          onInviteUser={handleInviteUser}
        />
      )}

      {/* Modal xem danh sách ván đã lưu */}
      {showSavedModal && (
        <SavedGamesModal
          user={user}
          onClose={() => setShowSavedModal(false)}
          onLoadGame={handleLoadSavedGame}
        />
      )}

      {/* Modal thông báo nhận lời mời đấu online */}
      {incomingInvitation && (
        <OnlineInvitationModal
          invitation={incomingInvitation}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
        />
      )}
    </>
  )
}
