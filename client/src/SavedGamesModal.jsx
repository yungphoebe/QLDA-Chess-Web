import { useState, useEffect } from 'react'
import { getGames, deleteGame } from './api.js'

export default function SavedGamesModal({ user, onClose, onLoadGame }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadList() {
      setLoading(true)
      try {
        const list = await getGames(user?.username)
        setGames(list)
      } catch (err) {
        setError(err.message || 'Không thể tải danh sách ván cờ')
      } finally {
        setLoading(false)
      }
    }
    loadList()
  }, [user?.username])

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!window.confirm('Bạn có chắc chắn muốn xóa ván cờ này?')) return
    try {
      await deleteGame(id, user?.username)
      setGames((prev) => prev.filter((g) => g._id !== id && g.roomId !== id))
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa ván cờ')
    }
  }

  function formatTime(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const modeLabels = {
    ai: 'Đấu với máy',
    pvp: '2 người 1 máy',
    online: 'Đấu online',
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card saved-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Ván đã lưu & Lịch sử</h3>
          <button className="icon-btn close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p className="loading-text">Đang tải danh sách ván cờ...</p>
        ) : games.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📜</span>
            <p>Chưa có ván cờ nào được lưu trong cơ sở dữ liệu.</p>
            <p className="subtext">Bạn có thể bấm "Lưu ván cờ" trong bất kỳ ván đấu nào để lưu lại.</p>
          </div>
        ) : (
          <div className="saved-games-list">
            {games.map((g) => {
              const isPlaying = g.status === 'playing'
              const numMoves = (g.history?.length || 1) - 1
              const red = g.redPlayer?.username || 'Đỏ'
              const black = g.blackPlayer?.username || 'Đen'

              let outcome = 'Đang dở'
              let outcomeClass = 'tag-playing'
              if (g.status === 'finished') {
                if (g.winner === 'draw') {
                  outcome = 'Hòa'
                  outcomeClass = 'tag-draw'
                } else if (g.winner === 'r') {
                  outcome = `Đỏ (${red}) thắng`
                  outcomeClass = 'tag-won'
                } else if (g.winner === 'b') {
                  outcome = `Đen (${black}) thắng`
                  outcomeClass = 'tag-won'
                }
              }

              return (
                <div key={g._id || g.roomId} className="saved-game-item">
                  <div className="game-item-header">
                    <span className="game-mode-badge">{modeLabels[g.mode] || g.mode}</span>
                    <span className={`game-status-badge ${outcomeClass}`}>{outcome}</span>
                    <span className="game-date">{formatTime(g.updatedAt || g.createdAt)}</span>
                  </div>

                  <div className="game-matchup">
                    <span className="red-player">帥 {red}</span>
                    <span className="vs">vs</span>
                    <span className="black-player">將 {black}</span>
                  </div>

                  <div className="game-details">
                    <span>Số nước: <b>{numMoves}</b></span>
                    <span>Lượt đi: <b>{g.turn === 'r' ? 'Đỏ' : 'Đen'}</b></span>
                    {g.reason && <span className="game-reason">{g.reason}</span>}
                  </div>

                  <div className="game-item-actions">
                    {isPlaying ? (
                      <button
                        className="btn-hex primary btn-sm"
                        onClick={() => {
                          onLoadGame(g)
                          onClose()
                        }}
                      >
                        ▶ Chơi tiếp ván dở
                      </button>
                    ) : (
                      <button
                        className="btn-hex btn-sm"
                        onClick={() => {
                          onLoadGame(g)
                          onClose()
                        }}
                      >
                        👁 Xem lại thế cờ
                      </button>
                    )}
                    <button
                      className="icon-btn del-btn"
                      title="Xóa ván cờ"
                      onClick={(e) => handleDelete(g._id || g.roomId, e)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn-hex" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  )
}
