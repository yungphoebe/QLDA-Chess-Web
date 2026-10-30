import mongoose from 'mongoose'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const USERS_FILE = path.join(DATA_DIR, 'users.json')
const GAMES_FILE = path.join(DATA_DIR, 'games.json')

function readJson(file, fallback = []) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err)
  }
  return fallback
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error(`Error writing ${file}:`, err)
  }
}

let isMongoConnected = false

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, default: '' },
    password: { type: String, required: true },
  },
  { timestamps: true }
)

const GameSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Ván cờ' },
    mode: { type: String, default: 'online' }, // 'online', 'ai', 'pvp'
    level: { type: String, default: 'medium' },
    roomId: { type: String, default: '' },
    redPlayer: {
      username: { type: String, default: 'Người chơi Đỏ' },
      id: { type: String, default: '' },
    },
    blackPlayer: {
      username: { type: String, default: 'Người chơi Đen' },
      id: { type: String, default: '' },
    },
    ownerId: { type: String, default: '' },
    board: { type: [mongoose.Schema.Types.Mixed], required: true },
    history: { type: [mongoose.Schema.Types.Mixed], default: [] },
    turn: { type: String, default: 'r' },
    status: { type: String, default: 'playing' }, // 'playing', 'finished'
    winner: { type: String, default: null }, // 'r', 'b', 'draw', null
    reason: { type: String, default: null },
  },
  { timestamps: true }
)

export const UserModel = mongoose.model('User', UserSchema)
export const GameModel = mongoose.model('Game', GameSchema)

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiangqi'
  try {
    mongoose.set('strictQuery', false)
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    })
    isMongoConnected = true
    console.log('✅ Đã kết nối thành công với MongoDB:', uri)
  } catch (err) {
    isMongoConnected = false
    console.warn('⚠️ Không thể kết nối MongoDB:', err.message)
    console.warn('💡 Hệ thống sẽ tự động sử dụng bộ nhớ cục bộ (JSON fallback) tại server/data/')
  }
}

// ----------------- DB Service (hỗ trợ cả Mongo và JSON Fallback) -----------------

export const dbService = {
  isUsingMongo() {
    return isMongoConnected
  },

  async findUser(username) {
    if (isMongoConnected) {
      return UserModel.findOne({ username }).lean()
    }
    const users = readJson(USERS_FILE, [])
    return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null
  },

  async createUser({ username, email, password }) {
    if (isMongoConnected) {
      const user = await UserModel.create({ username, email, password })
      return user.toObject()
    }
    const users = readJson(USERS_FILE, [])
    const newUser = {
      _id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      username,
      email: email || '',
      password,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    users.push(newUser)
    writeJson(USERS_FILE, users)
    return newUser
  },

  async saveGame(gameData) {
    const dataToSave = {
      ...gameData,
      updatedAt: new Date(),
    }

    if (isMongoConnected) {
      if (gameData._id && mongoose.isValidObjectId(gameData._id)) {
        return GameModel.findByIdAndUpdate(gameData._id, dataToSave, { new: true, upsert: true }).lean()
      } else if (gameData.roomId) {
        return GameModel.findOneAndUpdate(
          { roomId: gameData.roomId },
          dataToSave,
          { new: true, upsert: true }
        ).lean()
      } else {
        return GameModel.create(dataToSave)
      }
    }

    // JSON fallback
    const games = readJson(GAMES_FILE, [])
    let existingIndex = -1

    if (gameData._id) {
      existingIndex = games.findIndex((g) => g._id === gameData._id)
    } else if (gameData.roomId) {
      existingIndex = games.findIndex((g) => g.roomId === gameData.roomId)
    }

    if (existingIndex >= 0) {
      games[existingIndex] = {
        ...games[existingIndex],
        ...dataToSave,
        updatedAt: new Date().toISOString(),
      }
      writeJson(GAMES_FILE, games)
      return games[existingIndex]
    } else {
      const newGame = {
        _id: 'game_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        createdAt: new Date().toISOString(),
        ...dataToSave,
        updatedAt: new Date().toISOString(),
      }
      games.push(newGame)
      writeJson(GAMES_FILE, games)
      return newGame
    }
  },

  async getGamesByUser(username) {
    if (isMongoConnected) {
      return GameModel.find({
        $or: [
          { ownerId: username },
          { 'redPlayer.username': username },
          { 'blackPlayer.username': username },
        ],
      })
        .sort({ updatedAt: -1 })
        .lean()
    }

    const games = readJson(GAMES_FILE, [])
    return games
      .filter(
        (g) =>
          g.ownerId === username ||
          g.redPlayer?.username === username ||
          g.blackPlayer?.username === username
      )
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  },

  async getGameById(id) {
    if (isMongoConnected) {
      if (mongoose.isValidObjectId(id)) {
        return GameModel.findById(id).lean()
      }
      return GameModel.findOne({ roomId: id }).lean()
    }

    const games = readJson(GAMES_FILE, [])
    return games.find((g) => g._id === id || g.roomId === id) || null
  },

  async deleteGame(id, username) {
    if (isMongoConnected) {
      if (mongoose.isValidObjectId(id)) {
        return GameModel.deleteOne({ _id: id, ownerId: username })
      }
      return GameModel.deleteOne({ roomId: id, ownerId: username })
    }

    let games = readJson(GAMES_FILE, [])
    const initialLen = games.length
    games = games.filter((g) => !( (g._id === id || g.roomId === id) && (g.ownerId === username || !g.ownerId) ))
    writeJson(GAMES_FILE, games)
    return { deletedCount: initialLen - games.length }
  },
}
