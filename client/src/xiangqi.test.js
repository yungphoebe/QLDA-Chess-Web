import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialBoard, legalMoves, makeMove, inCheck, notation, bestMove, other } from './xiangqi.js'

function perft(board, color, depth) {
  if (depth === 0) return 1
  let n = 0
  for (const m of legalMoves(board, color)) n += perft(makeMove(board, m), other(color), depth - 1)
  return n
}

// Dựng bàn cờ từ danh sách { 'hàng,cột': quân }
function boardOf(pieces) {
  const board = Array(90).fill(null)
  for (const [key, p] of Object.entries(pieces)) {
    const [r, c] = key.split(',').map(Number)
    board[r * 9 + c] = p
  }
  return board
}

test('perft từ thế cờ ban đầu khớp số chuẩn', () => {
  const board = initialBoard()
  assert.equal(perft(board, 'r', 1), 44)
  assert.equal(perft(board, 'r', 2), 1920)
  assert.equal(perft(board, 'r', 3), 79666)
})

test('hai tướng không được đối mặt', () => {
  const board = boardOf({ '9,4': 'K', '0,3': 'k' })
  const moves = legalMoves(board, 'b').map((m) => m.to)
  assert.deepEqual(moves, [1 * 9 + 3])
})

test('chiếu bí: bên bị chiếu không còn nước đi', () => {
  const board = boardOf({ '9,3': 'K', '0,4': 'k', '0,0': 'R', '1,8': 'R' })
  assert.equal(inCheck(board, 'b'), true)
  assert.equal(legalMoves(board, 'b').length, 0)
})

test('ký hiệu nước đi kiểu Việt Nam', () => {
  const board = initialBoard()
  assert.equal(notation(board, { from: 7 * 9 + 7, to: 7 * 9 + 4 }), 'P2-5')
  assert.equal(notation(board, { from: 9 * 9 + 7, to: 7 * 9 + 6 }), 'M2.3')
  assert.equal(notation(board, { from: 0 * 9 + 0, to: 2 * 9 + 0 }), 'X1.2')
})

test('máy ăn xe đang bị treo', () => {
  const board = boardOf({ '9,4': 'K', '0,3': 'k', '5,0': 'R', '5,8': 'r' })
  assert.deepEqual(bestMove(board, 'r', 2), { from: 5 * 9 + 0, to: 5 * 9 + 8 })
})
