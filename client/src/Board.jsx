import { useLayoutEffect, useRef } from 'react'

// Bàn cờ: đường kẻ vẽ bằng SVG (tĩnh, chỉ vẽ một lần), quân cờ là phần tử HTML
// để animation transform chạy trên GPU, không phải vẽ lại cả bàn mỗi khung hình.
const W = 560
const H = 620
const CELL = 60
const PAD = 40
const x = (c) => PAD + c * CELL
const y = (r) => PAD + r * CELL
const pos = (i) => [x(i % 9), y(Math.floor(i / 9))]
const place = (i) => {
  const [px, py] = pos(i)
  return { left: `${(px / W) * 100}%`, top: `${(py / H) * 100}%` }
}

const CHARS = {
  K: '帥', A: '仕', B: '相', N: '傌', R: '俥', C: '炮', P: '兵',
  k: '將', a: '士', b: '象', n: '馬', r: '車', c: '砲', p: '卒',
}

const PALACE = [[0, 3, 2, 5], [0, 5, 2, 3], [7, 3, 9, 5], [7, 5, 9, 3]]

const T = (tx, ty, s = 1, r = 0) => ({ transform: `translate(${tx}px, ${ty}px) scale(${s}) rotate(${r}deg)` })

// Mỗi loại quân một kiểu di chuyển riêng. (dx, dy) = vị trí ô cũ so với ô mới (px), u = số px của 1 đơn vị bàn cờ.
const MOTIONS = {
  // Xe: lao thẳng như tên bắn, vượt đà một chút rồi dừng
  R: (dx, dy) => [[T(dx, dy), T(0, 0)], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.25)' }],
  // Mã: phi nước đại, nhảy vòng cung rồi tiếp đất
  N: (dx, dy, u) => [
    [T(dx, dy), T(dx / 2, dy / 2 - 45 * u, 1.35, dx > 0 ? -15 : 15), { ...T(0, 0, 0.9), offset: 0.85 }, T(0, 0)],
    { duration: 480, easing: 'ease-in-out' },
  ],
  // Pháo: bay cầu vồng thật cao, xoay tròn như đạn pháo
  C: (dx, dy, u) => [[T(dx, dy), T(dx / 2, dy / 2 - 100 * u, 1.5, 180), T(0, 0, 1, 360)], { duration: 620, easing: 'ease-in-out' }],
  // Tượng: lướt chéo chậm rãi, đĩnh đạc
  B: (dx, dy) => [[T(dx, dy), T(dx / 2, dy / 2, 1.15, 10), T(0, 0)], { duration: 650, easing: 'ease-in-out' }],
  // Sĩ: bước chéo nhanh gọn
  A: (dx, dy, u) => [[T(dx, dy), T(dx / 2, dy / 2 - 14 * u, 1.12), T(0, 0)], { duration: 280, easing: 'ease-out' }],
  // Tướng: nhấc lên rồi dậm xuống, rung cả bàn cờ
  K: (dx, dy, u) => [
    [T(dx, dy), { ...T(dx * 0.1, dy * 0.1 - 24 * u, 1.3), offset: 0.55 }, { ...T(0, 0, 0.88), offset: 0.75 }, { ...T(0, 0, 1.06), offset: 0.88 }, T(0, 0)],
    { duration: 520, easing: 'ease-in-out' },
  ],
  // Tốt: nhảy lò cò hai nhịp
  P: (dx, dy, u) => [
    [T(dx, dy), T(dx * 0.75, dy * 0.75 - 14 * u), T(dx * 0.5, dy * 0.5), T(dx * 0.25, dy * 0.25 - 14 * u), T(0, 0)],
    { duration: 420, easing: 'linear' },
  ],
}

const SHAKE = [T(0, 0), T(-5, 2), T(5, -2), T(-3, 1), T(0, 0)]

const color = (p) => (p === p.toUpperCase() ? 'red' : 'black')

