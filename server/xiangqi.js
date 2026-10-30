// Bàn cờ: mảng 90 ô, index = hàng * 9 + cột. Hàng 0 phía Đen (trên), hàng 9 phía Đỏ (dưới).
// Quân: chữ hoa = Đỏ, chữ thường = Đen. K tướng, A sĩ, B tượng, N mã, R xe, C pháo, P tốt.

const START = [
  'rnbakabnr',
  '.........',
  '.c.....c.',
  'p.p.p.p.p',
  '.........',
  '.........',
  'P.P.P.P.P',
  '.C.....C.',
  '.........',
  'RNBAKABNR',
]

export const initialBoard = () => START.join('').split('').map((ch) => (ch === '.' ? null : ch))
export const colorOf = (p) => (p === p.toUpperCase() ? 'r' : 'b')
export const other = (color) => (color === 'r' ? 'b' : 'r')

const rc = (i) => [Math.floor(i / 9), i % 9]
const at = (r, c) => r * 9 + c
const onBoard = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9
const inPalace = (r, c, color) => c >= 3 && c <= 5 && (color === 'r' ? r >= 7 : r <= 2)
const ownSide = (r, color) => (color === 'r' ? r >= 5 : r <= 4)

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
// [bước đi của mã, vị trí chân mã]
const KNIGHT = [
  [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
  [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1],
]

function pseudoMoves(board, from) {
  const p = board[from]
  const type = p.toUpperCase()
  const color = colorOf(p)
  const [r, c] = rc(from)
  const out = []
  const add = (r2, c2) => {
    if (!onBoard(r2, c2)) return
    const target = board[at(r2, c2)]
    if (!target || colorOf(target) !== color) out.push(at(r2, c2))
  }

  if (type === 'K' || type === 'A') {
    for (const [dr, dc] of type === 'K' ? ORTHO : DIAG) {
      if (inPalace(r + dr, c + dc, color)) add(r + dr, c + dc)
    }
  } else if (type === 'B') {
    for (const [dr, dc] of DIAG) {
      const r2 = r + 2 * dr
      const c2 = c + 2 * dc
      if (onBoard(r2, c2) && ownSide(r2, color) && !board[at(r + dr, c + dc)]) add(r2, c2)
    }
  } else if (type === 'N') {
    for (const [dr, dc, lr, lc] of KNIGHT) {
      if (onBoard(r + dr, c + dc) && !board[at(r + lr, c + lc)]) add(r + dr, c + dc)
    }
  } else if (type === 'R' || type === 'C') {
    for (const [dr, dc] of ORTHO) {
      let r2 = r + dr
      let c2 = c + dc
      while (onBoard(r2, c2) && !board[at(r2, c2)]) {
        out.push(at(r2, c2))
        r2 += dr
        c2 += dc
      }
      if (!onBoard(r2, c2)) continue
      if (type === 'R') {
        add(r2, c2)
        continue
      }
      // Pháo ăn quân phải nhảy qua đúng 1 quân (ngòi)
      do {
        r2 += dr
        c2 += dc
      } while (onBoard(r2, c2) && !board[at(r2, c2)])
      if (onBoard(r2, c2)) add(r2, c2)
    }
  } else {
    add(r + (color === 'r' ? -1 : 1), c)
    if (!ownSide(r, color)) {
      add(r, c - 1)
      add(r, c + 1)
    }
  }
  return out
}

// Ô sq có bị bên `by` tấn công không
function attacked(board, sq, by) {
  const [r, c] = rc(sq)
  const is = (r2, c2, type) => {
    const p = board[at(r2, c2)]
    return p && colorOf(p) === by && p.toUpperCase() === type
  }

  for (const [dr, dc] of ORTHO) {
    let r2 = r + dr
    let c2 = c + dc
    while (onBoard(r2, c2) && !board[at(r2, c2)]) {
      r2 += dr
      c2 += dc
    }
    if (!onBoard(r2, c2)) continue
    if (is(r2, c2, 'R') || (dc === 0 && is(r2, c2, 'K'))) return true // xe, hoặc hai tướng đối mặt
    do {
      r2 += dr
      c2 += dc
    } while (onBoard(r2, c2) && !board[at(r2, c2)])
    if (onBoard(r2, c2) && is(r2, c2, 'C')) return true
  }

  for (const [dr, dc, lr, lc] of KNIGHT) {
    const r2 = r - dr
    const c2 = c - dc
    if (onBoard(r2, c2) && is(r2, c2, 'N') && !board[at(r2 + lr, c2 + lc)]) return true
  }

  const behind = by === 'r' ? 1 : -1 // tốt đối phương đứng ngay sau ô này (theo hướng nó tiến)
  if (onBoard(r + behind, c) && is(r + behind, c, 'P')) return true
  if (!ownSide(r, by)) {
    for (const dc of [-1, 1]) if (onBoard(r, c + dc) && is(r, c + dc, 'P')) return true
  }
  return false
}

export const inCheck = (board, color) => attacked(board, board.indexOf(color === 'r' ? 'K' : 'k'), other(color))

export function makeMove(board, { from, to }) {
  const next = board.slice()
  next[to] = next[from]
  next[from] = null
  return next
}

export function legalMoves(board, color) {
  const moves = []
  board.forEach((p, from) => {
    if (!p || colorOf(p) !== color) return
    for (const to of pseudoMoves(board, from)) {
      if (!inCheck(makeMove(board, { from, to }), color)) moves.push({ from, to })
    }
  })
  return moves
}

const NAMES = { K: 'Tg', A: 'S', B: 'T', N: 'M', R: 'X', C: 'P', P: 'B' }

// Ký hiệu kiểu Việt Nam: quân + cột + (. tiến, - bình, / thoái) + số. Cột đếm từ phải sang theo phía người đi.
// ponytail: chưa phân biệt 2 quân cùng loại trên cùng cột (trước/sau)
export function notation(board, { from, to }) {
  const p = board[from]
  const type = p.toUpperCase()
  const color = colorOf(p)
  const [r1, c1] = rc(from)
  const [r2, c2] = rc(to)
  const file = (c) => (color === 'r' ? 9 - c : c + 1)
  const forward = color === 'r' ? r2 < r1 : r2 > r1
  const action = r1 === r2 ? '-' : forward ? '.' : '/'
  const num = 'KRCP'.includes(type) && r1 !== r2 ? Math.abs(r2 - r1) : file(c2)
  return `${NAMES[type]}${file(c1)}${action}${num}`
}

// ---------- Máy chơi: negamax + cắt tỉa alpha-beta ----------

const VALUE = { K: 0, A: 20, B: 20, N: 40, R: 90, C: 45, P: 10 }
const MATE = 100000

function evaluate(board, color) {
  let score = 0
  board.forEach((p, i) => {
    if (!p) return
    let v = VALUE[p.toUpperCase()]
    if (p.toUpperCase() === 'P' && !ownSide(Math.floor(i / 9), colorOf(p))) v += 10 // tốt qua sông mạnh hơn
    score += colorOf(p) === color ? v : -v
  })
  return score
}

// Xét nước ăn quân giá trị cao trước để cắt tỉa nhiều hơn
const gain = (board, m) => (board[m.to] ? VALUE[board[m.to].toUpperCase()] : 0)
const ordered = (board, moves) => moves.sort((a, b) => gain(board, b) - gain(board, a))

function negamax(board, color, depth, alpha, beta) {
  if (depth === 0) return evaluate(board, color)
  const moves = legalMoves(board, color)
  if (!moves.length) return -MATE - depth // hết nước là thua, thua càng sớm càng tệ
  for (const m of ordered(board, moves)) {
    const score = -negamax(makeMove(board, m), other(color), depth - 1, -beta, -alpha)
    if (score > alpha) alpha = score
    if (alpha >= beta) break
  }
  return alpha
}

// ponytail: chưa có luật cấm chiếu dai/đuổi dai, thêm khi cần
export function bestMove(board, color, depth) {
  const moves = legalMoves(board, color)
  // Trộn trước khi sắp xếp (sort ổn định) để các nước ngang điểm được chọn ngẫu nhiên
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[moves[i], moves[j]] = [moves[j], moves[i]]
  }
  let best = null
  let alpha = -Infinity
  for (const m of ordered(board, moves)) {
    const score = -negamax(makeMove(board, m), other(color), depth - 1, -Infinity, -alpha)
    if (score > alpha) {
      alpha = score
      best = m
    }
  }
  return best
}
