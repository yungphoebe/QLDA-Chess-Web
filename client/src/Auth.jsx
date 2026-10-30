import { useState } from 'react'
import Board from './Board.jsx'
import { initialBoard } from './xiangqi.js'
import { login, register } from './api.js'

const HERO_BOARD = initialBoard()

export default function Auth({ onLogin }) {
  const [tab, setTab] = useState('login')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isLogin = tab === 'login'

  function switchTab(next) {
    setTab(next)
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.target))
    const username = form.username?.trim()
    const password = form.password
    const email = form.email?.trim()

    if (!isLogin && password !== form.confirm) {
      return setError('Mật khẩu nhập lại không khớp')
    }

    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const data = await login(username, password)
        localStorage.setItem('auth_user', JSON.stringify(data))
        onLogin(data.user)
      } else {
        const data = await register(username, email, password)
        localStorage.setItem('auth_user', JSON.stringify(data))
        onLogin(data.user)
      }
    } catch (err) {
      setError(err.message || 'Đã có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  // Chơi thử chế độ khách (Guest)
  function playAsGuest() {
    const guestUser = {
      username: `Khách_${Math.floor(1000 + Math.random() * 9000)}`,
      isGuest: true,
    }
    localStorage.setItem('auth_user', JSON.stringify({ user: guestUser, token: '' }))
    onLogin(guestUser)
  }

  return (
    <div className="auth">
      <form key={tab} className="auth-panel" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark"><span>帥</span></span>
          SỞ HÁN TRANH HÙNG
        </div>

        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={isLogin} className={isLogin ? 'active' : ''} onClick={() => switchTab('login')}>
            Đăng nhập
          </button>
          <button type="button" role="tab" aria-selected={!isLogin} className={isLogin ? '' : 'active'} onClick={() => switchTab('register')}>
            Đăng ký
          </button>
        </div>

        <label className="field">
          Tên đăng nhập
          <input className="input" name="username" required minLength={3} maxLength={20} autoComplete="username" />
        </label>

        {!isLogin && (
          <label className="field">
            Email
            <input className="input" name="email" type="email" required autoComplete="email" />
          </label>
        )}

        <label className="field">
          Mật khẩu
          <div className="pw">
            <input
              className="input"
              name="password"
              type={showPw ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            <button type="button" onClick={() => setShowPw(!showPw)}>{showPw ? 'Ẩn' : 'Hiện'}</button>
          </div>
        </label>

        {!isLogin && (
          <label className="field">
            Nhập lại mật khẩu
            <input className="input" name="confirm" type={showPw ? 'text' : 'password'} required minLength={6} autoComplete="new-password" />
          </label>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        <button className="btn-hex primary btn-lg" disabled={loading}>
          {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
        </button>

        <button type="button" className="btn-hex guest-btn" onClick={playAsGuest}>
          Chơi thử ngay (Khách)
        </button>

        <p className="form-note">
          {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button type="button" className="link" onClick={() => switchTab(isLogin ? 'register' : 'login')}>
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </form>

      <section className="auth-splash art-red" aria-hidden="true">
        <span className="art-char">帥</span>
        <div className="splash-content">
          <span className="eyebrow">Cờ tướng online</span>
          <h1 className="splash-title">
            Sở Hán <br />
            Tranh Hùng
          </h1>
          <p>Bày binh bố trận, thách đấu bạn bè qua mạng, luyện tập với máy.</p>
          <div className="hero-board" inert>
            <Board board={HERO_BOARD} />
          </div>
        </div>
      </section>
    </div>
  )
}
