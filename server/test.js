import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createRoom,
  joinRoom,
  handleMove,
  addChatMessage,
  resignGame,
  offerDraw,
  respondDraw,
  serializeRoom,
  rooms,
} from './rooms.js'
import { dbService } from './db.js'
import { initialBoard, legalMoves } from './xiangqi.js'

test('Feature 3: Tạo phòng, sinh mã phòng và tham gia phòng', () => {
  const room = createRoom('PlayerRed', 'r')
  assert.ok(room.id, 'Phải có mã phòng')
  assert.equal(room.id.length, 6, 'Mã phòng gồm 6 ký tự')
  assert.equal(room.redPlayer.username, 'PlayerRed')
  assert.equal(room.status, 'waiting')

  // Người thứ 2 tham gia
  const joinRes = joinRoom(room.id, 'PlayerBlack', 'socket_123')
  assert.equal(joinRes.role, 'b')
  assert.equal(joinRes.isReconnect, false)
  assert.equal(room.blackPlayer.username, 'PlayerBlack')
  assert.equal(room.status, 'playing')
})

test('Feature 4: Server kiểm tra nước đi hợp lệ bằng xiangqi.js', () => {
  const room = createRoom('Alice', 'r')
  joinRoom(room.id, 'Bob', 'socket_bob')

  // Kiểm tra nước đi không phải của người chơi
  const strangerRes = handleMove(room.id, 'Charlie', { from: 77, to: 76 })
  assert.ok(strangerRes.error, 'Người lạ không được đi')

  // Đỏ đi trước - thử để Đen đi trước -> bị chặn
  const wrongTurnRes = handleMove(room.id, 'Bob', { from: 19, to: 20 })
  assert.ok(wrongTurnRes.error, 'Chưa đến lượt không được đi')

  // Đỏ đi nước không hợp lệ theo luật (vd: Tướng đi thẳng 5 ô)
  const invalidMoveRes = handleMove(room.id, 'Alice', { from: 85, to: 40 })
  assert.ok(invalidMoveRes.error, 'Nước đi trái luật phải bị server từ chối')

  // Đỏ đi nước hợp lệ: Pháo 2 bình 5 (ô 70 -> ô 67)
  const validMoveRes = handleMove(room.id, 'Alice', { from: 70, to: 67 })
  assert.ok(!validMoveRes.error, 'Nước đi hợp lệ phải thành công')
  assert.equal(room.turn, 'b', 'Sau khi Đỏ đi phải chuyển sang lượt Đen')
  assert.equal(room.board[67], 'C', 'Pháo đỏ đã ở ô đích')
  assert.equal(room.board[70], null, 'Ô xuất phát đã trống')
  assert.equal(validMoveRes.step.text, 'P2-5', 'Ký hiệu nước đi chuẩn Việt Nam')
})

test('Feature 4: Xử lý reconnect / rejoin phòng', () => {
  const room = createRoom('Alice', 'r')
  joinRoom(room.id, 'Bob', 'socket_bob')

  // Alice bị ngắt kết nối và quay lại với socket mới
  room.redPlayer.connected = false
  const rejoinRes = joinRoom(room.id, 'Alice', 'new_socket_alice')
  assert.equal(rejoinRes.isReconnect, true)
  assert.equal(rejoinRes.role, 'r')
  assert.equal(room.redPlayer.connected, true)
  assert.equal(room.redPlayer.socketId, 'new_socket_alice')
})

test('Feature 5: Lưu và tải bàn cờ (thế cờ + biên bản) vào DB', async () => {
  const testBoard = initialBoard()
  const testGame = {
    title: 'Ván thử nghiệm',
    mode: 'pvp',
    ownerId: 'Tester',
    redPlayer: { username: 'Tester' },
    blackPlayer: { username: 'Opponent' },
    board: testBoard,
    history: [{ board: testBoard }],
    turn: 'r',
    status: 'playing',
  }

  const saved = await dbService.saveGame(testGame)
  assert.ok(saved._id, 'Ván cờ phải được lưu có _id')

  // Lấy danh sách ván của user
  const list = await dbService.getGamesByUser('Tester')
  assert.ok(list.length > 0, 'Phải tìm thấy danh sách ván đã lưu')

  const found = await dbService.getGameById(saved._id)
  assert.ok(found, 'Phải tải được ván cờ theo id')
  assert.equal(found.turn, 'r')
  assert.equal(found.status, 'playing')
})

test('Feature 6: Chat trong phòng qua Socket.IO', () => {
  const room = createRoom('Alice', 'r')
  joinRoom(room.id, 'Bob', 'socket_bob')

  const msg1 = addChatMessage(room.id, 'Alice', 'Chào bạn nhé!')
  assert.ok(msg1, 'Gửi tin nhắn thành công')
  assert.equal(msg1.sender.username, 'Alice')
  assert.equal(msg1.sender.color, 'r')
  assert.equal(msg1.text, 'Chào bạn nhé!')

  const msg2 = addChatMessage(room.id, 'Bob', 'Chúc may mắn!')
  assert.equal(msg2.sender.color, 'b')

  assert.ok(room.chats.length >= 3, 'Phòng phải lưu tin nhắn trong chats list')
})

test('An toàn dữ liệu: serializeRoom không chứa cyclic references hay Timers', () => {
  const room = createRoom('Alice', 'r')
  joinRoom(room.id, 'Bob', 'socket_bob')

  const serialized = serializeRoom(room)
  assert.doesNotThrow(() => {
    JSON.stringify(serialized)
  }, 'serializeRoom phải chuyển thành JSON an toàn không bị RangeError')
  assert.equal(serialized.redPlayer.username, 'Alice')
  assert.equal(serialized.blackPlayer.username, 'Bob')
  assert.equal(serialized.redPlayer.disconnectTimer, undefined)
})
