import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

const app = express()
app.use(cors())
app.use(express.json())
app.get('/api/health', (req, res) => res.json({ ok: true }))

const server = createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

io.on('connection', (socket) => {
  console.log('connected', socket.id)
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`Server chạy ở http://localhost:${PORT}`))
