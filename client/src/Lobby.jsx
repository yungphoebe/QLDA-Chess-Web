import { useState } from 'react'
import { LEVELS } from './Game.jsx'

const MODES = {
  ai: { title: 'Đấu với máy', tag: 'Luyện tập', art: '砲', theme: 'art-teal', desc: 'Rèn luyện chiến thuật với máy. Chọn độ khó rồi vào trận.' },
  pvp: { title: '2 người 1 máy', tag: 'Giao hữu', art: '馬', theme: 'art-red', desc: 'Hai người thay phiên nhau đi trên cùng một thiết bị.' },
  online: { title: 'Đấu online', tag: 'Trực tuyến', art: '車', theme: 'art-violet', desc: 'Tạo phòng, mời bạn bè bằng mã phòng hoặc link.', locked: true },
}

export default function Lobby({ user, initial, onPlay, onLogout }) {
  const [mode, setMode] = useState(initial?.mode ?? 'ai')
  const [level, setLevel] = useState(initial?.level ?? 'medium')
  const m = MODES[mode]

  return (
    <div className="client">
      <header className="client-nav">
        <div className="brand">
          <span className="brand-mark"><span>帥</span></span>
          SỞ HÁN TRANH HÙNG
        </div>
        <div className="profile">
          <span className="avatar">{user.username[0].toUpperCase()}</span>
          <b>{user.username}</b>
          <button className="icon-btn" onClick={onLogout} title="Đăng xuất" aria-label="Đăng xuất">⏻</button>
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
                <button key={id} role="radio" aria-checked={level === id} className={`queue-opt ${level === id ? 'active' : ''}`} onClick={() => setLevel(id)}>
                  <span className="diamond" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="play-footer">
          <button className="btn-hex primary btn-lg" disabled={m.locked} onClick={() => onPlay({ mode, level })}>Bắt đầu</button>
        </footer>
      </main>
    </div>
  )
}
