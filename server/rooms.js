import { initialBoard, legalMoves, makeMove, inCheck, notation, other } from './xiangqi.js'
import { dbService } from './db.js'

export const onlineUsers = new Map() // username -> { socketId, username, status: 'idle'|'in_room'|'playing', roomId }
export const rooms = new Map() // roomId -> room data
const disconnectTimers = new Map() // `${roomId}_${username}` -> Timeout

function getTimerKey(roomId, username) {
  return `${roomId}_${username}`
}

function clearDisconnectTimer(roomId, username) {
  const key = getTimerKey(roomId, username)
  if (disconnectTimers.has(key)) {
    clearTimeout(disconnectTimers.get(key))
    disconnectTimers.delete(key)
  }
}

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function serializeRoom(room) {
  if (!room) return null
  return {
    id: room.id,
    status: room.status,
    creator: room.creator,
    redPlayer: room.redPlayer
      ? {
          username: room.redPlayer.username,
          connected: Boolean(room.redPlayer.connected),
        }
      : null,
    blackPlayer: room.blackPlayer
      ? {
          username: room.blackPlayer.username,
          connected: Boolean(room.blackPlayer.connected),
        }
      : null,
    spectators: (room.spectators || []).map((s) => ({
      username: s.username,
    })),
    board: room.board,
    turn: room.turn,
    history: room.history,
    lastMove: room.lastMove,
    chats: room.chats,
    drawOffer: room.drawOffer,
    over: room.over,
    winner: room.winner,
    reason: room.reason,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  }
}

export function getOnlineUsersList() {
  const list = []
  for (const [, user] of onlineUsers.entries()) {
    list.push({
      username: user.username,
      status: user.status,
      roomId: user.roomId,
    })
  }
  return list
}

export function registerOnlineUser(username, socketId) {
  const existing = onlineUsers.get(username)
  onlineUsers.set(username, {
    socketId,
    username,
    status: existing?.status || 'idle',
    roomId: existing?.roomId || null,
  })
}

export function unregisterOnlineUser(socketId) {
  for (const [username, user] of onlineUsers.entries()) {
    if (user.socketId === socketId) {
      onlineUsers.delete(username)
      return username
    }
  }
  return null
}

