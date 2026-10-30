import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { connectDB, dbService } from './db.js'
import { hashPassword, comparePassword, generateToken, authMiddleware, verifyToken } from './auth.js'
import {
  onlineUsers,
  getOnlineUsersList,
  registerOnlineUser,
  createRoom,
  getRoom,
  joinRoom,
  handleMove,
  addChatMessage,
  resignGame,
  offerDraw,
  respondDraw,
  handleSocketDisconnect,
  serializeRoom,
} from './rooms.js'

const app = express()
app.use(cors())
app.use(express.json())

// Kết nối database
await connectDB()

// ---------------- REST API ----------------

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mongo: dbService.isUsingMongo() })
})

// Đăng ký
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' })
    }
    const cleanUser = username.trim()
    const existing = await dbService.findUser(cleanUser)
    if (existing) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' })
    }

    const hashedPassword = hashPassword(password)
    const user = await dbService.createUser({
      username: cleanUser,
      email: (email || '').trim(),
      password: hashedPassword,
    })

    const token = generateToken(user)
    return res.json({
      token,
      user: { username: user.username, email: user.email, id: user._id },
    })
  } catch (err) {
    console.error('Lỗi đăng ký:', err)
    return res.status(500).json({ error: 'Lỗi server khi đăng ký' })
  }
})

// Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' })
    }
    const cleanUser = username.trim()
    const user = await dbService.findUser(cleanUser)
    if (!user) {
      return res.status(400).json({ error: 'Tài khoản không tồn tại' })
    }

    const valid = comparePassword(password, user.password)
    if (!valid) {
      return res.status(400).json({ error: 'Mật khẩu không chính xác' })
    }

    const token = generateToken(user)
    return res.json({
      token,
      user: { username: user.username, email: user.email, id: user._id },
    })
  } catch (err) {
    console.error('Lỗi đăng nhập:', err)
    return res.status(500).json({ error: 'Lỗi server khi đăng nhập' })
  }
})

// Thông tin tài khoản hiện tại
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await dbService.findUser(req.user.username)
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' })
  return res.json({ user: { username: user.username, email: user.email, id: user._id } })
})

// Lưu ván cờ (thế cờ + biên bản)
app.post('/api/games/save', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    let username = 'Khách'
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = verifyToken(authHeader.split(' ')[1])
      if (decoded?.username) username = decoded.username
    }

    const {
      _id,
      title,
      mode = 'pvp',
      level = 'medium',
      roomId,
      redPlayer,
      blackPlayer,
      board,
      history,
      turn = 'r',
      status = 'playing',
      winner = null,
      reason = null,
    } = req.body

    if (!board || !Array.isArray(board)) {
      return res.status(400).json({ error: 'Dữ liệu bàn cờ không hợp lệ' })
    }

    const gameData = {
      _id,
      title: title || `Ván cờ ${new Date().toLocaleDateString('vi-VN')}`,
      mode,
      level,
      roomId: roomId || '',
      redPlayer: redPlayer || { username },
      blackPlayer: blackPlayer || (mode === 'ai' ? { username: 'Máy' } : { username: 'Người chơi 2' }),
      ownerId: username,
      board,
      history: history || [],
      turn,
      status,
      winner,
      reason,
    }

    const saved = await dbService.saveGame(gameData)
    return res.json({ ok: true, game: saved })
  } catch (err) {
    console.error('Lỗi lưu ván cờ:', err)
    return res.status(500).json({ error: 'Lỗi server khi lưu ván cờ' })
  }
})

// Danh sách ván cờ của người dùng
app.get('/api/games', async (req, res) => {
  try {
    const username = req.query.username || (req.headers.authorization && verifyToken(req.headers.authorization.split(' ')[1])?.username)
    if (!username) {
      return res.json({ games: [] })
    }
    const games = await dbService.getGamesByUser(username)
    return res.json({ games })
  } catch (err) {
    console.error('Lỗi lấy danh sách ván cờ:', err)
    return res.status(500).json({ error: 'Lỗi server' })
  }
})

// Lấy chi tiết một ván cờ
app.get('/api/games/:id', async (req, res) => {
  try {
    const game = await dbService.getGameById(req.params.id)
    if (!game) return res.status(404).json({ error: 'Không tìm thấy ván cờ' })
    return res.json({ game })
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi server' })
  }
})

// Xóa ván cờ
app.delete('/api/games/:id', async (req, res) => {
  try {
    const username = req.query.username || (req.headers.authorization && verifyToken(req.headers.authorization.split(' ')[1])?.username)
    const result = await dbService.deleteGame(req.params.id, username)
    return res.json({ ok: true, result })
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi server khi xóa ván cờ' })
  }
})

// ---------------- Socket.IO ----------------

const server = createServer(app)
const io = new Server(server, {
  cors: { origin: '*' },
})

