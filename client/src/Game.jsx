import { useEffect, useRef, useState } from 'react'
import Board from './Board.jsx'
import ChatBox from './ChatBox.jsx'
import ShareModal from './ShareModal.jsx'
import { socket } from './socket.js'
import { saveGame as apiSaveGame } from './api.js'
import { initialBoard, legalMoves, makeMove, inCheck, notation, other } from './xiangqi.js'

export const LEVELS = {
  easy: { label: 'Nhập môn', depth: 1 },
  medium: { label: 'Trung cấp', depth: 3 },
  hard: { label: 'Cao thủ', depth: 4 },
}

const NAME = { r: 'Đỏ', b: 'Đen' }

const play = (board, move) => ({
  board: makeMove(board, move),
  move: { ...move, captured: board[move.to] },
  text: notation(board, move),
})

export default function Game({
  user,
  mode,
  level = 'medium',
  roomId: initialRoomId = null,
  preferredColor = 'r',
  action = 'create',
  savedGame = null,
  onlineUsers = [],
  onExit,
  onInviteUser,
}) {
  // Trạng thái thế cờ và lịch sử
  const [history, setHistory] = useState(
    savedGame?.history && savedGame.history.length > 0
      ? savedGame.history
      : [{ board: savedGame?.board || initialBoard() }]
  )
  const [selected, setSelected] = useState(null)
  const [hideResult, setHideResult] = useState(false)
  const [toast, setToast] = useState('')
  const [sideTab, setSideTab] = useState('notation') // 'notation' | 'chat'
  const [showShare, setShowShare] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Online states
  const [currentRoomId, setCurrentRoomId] = useState(initialRoomId)
  const [roomState, setRoomState] = useState(null)
  const [myRole, setMyRole] = useState(null) // 'r' | 'b' | 'spectator'
  const [drawPrompt, setDrawPrompt] = useState(null) // { from }
  const [disconnectWarning, setDisconnectWarning] = useState('')

  const worker = useRef(null)
  const onExitRef = useRef(onExit)
  useEffect(() => {
    onExitRef.current = onExit
  }, [onExit])

  // Dữ liệu từ phần tử cuối của history
  const currentStep = history.at(-1) || { board: initialBoard() }
  const board = currentStep.board
  const lastMove = currentStep.move

  // Xác định lượt đi
  const turn = mode === 'online' ? roomState?.turn || 'r' : history.length % 2 ? 'r' : 'b'
  const moves = legalMoves(board, turn)
  const isCheck = inCheck(board, turn)
  const over = mode === 'online' ? Boolean(roomState?.over) : !moves.length
  const aiThinking = mode === 'ai' && turn === 'b' && !over

  // Cho phép đi cờ nếu:
  // - Mode AI/PvP: lượt của người (với AI: r, với PvP: r hoặc b)
  // - Mode Online: phòng đang chơi, không over, và đúng lượt của myRole ('r' hoặc 'b')
  const canMove =
    !over &&
    (mode === 'online'
      ? roomState?.status === 'playing' && myRole === turn
      : mode === 'ai'
      ? turn === 'r' && !aiThinking
      : true)

  const targets = selected === null || !canMove ? [] : moves.filter((m) => m.from === selected).map((m) => m.to)

  function showToastMsg(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ---------------- Chế độ Đấu với Máy (AI) ----------------
  useEffect(() => {
    if (mode !== 'ai') return
    worker.current = new Worker(new URL('./aiWorker.js', import.meta.url), { type: 'module' })
    return () => worker.current?.terminate()
  }, [mode])

  useEffect(() => {
    if (mode !== 'ai' || !aiThinking) return
    worker.current.onmessage = ({ data: move }) => {
      setHistory((prev) => (prev.at(-1).board === board ? [...prev, play(board, move)] : prev))
    }
    worker.current.postMessage({ board, color: 'b', depth: LEVELS[level]?.depth || 3 })
  }, [mode, aiThinking, board, level])

  // ---------------- Chế độ Đấu Online (Socket.IO) ----------------
  useEffect(() => {
    if (mode !== 'online') return

    // 1. Tham gia hoặc Tạo phòng
    if (action === 'create' && !currentRoomId) {
      socket.emit('create_room', { username: user.username, preferredColor }, (res) => {
        if (res?.roomId) {
          setCurrentRoomId(res.roomId)
          socket.emit('join_room', { roomId: res.roomId, username: user.username })
        }
      })
    } else if (currentRoomId) {
      socket.emit('join_room', { roomId: currentRoomId, username: user.username })
    }

    // 2. Lắng nghe các sự kiện socket
    function onRoomJoined({ room, role, isReconnect }) {
      setRoomState(room)
      setMyRole(role)
      setCurrentRoomId(room.id)
      if (room.history && room.history.length > 0) {
        setHistory(room.history)
      }
      if (isReconnect) {
        showToastMsg('Đã kết nối lại vào ván cờ!')
      }
    }

    function onRoomUpdated(updatedRoom) {
      setRoomState({ ...updatedRoom })
      if (updatedRoom.history && updatedRoom.history.length > 0) {
        setHistory(updatedRoom.history)
      }
    }

    function onMoveMade({ room, step }) {
      setRoomState({ ...room })
      setHistory((prev) => [...prev, step])
    }

    function onNewChat(msg) {
      setRoomState((prev) => (prev ? { ...prev, chats: [...(prev.chats || []), msg] } : prev))
    }

    function onPlayerDisconnected({ username, message }) {
      setDisconnectWarning(message || `${username} đã mất kết nối...`)
    }

    function onPlayerReconnected({ username, message }) {
      setDisconnectWarning('')
      showToastMsg(message || `${username} đã kết nối lại!`)
    }

    function onDrawOffered({ from }) {
      setDrawPrompt({ from })
    }

    function onMoveError({ message }) {
      showToastMsg(`Lỗi nước đi: ${message}`)
    }

    function onJoinError({ message }) {
      alert(`Không thể vào phòng: ${message}`)
      onExitRef.current?.()
    }

    socket.on('room_joined', onRoomJoined)
    socket.on('room_updated', onRoomUpdated)
    socket.on('move_made', onMoveMade)
    socket.on('new_chat', onNewChat)
    socket.on('player_disconnected', onPlayerDisconnected)
    socket.on('player_reconnected', onPlayerReconnected)
    socket.on('draw_offered', onDrawOffered)
    socket.on('move_error', onMoveError)
    socket.on('join_error', onJoinError)

    return () => {
      socket.off('room_joined', onRoomJoined)
      socket.off('room_updated', onRoomUpdated)
      socket.off('move_made', onMoveMade)
      socket.off('new_chat', onNewChat)
      socket.off('player_disconnected', onPlayerDisconnected)
      socket.off('player_reconnected', onPlayerReconnected)
      socket.off('draw_offered', onDrawOffered)
      socket.off('move_error', onMoveError)
      socket.off('join_error', onJoinError)
      if (currentRoomId) {
        socket.emit('leave_room', { roomId: currentRoomId, username: user.username })
      }
    }
  }, [mode, action, currentRoomId, preferredColor, user.username])

  // Click vào ô trên bàn cờ
  function onSquareClick(i) {
    if (!canMove) return

    if (targets.includes(i)) {
      const move = { from: selected, to: i }

      if (mode === 'online') {
        // Gửi nước đi lên server Socket.IO (Server sẽ kiểm tra hợp lệ bằng xiangqi.js)
        socket.emit('make_move', {
          roomId: currentRoomId,
          username: user.username,
          move,
        })
      } else {
        // Offline / AI / PvP
        setHistory([...history, play(board, move)])
      }
      setSelected(null)
    } else {
      setSelected(moves.some((m) => m.from === i) ? i : null)
    }
  }

  // Gửi tin nhắn chat
  function handleSendMessage(text) {
    if (mode === 'online' && currentRoomId) {
      socket.emit('send_chat', {
        roomId: currentRoomId,
        username: user.username,
        text,
      })
    }
  }

  // Cầu hòa (Online)
  function handleOfferDraw() {
    if (mode === 'online' && currentRoomId) {
      if (window.confirm('Bạn có muốn gửi lời xin hòa tới đối thủ?')) {
        socket.emit('offer_draw', { roomId: currentRoomId, username: user.username })
        showToastMsg('Đã gửi lời xin hòa tới đối thủ')
      }
    }
  }

  // Trả lời cầu hòa
  function handleRespondDraw(accept) {
    if (mode === 'online' && currentRoomId) {
      socket.emit('respond_draw', { roomId: currentRoomId, username: user.username, accept })
      setDrawPrompt(null)
    }
  }

  // Đầu hàng
  function handleResign() {
    if (window.confirm('Bạn có chắc chắn muốn đầu hàng không?')) {
      if (mode === 'online' && currentRoomId) {
        socket.emit('resign', { roomId: currentRoomId, username: user.username })
      } else {
        // Cho offline: kết thúc ván
        setHideResult(false)
      }
    }
  }

  // Lưu ván cờ vào MongoDB qua API
  async function handleSaveCurrentGame() {
    try {
      const redName =
        mode === 'online'
          ? roomState?.redPlayer?.username || 'Đỏ'
          : user.username
      const blackName =
        mode === 'online'
          ? roomState?.blackPlayer?.username || 'Đen'
          : mode === 'ai'
          ? `Máy (${LEVELS[level]?.label || 'Dễ'})`
          : 'Người chơi 2'

      const gamePayload = {
        _id: savedGame?._id,
        title: `Ván ${redName} vs ${blackName}`,
        mode,
        level,
        roomId: currentRoomId || '',
        redPlayer: { username: redName },
        blackPlayer: { username: blackName },
        board,
        history,
        turn,
        status: over ? 'finished' : 'playing',
        winner: mode === 'online' ? roomState?.winner : over ? other(turn) : null,
        reason: mode === 'online' ? roomState?.reason : over ? (isCheck ? 'Chiếu bí' : 'Hết nước đi') : null,
      }

      await apiSaveGame(gamePayload)
      setSaveSuccess(true)
      showToastMsg('✓ Đã lưu ván cờ vào cơ sở dữ liệu!')
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      alert(`Lỗi khi lưu ván cờ: ${err.message}`)
    }
  }

  function undo() {
    if (mode === 'online') return
    const back = mode === 'ai' && turn === 'r' && history.length > 2 ? 2 : 1
    setHistory(history.slice(0, -back))
    setSelected(null)
    setHideResult(false)
  }

  function restart() {
    if (mode === 'online') return
    setHistory([{ board: initialBoard() }])
    setSelected(null)
    setHideResult(false)
  }

  const texts = history.slice(1).map((h) => h.text)

  // Thông tin người chơi hiển thị
  let redPlayerInfo = { name: user.username, avatar: '帥' }
  let blackPlayerInfo = {
    name: mode === 'ai' ? `Máy · ${LEVELS[level]?.label}` : 'Người chơi 2',
    avatar: mode === 'ai' ? '🤖' : '將',
  }

  if (mode === 'online') {
    redPlayerInfo = {
      name: roomState?.redPlayer?.username || 'Đang chờ...',
      avatar: '帥',
      connected: roomState?.redPlayer?.connected ?? true,
    }
    blackPlayerInfo = {
      name: roomState?.blackPlayer?.username || 'Đang chờ...',
      avatar: '將',
      connected: roomState?.blackPlayer?.connected ?? true,
    }
  }

  const isOnlineWaiting = mode === 'online' && roomState?.status === 'waiting'

  // Trạng thái hiển thị
  let statusText = `Lượt ${NAME[turn]}${isCheck ? ' · Đang bị chiếu!' : ''}`
  let reasonText = isCheck ? 'Chiếu bí' : 'Hết nước đi'
  let winner = mode === 'online' ? roomState?.winner : other(turn)

  if (over) {
    if (mode === 'online' && roomState?.reason) {
      reasonText = roomState.reason
    }
    if (winner === 'draw') {
      statusText = `Ván cờ kết thúc: Hòa cờ (${reasonText})`
    } else {
      statusText = `${reasonText}! ${NAME[winner] || ''} thắng`
    }
  } else if (aiThinking) {
    statusText = 'Máy đang suy nghĩ...'
  } else if (isOnlineWaiting) {
    statusText = 'Đang chờ đối thủ tham gia phòng...'
  }

  const victory = mode === 'online' ? winner === myRole : mode !== 'ai' || winner === 'r'
  const resultTitle =
    winner === 'draw'
      ? 'Hòa cờ'
      : mode === 'online'
      ? victory
        ? 'Chiến thắng!'
        : 'Thất bại!'
      : mode === 'ai'
      ? victory
        ? 'Chiến thắng'
        : 'Thất bại'
      : `${NAME[winner]} thắng`

  const renderPlayer = (color) => {
    const info = color === 'r' ? redPlayerInfo : blackPlayerInfo
    const isActive = turn === color && !over && !isOnlineWaiting
    const isMe = mode === 'online' && myRole === color

    return (
      <div className={`player ${color} ${isActive ? 'active' : ''}`}>
        <span className="avatar">{info.avatar}</span>
        <div className="player-meta">
          <span className="player-name">
            {info.name} {isMe && <span className="you-badge">(Bạn)</span>}
          </span>
          <span className="player-side">Quân {NAME[color]}</span>
        </div>
        {isActive && <span className="player-turn">Đến lượt</span>}
        {mode === 'online' && info.connected === false && (
          <span className="player-offline-badge">Mất kết nối</span>
        )}
      </div>
    )
  }

  return (
    <div className="game">
      {/* Toast thông báo */}
      {toast && <div className="game-toast">{toast}</div>}

      <header className="game-bar">
        <div className="game-bar-left">
          <button className="btn-hex" onClick={onExit}>← Sảnh</button>
          <h1>
            {mode === 'online'
              ? `Phòng Online: ${currentRoomId || '...'}`
              : mode === 'ai'
              ? `Đấu với máy · ${LEVELS[level]?.label}`
              : '2 người 1 máy'}
          </h1>
        </div>

        <div className="game-bar-actions">
          {mode === 'online' && currentRoomId && (
            <button className="btn-hex" onClick={() => setShowShare(true)} title="Mời bạn bè vào phòng">
              🔗 Mời bạn
            </button>
          )}

          <button
            className={`btn-hex ${saveSuccess ? 'success' : ''}`}
            onClick={handleSaveCurrentGame}
            title="Lưu ván cờ vào MongoDB"
          >
            💾 {saveSuccess ? 'Đã lưu' : 'Lưu ván'}
          </button>
        </div>
      </header>

      {/* Cảnh báo mất kết nối nếu có */}
      {disconnectWarning && (
        <div className="alert-banner warning">
          ⚠️ {disconnectWarning}
        </div>
      )}

      {/* Lời xin hòa từ đối thủ */}
      {drawPrompt && (
        <div className="alert-banner prompt">
          <span>🤝 Người chơi <b>{drawPrompt.from}</b> đề nghị Hòa cờ. Bạn có đồng ý không?</span>
          <div className="prompt-actions">
            <button className="btn-hex primary btn-sm" onClick={() => handleRespondDraw(true)}>Đồng ý hòa</button>
            <button className="btn-hex btn-sm" onClick={() => handleRespondDraw(false)}>Từ chối</button>
          </div>
        </div>
      )}

      {/* Màn hình chờ khi tạo phòng online mà chưa có người thứ 2 */}
      {isOnlineWaiting && (
        <div className="online-waiting-panel">
          <div className="waiting-card">
            <span className="waiting-spinner">⏳</span>
            <h2>Đang chờ đối thủ vào phòng</h2>
            <div className="room-code-badge large">
              <span className="code-label">MÃ PHÒNG</span>
              <span className="code-value">{currentRoomId}</span>
            </div>
            <p>Hãy gửi mã phòng hoặc link mời cho bạn bè để bắt đầu trận đấu!</p>
            <div className="waiting-actions">
              <button className="btn-hex primary" onClick={() => setShowShare(true)}>
                📤 Mời bạn qua Link & MXH
              </button>
            </div>

            {/* Danh sách người online có thể mời trực tiếp từ phòng chờ */}
            {onlineUsers.filter((u) => u.username !== user.username).length > 0 && (
              <div className="waiting-online-list">
                <h4>Hoặc mời trực tiếp người chơi đang online:</h4>
                <div className="waiting-user-chips">
                  {onlineUsers
                    .filter((u) => u.username !== user.username && u.status !== 'playing')
                    .map((u) => (
                      <button
                        key={u.username}
                        type="button"
                        className="user-chip-invite"
                        onClick={() => {
                          onInviteUser(u.username, currentRoomId)
                          showToastMsg(`Đã gửi lời mời đến ${u.username}!`)
                        }}
                      >
                        ➕ Mời {u.username}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`game-layout ${isOnlineWaiting ? 'dimmed' : ''}`}>
        <div className="board-col">
          {renderPlayer('b')}
          <div className="board-frame">
            <Board
              board={board}
              selected={selected}
              targets={targets}
              lastMove={lastMove}
              onSquareClick={onSquareClick}
            />
          </div>
          {renderPlayer('r')}
        </div>

        <aside className="side">
          <p className={`status ${over ? 'over' : turn}`} aria-live="polite">
            {statusText}
          </p>

          {/* Tab chuyển đổi giữa Biên bản và Chat */}
          <div className="side-tabs">
            <button
              className={`side-tab-btn ${sideTab === 'notation' ? 'active' : ''}`}
              onClick={() => setSideTab('notation')}
            >
              Biên bản ({texts.length})
            </button>
            {mode === 'online' && (
              <button
                className={`side-tab-btn ${sideTab === 'chat' ? 'active' : ''}`}
                onClick={() => setSideTab('chat')}
              >
                Trò chuyện {roomState?.chats?.length ? `(${roomState.chats.length})` : ''}
              </button>
            )}
          </div>

          <div className="side-content">
            {sideTab === 'notation' ? (
              texts.length ? (
                <ol className="moves">
                  {Array.from({ length: Math.ceil(texts.length / 2) }, (_, i) => (
                    <li key={i}>
                      <span className="red">{texts[2 * i]}</span>
                      <span>{texts[2 * i + 1]}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="moves-empty">Đỏ đi trước. Bấm vào quân để chọn, rồi bấm điểm sáng để đi.</p>
              )
            ) : (
              <ChatBox
                chats={roomState?.chats || []}
                onSendMessage={handleSendMessage}
              />
            )}
          </div>

          <div className="side-actions">
            {mode === 'online' ? (
              <>
                <button
                  className="btn-hex"
                  onClick={handleOfferDraw}
                  disabled={over || isOnlineWaiting}
                  title="Gửi lời xin hòa tới đối thủ"
                >
                  🤝 Xin hòa
                </button>
                <button
                  className="btn-hex danger"
                  onClick={handleResign}
                  disabled={over || isOnlineWaiting}
                  title="Đầu hàng ván đấu"
                >
                  🏳️ Đầu hàng
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-hex"
                  onClick={undo}
                  disabled={history.length === 1 || aiThinking}
                >
                  Đi lại
                </button>
                <button className="btn-hex primary" onClick={restart}>
                  Ván mới
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Modal kết quả ván đấu */}
      {over && !hideResult && (
        <div className="modal result" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <h2 id="result-title" className={victory ? 'victory' : 'defeat'}>
            {resultTitle}
          </h2>
          <p>{reasonText} · {texts.length} nước đi</p>
          <div className="result-actions">
            <button className="btn-hex" onClick={() => setHideResult(true)}>
              Xem lại bàn cờ
            </button>
            {mode !== 'online' && (
              <button className="btn-hex" onClick={restart}>
                Chơi lại
              </button>
            )}
            <button className="btn-hex primary" onClick={onExit}>
              Về sảnh
            </button>
          </div>
        </div>
      )}

      {/* Modal Chia sẻ phòng */}
      {showShare && currentRoomId && (
        <ShareModal roomId={currentRoomId} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