export function createRoom(creatorUsername, preferredColor = 'r') {
  let roomId = generateRoomId()
  while (rooms.has(roomId)) {
    roomId = generateRoomId()
  }

  const redIsCreator = preferredColor !== 'b'
  const room = {
    id: roomId,
    status: 'waiting', // 'waiting', 'playing', 'finished'
    creator: creatorUsername,
    redPlayer: redIsCreator
      ? { username: creatorUsername, socketId: null, connected: true }
      : null,
    blackPlayer: !redIsCreator
      ? { username: creatorUsername, socketId: null, connected: true }
      : null,
    spectators: [],
    board: initialBoard(),
    turn: 'r',
    history: [{ board: initialBoard() }],
    lastMove: null,
    chats: [
      {
        id: 'sys_' + Date.now(),
        isSystem: true,
        text: `Phòng ${roomId} đã được tạo bởi ${creatorUsername}. Đang chờ đối thủ...`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ],
    drawOffer: null,
    over: false,
    winner: null,
    reason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  rooms.set(roomId, room)
  return room
}

export function getRoom(roomId) {
  return rooms.get(roomId?.toUpperCase()) || null
}

export function joinRoom(roomId, username, socketId) {
  const room = getRoom(roomId)
  if (!room) return { error: 'Không tìm thấy phòng' }

  // 1. Nếu là người chơi cũ quay lại (reconnect / rejoin)
  if (room.redPlayer?.username === username) {
    room.redPlayer.socketId = socketId
    room.redPlayer.connected = true
    clearDisconnectTimer(room.id, username)
    return { room, role: 'r', isReconnect: true }
  }

  if (room.blackPlayer?.username === username) {
    room.blackPlayer.socketId = socketId
    room.blackPlayer.connected = true
    clearDisconnectTimer(room.id, username)
    return { room, role: 'b', isReconnect: true }
  }

  // 2. Nếu phòng đang chờ người chơi thứ 2
  if (room.status === 'waiting') {
    if (!room.redPlayer) {
      room.redPlayer = { username, socketId, connected: true }
      room.status = 'playing'
    } else if (!room.blackPlayer) {
      room.blackPlayer = { username, socketId, connected: true }
      room.status = 'playing'
    }

    room.chats.push({
      id: 'sys_' + Date.now(),
      isSystem: true,
      text: `${username} đã tham gia ván cờ. Trận đấu bắt đầu!`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    })

    // Cập nhật trạng thái người chơi
    if (onlineUsers.has(room.redPlayer.username)) {
      onlineUsers.get(room.redPlayer.username).status = 'playing'
      onlineUsers.get(room.redPlayer.username).roomId = room.id
    }
    if (onlineUsers.has(room.blackPlayer.username)) {
      onlineUsers.get(room.blackPlayer.username).status = 'playing'
      onlineUsers.get(room.blackPlayer.username).roomId = room.id
    }

    // Tự động lưu khởi tạo ván cờ vào MongoDB
    saveRoomToDB(room)

    const role = room.redPlayer.username === username ? 'r' : 'b'
    return { room, role, isReconnect: false }
  }

  // 3. Nếu phòng đã đủ 2 người -> vào làm khán giả (spectator)
  const existingSpec = room.spectators.find((s) => s.username === username)
  if (existingSpec) {
    existingSpec.socketId = socketId
  } else {
    room.spectators.push({ username, socketId })
    room.chats.push({
      id: 'sys_' + Date.now(),
      isSystem: true,
      text: `${username} đã vào xem trận đấu.`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    })
  }

  return { room, role: 'spectator', isReconnect: false }
}

export function handleMove(roomId, username, move) {
  const room = getRoom(roomId)
  if (!room) return { error: 'Không tìm thấy phòng' }
  if (room.status !== 'playing' || room.over) return { error: 'Ván cờ chưa bắt đầu hoặc đã kết thúc' }

  // Xác định màu quân của người đi
  const isRed = room.redPlayer?.username === username
  const isBlack = room.blackPlayer?.username === username
  if (!isRed && !isBlack) return { error: 'Bạn không phải người chơi trong ván này' }

  const playerColor = isRed ? 'r' : 'b'
  if (room.turn !== playerColor) return { error: 'Chưa đến lượt của bạn' }

  // Server-side validation bằng xiangqi.js
  const moves = legalMoves(room.board, room.turn)
  const isValid = moves.some((m) => m.from === move.from && m.to === move.to)
  if (!isValid) return { error: 'Nước đi không hợp lệ theo luật cờ tướng' }

  const captured = room.board[move.to]
  const moveText = notation(room.board, move)
  const newBoard = makeMove(room.board, move)

  const step = {
    board: newBoard,
    move: { ...move, captured },
    text: moveText,
  }

  room.board = newBoard
  room.lastMove = step.move
  room.history.push(step)
  room.turn = other(room.turn)
  room.drawOffer = null
  room.updatedAt = new Date()

  // Kiểm tra kết thúc ván
  const nextMoves = legalMoves(room.board, room.turn)
  if (!nextMoves.length) {
    room.over = true
    room.status = 'finished'
    room.winner = playerColor // người vừa đi làm đối thủ hết nước -> thắng
    room.reason = inCheck(room.board, room.turn) ? 'Chiếu bí' : 'Hết nước đi'
    room.chats.push({
      id: 'sys_' + Date.now(),
      isSystem: true,
      text: `${room.reason}! ${playerColor === 'r' ? 'Đỏ' : 'Đen'} (${username}) đã giành chiến thắng!`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    })
  } else if (inCheck(room.board, room.turn)) {
    room.chats.push({
      id: 'sys_' + Date.now(),
      isSystem: true,
      text: `Chiếu tướng! Đến lượt ${room.turn === 'r' ? 'Đỏ' : 'Đen'}.`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    })
  }

  // Tự động lưu nước đi vào DB
  saveRoomToDB(room)

  return { room, step }
}

export function addChatMessage(roomId, username, text) {
  const room = getRoom(roomId)
  if (!room) return null

  let color = 'spectator'
  if (room.redPlayer?.username === username) color = 'r'
  else if (room.blackPlayer?.username === username) color = 'b'

  const msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    sender: { username, color },
    text: text.trim().slice(0, 300),
    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    isSystem: false,
  }

  room.chats.push(msg)
  if (room.chats.length > 100) room.chats.shift() // giữ tối đa 100 tin
  return msg
}

export function resignGame(roomId, username) {
  const room = getRoom(roomId)
  if (!room || room.status !== 'playing' || room.over) return null

  const isRed = room.redPlayer?.username === username
  const isBlack = room.blackPlayer?.username === username
  if (!isRed && !isBlack) return null

  room.over = true
  room.status = 'finished'
  room.winner = isRed ? 'b' : 'r'
  room.reason = 'Đối thủ đầu hàng'

  const winnerName = isRed ? room.blackPlayer?.username : room.redPlayer?.username
  room.chats.push({
    id: 'sys_' + Date.now(),
    isSystem: true,
    text: `${username} đã đầu hàng. ${winnerName} thắng!`,
    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  })

  saveRoomToDB(room)
  return room
}

export function offerDraw(roomId, username) {
  const room = getRoom(roomId)
  if (!room || room.status !== 'playing' || room.over) return null
  const isRed = room.redPlayer?.username === username
  const isBlack = room.blackPlayer?.username === username
  if (!isRed && !isBlack) return null

  const color = isRed ? 'r' : 'b'
  room.drawOffer = color

  room.chats.push({
    id: 'sys_' + Date.now(),
    isSystem: true,
    text: `${username} đã gửi lời xin hòa.`,
    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  })

  return { room, offeredBy: username, color }
}

export function respondDraw(roomId, username, accept) {
  const room = getRoom(roomId)
  if (!room || room.status !== 'playing' || room.over || !room.drawOffer) return null

  const isRed = room.redPlayer?.username === username
  const isBlack = room.blackPlayer?.username === username
  if (!isRed && !isBlack) return null

  const playerColor = isRed ? 'r' : 'b'
  if (playerColor === room.drawOffer) return null // không thể tự trả lời cầu hòa của chính mình

  if (accept) {
    room.over = true
    room.status = 'finished'
    room.winner = 'draw'
    room.reason = 'Hòa cờ theo thỏa thuận'
    room.drawOffer = null
    room.chats.push({
      id: 'sys_' + Date.now(),
      isSystem: true,
      text: `Hai bên đã đồng ý hòa cờ. Ván đấu kết thúc hòa!`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    })
    saveRoomToDB(room)
  } else {
    room.drawOffer = null
    room.chats.push({
      id: 'sys_' + Date.now(),
      isSystem: true,
      text: `${username} đã từ chối lời xin hòa.`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    })
  }

  return room
}

export function handleSocketDisconnect(socketId, io) {
  const username = unregisterOnlineUser(socketId)

  // Tìm phòng mà người chơi này đang tham gia
  for (const [, room] of rooms.entries()) {
    let affected = false
    let isRed = false

    if (room.redPlayer?.socketId === socketId) {
      room.redPlayer.connected = false
      affected = true
      isRed = true
    } else if (room.blackPlayer?.socketId === socketId) {
      room.blackPlayer.connected = false
      affected = true
      isRed = false
    }

    if (affected) {
      const playerName = isRed ? room.redPlayer.username : room.blackPlayer.username
      const opponentSocket = isRed ? room.blackPlayer?.socketId : room.redPlayer?.socketId

      if (room.status === 'playing' && !room.over) {
        // Báo cho đối thủ biết người chơi tạm thời mất kết nối
        if (opponentSocket) {
          io.to(opponentSocket).emit('player_disconnected', {
            username: playerName,
            message: `Đối thủ (${playerName}) đã mất kết nối. Đang chờ kết nối lại...`,
          })
        }

        // Tạo timer 60 giây chờ kết nối lại trước khi xử lý
        const timerKey = getTimerKey(room.id, playerName)
        clearDisconnectTimer(room.id, playerName)

        const timer = setTimeout(() => {
          const playerObj = isRed ? room.redPlayer : room.blackPlayer
          if (playerObj && !playerObj.connected && room.status === 'playing' && !room.over) {
            room.over = true
            room.status = 'finished'
            room.winner = isRed ? 'b' : 'r'
            room.reason = `${playerName} rời trận quá thời gian`
            saveRoomToDB(room)
            io.to(room.id).emit('room_updated', serializeRoom(room))
          }
          disconnectTimers.delete(timerKey)
        }, 60000)

        disconnectTimers.set(timerKey, timer)
      } else if (room.status === 'waiting') {
        // Nếu phòng đang chờ mà chủ phòng thoát -> hủy phòng
        rooms.delete(room.id)
      }
    }
  }

  // Phát lại danh sách người online cho tất cả mọi người
  io.emit('online_users_updated', getOnlineUsersList())
}

export async function saveRoomToDB(room) {
  try {
    const saved = await dbService.saveGame({
      roomId: room.id,
      title: `Ván đấu ${room.redPlayer?.username || 'Đỏ'} vs ${room.blackPlayer?.username || 'Đen'}`,
      mode: 'online',
      redPlayer: room.redPlayer ? { username: room.redPlayer.username } : null,
      blackPlayer: room.blackPlayer ? { username: room.blackPlayer.username } : null,
      ownerId: room.creator,
      board: room.board,
      history: room.history,
      turn: room.turn,
      status: room.status,
      winner: room.winner,
      reason: room.reason,
    })
    room.savedId = saved._id
  } catch (err) {
    console.error('Lỗi khi lưu phòng vào DB:', err)
  }
}