io.on('connection', (socket) => {
  let currentUsername = null

  // Đăng ký người dùng online
  socket.on('register_online', ({ username }) => {
    if (!username) return
    currentUsername = username
    registerOnlineUser(username, socket.id)
    io.emit('online_users_updated', getOnlineUsersList())
  })

  // Lấy danh sách online
  socket.on('get_online_users', () => {
    socket.emit('online_users_updated', getOnlineUsersList())
  })

  // Mời bạn chơi trong game
  socket.on('invite_player', ({ targetUsername, roomId, fromUsername }) => {
    const target = onlineUsers.get(targetUsername)
    if (target && target.socketId) {
      io.to(target.socketId).emit('game_invitation', {
        fromUsername,
        roomId,
      })
    } else {
      socket.emit('invitation_failed', { message: 'Người chơi không còn online' })
    }
  })

  // Phản hồi lời mời chơi
  socket.on('respond_invitation', ({ fromUsername, roomId, accept, respondent }) => {
    const inviter = onlineUsers.get(fromUsername)
    if (inviter && inviter.socketId) {
      io.to(inviter.socketId).emit('invitation_response', {
        respondent: respondent || currentUsername,
        roomId,
        accept,
      })
    }
  })

  // Tạo phòng
  socket.on('create_room', ({ username, preferredColor }, callback) => {
    const room = createRoom(username, preferredColor)
    if (typeof callback === 'function') callback({ roomId: room.id })
    else socket.emit('room_created', { roomId: room.id })
  })

  // Tham gia / Vào lại phòng
  socket.on('join_room', ({ roomId, username }) => {
    if (!roomId || !username) return
    currentUsername = username
    registerOnlineUser(username, socket.id)

    const result = joinRoom(roomId, username, socket.id)
    if (result.error) {
      return socket.emit('join_error', { message: result.error })
    }

    socket.join(roomId.toUpperCase())

    // Gửi trạng thái phòng cho người vừa vào (sử dụng serializeRoom)
    socket.emit('room_joined', {
      room: serializeRoom(result.room),
      role: result.role,
      isReconnect: result.isReconnect,
    })

    // Cập nhật tới toàn bộ người trong phòng
    io.to(roomId.toUpperCase()).emit('room_updated', serializeRoom(result.room))

    // Nếu là reconnect, báo đối thủ đã kết nối lại
    if (result.isReconnect) {
      socket.to(roomId.toUpperCase()).emit('player_reconnected', {
        username,
        message: `${username} đã kết nối lại!`,
      })
    }
  })

  // Nước đi của người chơi (Server validation bằng xiangqi.js)
  socket.on('make_move', ({ roomId, username, move }) => {
    const result = handleMove(roomId, username, move)
    if (result.error) {
      return socket.emit('move_error', { message: result.error })
    }

    // Phát nước đi và cập nhật phòng tới toàn bộ client trong phòng
    io.to(roomId.toUpperCase()).emit('move_made', {
      room: serializeRoom(result.room),
      step: result.step,
    })
  })

  // Chat trong phòng
  socket.on('send_chat', ({ roomId, username, text }) => {
    if (!roomId || !text?.trim()) return
    const msg = addChatMessage(roomId, username, text)
    if (msg) {
      io.to(roomId.toUpperCase()).emit('new_chat', msg)
    }
  })

  // Cầu hòa
  socket.on('offer_draw', ({ roomId, username }) => {
    const result = offerDraw(roomId, username)
    if (result) {
      socket.to(roomId.toUpperCase()).emit('draw_offered', {
        from: username,
      })
      io.to(roomId.toUpperCase()).emit('room_updated', serializeRoom(result.room))
    }
  })

  // Trả lời cầu hòa
  socket.on('respond_draw', ({ roomId, username, accept }) => {
    const room = respondDraw(roomId, username, accept)
    if (room) {
      io.to(roomId.toUpperCase()).emit('room_updated', serializeRoom(room))
    }
  })

  // Đầu hàng
  socket.on('resign', ({ roomId, username }) => {
    const room = resignGame(roomId, username)
    if (room) {
      io.to(roomId.toUpperCase()).emit('room_updated', serializeRoom(room))
    }
  })

  // Rời phòng
  socket.on('leave_room', ({ roomId, username }) => {
    if (roomId) {
      socket.leave(roomId.toUpperCase())
      const room = getRoom(roomId)
      if (room) {
        room.spectators = room.spectators.filter((s) => s.username !== username)
        io.to(roomId.toUpperCase()).emit('room_updated', serializeRoom(room))
      }
    }
  })

  // Ngắt kết nối
  socket.on('disconnect', () => {
    handleSocketDisconnect(socket.id, io)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`🚀 Server cờ tướng đang chạy tại http://localhost:${PORT}`)
})
