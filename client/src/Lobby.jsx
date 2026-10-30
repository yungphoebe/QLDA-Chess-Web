import { useState } from 'react'
import { LEVELS } from './Game.jsx'

const MODES = {
  ai: {
    title: 'Đấu với máy',
    tag: 'Luyện tập',
    art: '砲',
    theme: 'art-teal',
    desc: 'Rèn luyện chiến thuật với máy. Chọn độ khó rồi vào trận.',
  },
  pvp: {
    title: '2 người 1 máy',
    tag: 'Giao hữu',
    art: '馬',
    theme: 'art-red',
    desc: 'Hai người thay phiên nhau đi trên cùng một thiết bị.',
  },
  online: {
    title: 'Đấu online',
    tag: 'Trực tuyến',
    art: '車',
    theme: 'art-violet',
    desc: 'Tạo phòng, mời bạn bè bằng mã phòng hoặc link, chơi qua mạng.',
    locked: false,
  },
}

export default function Lobby({
  user,
  initial,
  onlineUsers = [],
  onPlay,
  onLogout,
  onOpenSavedGames,
  onInviteUser,
}) {
  const [mode, setMode] = useState(initial?.mode ?? 'ai')
  const [level, setLevel] = useState(initial?.level ?? 'medium')
  const [onlineTab, setOnlineTab] = useState('create') // 'create' | 'join'
  const [inputRoomId, setInputRoomId] = useState(initial?.roomId ?? '')
  const [preferredColor, setPreferredColor] = useState('r')
  const [joinError, setJoinError] = useState('')

  const m = MODES[mode]

  function handleStart() {
    if (mode === 'online') {
      if (onlineTab === 'join') {
        const cleanCode = inputRoomId.trim().toUpperCase()
        if (!cleanCode) {
          setJoinError('Vui lòng nhập mã phòng')
          return
        }
        onPlay({ mode: 'online', roomId: cleanCode, action: 'join' })
      } else {
        onPlay({ mode: 'online', preferredColor, action: 'create' })
      }
    } else {
      onPlay({ mode, level })
    }
  }

  // Lọc danh sách người online (bỏ qua bản thân)
  const otherUsers = onlineUsers.filter((u) => u.username !== user.username)

  return (
    <div className="client">
      <header className="client-nav">
        <div className="brand">
          <span className="brand-mark"><span>帥</span></span>
          SỞ HÁN TRANH HÙNG
        </div>
        <div className="nav-actions">
          <button
            className="btn-hex history-nav-btn"
            onClick={onOpenSavedGames}
            title="Xem các ván cờ đã lưu hoặc tiếp tục ván dở"
          >
            📜 Ván đã lưu
          </button>
          <div className="profile">
            <span className="avatar">{user.username[0].toUpperCase()}</span>
            <b>{user.username}</b>
            <button className="icon-btn" onClick={onLogout} title="Đăng xuất" aria-label="Đăng xuất">⏻</button>
          </div>
        </div>
      </header>

      <main className="play">
        <h1 className="screen-title">Chọn chế độ</h1>
        <div className="mode-cards">
          {Object.entries(MODES).map(([id, md]) => (
            <button
              key={id}
              className={`mode-card ${md.theme} ${mode === id ? 'selected' : ''} ${md.locked ? 'locked' : ''}`}
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
            >
              <span className="art-char" aria-hidden="true">{md.art}</span>
              {md.locked && <span className="lock">Sắp mở</span>}
              <span className="mode-info">
                <span className="eyebrow">{md.tag}</span>
                <strong>{md.title}</strong>
              </span>
            </button>
          ))}
        </div>

        <div className="play-bottom">
          <p className="mode-desc">{m.desc}</p>

          {mode === 'ai' && (
            <div className="queue-list" role="radiogroup" aria-label="Độ khó">
              {Object.entries(LEVELS).map(([id, { label }]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={level === id}
                  className={`queue-opt ${level === id ? 'active' : ''}`}
                  onClick={() => setLevel(id)}
                >
                  <span className="diamond" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {mode === 'online' && (
            <div className="online-setup">
              <div className="auth-tabs online-subtabs">
                <button
                  type="button"
                  className={onlineTab === 'create' ? 'active' : ''}
                  onClick={() => { setOnlineTab('create'); setJoinError(''); }}
                >
                  Tạo phòng mới
                </button>
                <button
                  type="button"
                  className={onlineTab === 'join' ? 'active' : ''}
                  onClick={() => { setOnlineTab('join'); setJoinError(''); }}
                >
                  Vào bằng mã phòng
                </button>
              </div>

              {onlineTab === 'create' ? (
                <div className="color-select-group">
                  <span className="label-text">Chọn màu quân của bạn:</span>
                  <div className="color-chips">
                    <button
                      type="button"
                      className={`color-chip red ${preferredColor === 'r' ? 'active' : ''}`}
                      onClick={() => setPreferredColor('r')}
                    >
                      帥 Cờ Đỏ (Đi trước)
                    </button>
                    <button
                      type="button"
                      className={`color-chip black ${preferredColor === 'b' ? 'active' : ''}`}
                      onClick={() => setPreferredColor('b')}
                    >
                      將 Cờ Đen (Đi sau)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="join-room-field">
                  <input
                    className="input room-input"
                    placeholder="Nhập mã phòng (vd: ABC123)"
                    value={inputRoomId}
                    onChange={(e) => {
                      setInputRoomId(e.target.value.toUpperCase())
                      setJoinError('')
                    }}
                    maxLength={10}
                  />
                  {joinError && <p className="error">{joinError}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="play-footer">
          <button className="btn-hex primary btn-lg" onClick={handleStart}>
            {mode === 'online' ? (onlineTab === 'create' ? 'Tạo phòng ngay' : 'Vào phòng') : 'Bắt đầu'}
          </button>
        </footer>

        {/* Danh sách người chơi online */}
        <section className="online-users-section">
          <div className="section-title-row">
            <h3>👥 Người chơi đang online ({onlineUsers.length})</h3>
            <span className="online-dot-live">● Trực tuyến</span>
          </div>

          {otherUsers.length === 0 ? (
            <p className="no-users-hint">Chưa có người chơi khác trực tuyến. Bạn có thể tạo phòng và gửi link mời bạn bè!</p>
          ) : (
            <div className="online-users-grid">
              {otherUsers.map((u) => (
                <div key={u.username} className="user-online-card">
                  <div className="user-info">
                    <span className="user-avatar">{u.username[0].toUpperCase()}</span>
                    <div>
                      <strong className="user-name">{u.username}</strong>
                      <span className={`user-status ${u.status === 'playing' ? 'in-game' : 'free'}`}>
                        {u.status === 'playing' ? 'Đang chơi' : 'Đang rảnh'}
                      </span>
                    </div>
                  </div>
                  {u.status !== 'playing' && (
                    <button
                      className="btn-hex btn-sm invite-btn"
                      onClick={() => onInviteUser(u.username)}
                    >
                      ⚔️ Mời đấu
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
