import { useEffect, useRef, useState } from 'react'
import Board from './Board.jsx'
import { initialBoard, legalMoves, makeMove, inCheck, notation, other } from './xiangqi.js'

export const LEVELS = {
  easy: { label: 'Nhập môn', depth: 1 },
  medium: { label: 'Trung cấp', depth: 3 },
  hard: { label: 'Cao thủ', depth: 4 },
}

const NAME = { r: 'Đỏ', b: 'Đen' }

// Một dòng lịch sử: thế cờ sau nước đi, nước đi (kèm quân bị ăn để làm animation) và ký hiệu
const play = (board, move) => ({ board: makeMove(board, move), move: { ...move, captured: board[move.to] }, text: notation(board, move) })

export default function Game({ user, mode, level, onExit }) {
  // Mỗi phần tử: { board, move, text } — phần tử đầu là thế cờ ban đầu
  const [history, setHistory] = useState([{ board: initialBoard() }])
  const [selected, setSelected] = useState(null)
  const [hideResult, setHideResult] = useState(false)
  const worker = useRef(null)

  const { board, move: lastMove } = history.at(-1)
  const turn = history.length % 2 ? 'r' : 'b'
  const moves = legalMoves(board, turn)
  const over = !moves.length
  const aiThinking = mode === 'ai' && turn === 'b' && !over
  const targets = selected === null ? [] : moves.filter((m) => m.from === selected).map((m) => m.to)

  let status = `Lượt ${NAME[turn]}${inCheck(board, turn) ? ' · Đang bị chiếu!' : ''}`
  const reason = inCheck(board, turn) ? 'Chiếu bí' : 'Hết nước đi'
  if (over) status = `${reason}! ${NAME[other(turn)]} thắng`
  else if (aiThinking) status = 'Máy đang suy nghĩ...'

  useEffect(() => {
    if (mode !== 'ai') return
    worker.current = new Worker(new URL('./aiWorker.js', import.meta.url), { type: 'module' })
    return () => worker.current.terminate()
  }, [mode])

  useEffect(() => {
    if (!aiThinking) return
    worker.current.onmessage = ({ data: move }) => {
      // Bỏ qua nếu bàn cờ đã đổi trong lúc máy nghĩ (vd: bấm Đi lại)
      setHistory((prev) => (prev.at(-1).board === board ? [...prev, play(board, move)] : prev))
    }
    worker.current.postMessage({ board, color: 'b', depth: LEVELS[level].depth })
  }, [aiThinking, board, level])

  function onSquareClick(i) {
    if (over || aiThinking) return
    if (targets.includes(i)) {
      const move = { from: selected, to: i }
      setHistory([...history, play(board, move)])
      setSelected(null)
    } else {
      setSelected(moves.some((m) => m.from === i) ? i : null)
    }
  }

  function undo() {
    const back = mode === 'ai' && turn === 'r' && history.length > 2 ? 2 : 1 // chơi với máy thì lùi cả nước của máy
    setHistory(history.slice(0, -back))
    setSelected(null)
    setHideResult(false)
  }

  function restart() {
    setHistory([{ board: initialBoard() }])
    setSelected(null)
    setHideResult(false)
  }

  const texts = history.slice(1).map((h) => h.text)
  const players = {
    b: mode === 'ai' ? { name: `Máy · ${LEVELS[level].label}`, avatar: '🤖' } : { name: 'Người chơi 2', avatar: '將' },
    r: { name: user.username, avatar: '帥' },
  }
  const player = (color) => (
    <div className={`player ${color} ${turn === color && !over ? 'active' : ''}`}>
      <span className="avatar">{players[color].avatar}</span>
      <span className="player-name">{players[color].name}</span>
      <span className="player-side">Quân {NAME[color]}</span>
      {turn === color && !over && <span className="player-turn">Đến lượt</span>}
    </div>
  )

  // Đấu máy: thắng/thua theo góc nhìn người chơi. Cùng máy: báo bên thắng.
  const winner = other(turn)
  const victory = mode !== 'ai' || winner === 'r'
  const resultTitle = mode === 'ai' ? (victory ? 'Chiến thắng' : 'Thất bại') : `${NAME[winner]} thắng`

  return (
    <div className="game">
      <header className="game-bar">
        <button className="btn-hex" onClick={onExit}>← Sảnh</button>
        <h1>{mode === 'ai' ? `Đấu với máy · ${LEVELS[level].label}` : '2 người 1 máy'}</h1>
      </header>

      <div className="game-layout">
        <div className="board-col">
          {player('b')}
          <div className="board-frame">
            <Board board={board} selected={selected} targets={targets} lastMove={lastMove} onSquareClick={onSquareClick} />
          </div>
          {player('r')}
        </div>

        <aside className="side">
          <p className={`status ${over ? 'over' : turn}`} aria-live="polite">{status}</p>
          <h3>Biên bản</h3>
          {texts.length ? (
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
          )}
          <div className="side-actions">
            <button className="btn-hex" onClick={undo} disabled={history.length === 1 || aiThinking}>Đi lại</button>
            <button className="btn-hex primary" onClick={restart}>Ván mới</button>
          </div>
        </aside>
      </div>

      {over && !hideResult && (
        <div className="modal result" role="dialog" aria-modal="true" aria-labelledby="result-title">
          <h2 id="result-title" className={victory ? 'victory' : 'defeat'}>{resultTitle}</h2>
          <p>{reason} · {texts.length} nước</p>
          <div className="result-actions">
            <button className="btn-hex" onClick={() => setHideResult(true)}>Xem bàn cờ</button>
            <button className="btn-hex" onClick={restart}>Chơi lại</button>
            <button className="btn-hex primary" onClick={onExit}>Về sảnh</button>
          </div>
        </div>
      )}
    </div>
  )
}