export default function Board({ board, selected = null, targets = [], lastMove = null, onSquareClick }) {
  const wrapEl = useRef(null)
  const pieceEls = useRef({})
  const ghostEl = useRef(null)
  const boomEl = useRef(null)
  const played = useRef(new WeakSet()) // nước đã chạy animation, để Đi lại không chạy lại

  useLayoutEffect(() => {
    if (!lastMove || played.current.has(lastMove)) return
    played.current.add(lastMove)
    // Máy bật "giảm chuyển động" (Windows tắt Animation effects): chỉ trượt nhẹ, bỏ nhảy/xoay/rung
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    const u = wrapEl.current.clientWidth / W
    const type = board[lastMove.to].toUpperCase()
    const [x1, y1] = pos(lastMove.from)
    const [x2, y2] = pos(lastMove.to)
    const dx = (x1 - x2) * u
    const dy = (y1 - y2) * u
    const [frames, options] = reduced ? [[T(dx, dy), T(0, 0)], { duration: 200, easing: 'ease-out' }] : MOTIONS[type](dx, dy, u)
    pieceEls.current[lastMove.to].animate(frames, options)
    if (type === 'K' && !reduced) wrapEl.current.animate(SHAKE, { duration: 260, delay: options.duration * 0.75 })

    if (ghostEl.current) {
      // Quân bị ăn văng ra khi quân tấn công vừa chạm tới
      const hit = options.duration * 0.8
      const fly = reduced ? T(0, 0) : T((x1 < x2 ? 40 : -40) * u, -50 * u, 1.5, -40)
      ghostEl.current.getAnimations().forEach((a) => a.cancel())
      ghostEl.current.animate([{ ...T(0, 0), opacity: 1 }, { ...fly, opacity: 0 }], { duration: 450, delay: hit, fill: 'forwards' })
      if (!reduced) {
        boomEl.current.animate([{ ...T(0, 0, 0.4), opacity: 0.9 }, { ...T(0, 0, type === 'C' ? 2.8 : 1.8), opacity: 0 }], { duration: 500, delay: hit })
      }
    }
  }, [lastMove, board])

  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const c = Math.round((((e.clientX - rect.left) / rect.width) * W - PAD) / CELL)
    const r = Math.round((((e.clientY - rect.top) / rect.height) * H - PAD) / CELL)
    if (c >= 0 && c < 9 && r >= 0 && r < 10) onSquareClick(r * 9 + c)
  }

  const captured = lastMove?.captured

  return (
    <div
      ref={wrapEl}
      className={`xq ${onSquareClick ? 'clickable' : ''}`}
      onClick={onSquareClick && handleClick}
      role="img"
      aria-label="Bàn cờ tướng"
    >
      <svg className="xq-grid" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <rect x="4" y="4" width={W - 8} height={H - 8} rx="18" className="xq-wood" />
        <rect x={PAD - 8} y={PAD - 8} width={8 * CELL + 16} height={9 * CELL + 16} className="xq-frame" />
        <g className="xq-lines">
          {Array.from({ length: 10 }, (_, r) => <line key={`h${r}`} x1={x(0)} y1={y(r)} x2={x(8)} y2={y(r)} />)}
          {Array.from({ length: 9 }, (_, c) =>
            c === 0 || c === 8 ? (
              <line key={`v${c}`} x1={x(c)} y1={y(0)} x2={x(c)} y2={y(9)} />
            ) : (
              <g key={`v${c}`}>
                <line x1={x(c)} y1={y(0)} x2={x(c)} y2={y(4)} />
                <line x1={x(c)} y1={y(5)} x2={x(c)} y2={y(9)} />
              </g>
            ),
          )}
          {PALACE.map(([r1, c1, r2, c2]) => <line key={`${r1}${c1}`} x1={x(c1)} y1={y(r1)} x2={x(c2)} y2={y(r2)} />)}
        </g>
        <text className="xq-river" x={x(2)} y={y(4.5)}>楚 河</text>
        <text className="xq-river" x={x(6)} y={y(4.5)}>漢 界</text>
        {lastMove &&
          [lastMove.from, lastMove.to].map((i) => {
            const [cx, cy] = pos(i)
            return <rect key={i} className="xq-last" x={cx - 29} y={cy - 29} width="58" height="58" rx="10" />
          })}
      </svg>

      {captured && (
        <div ref={ghostEl} className={`xq-piece ${color(captured)}`} style={place(lastMove.to)}>
          {CHARS[captured]}
        </div>
      )}

      {board.map(
        (p, i) =>
          p && (
            <div
              key={i}
              ref={(el) => (pieceEls.current[i] = el)}
              className={`xq-piece ${color(p)} ${selected === i ? 'selected' : ''}`}
              style={place(i)}
            >
              {CHARS[p]}
            </div>
          ),
      )}

      {captured && <span ref={boomEl} className="xq-boom" style={place(lastMove.to)} />}

      {targets.map((i) => (
        <span key={`t${i}`} className={`xq-hint ${board[i] ? 'capture' : ''}`} style={place(i)} />
      ))}
    </div>
  )
}
