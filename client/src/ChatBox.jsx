import { useState, useRef, useEffect } from 'react'

const QUICK_CHATS = [
  'Xin chào!',
  'Chúc may mắn!',
  'Nước cờ hay lắm!',
  'Cảm ơn!',
  'Xin hòa nhé?',
  'Hẹn tái đấu!',
]

export default function ChatBox({ chats = [], onSendMessage }) {
  const [text, setText] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [chats])

  function handleSend(e) {
    e.preventDefault()
    if (!text.trim()) return
    onSendMessage(text.trim())
    setText('')
  }

  function handleQuickChat(qc) {
    onSendMessage(qc)
  }

  return (
    <div className="chat-box">
      <div className="chat-messages" ref={listRef}>
        {chats.length === 0 ? (
          <p className="chat-empty">Chưa có tin nhắn nào. Hãy gửi lời chào đến đối thủ!</p>
        ) : (
          chats.map((c) => {
            if (c.isSystem) {
              return (
                <div key={c.id} className="chat-msg system">
                  <span className="system-text">📢 {c.text}</span>
                  <span className="msg-time">{c.time}</span>
                </div>
              )
            }
            const colorClass = c.sender?.color === 'r' ? 'red' : c.sender?.color === 'b' ? 'black' : 'spectator'
            return (
              <div key={c.id} className={`chat-msg ${colorClass}`}>
                <div className="msg-header">
                  <span className="msg-sender">{c.sender?.username}</span>
                  <span className="msg-time">{c.time}</span>
                </div>
                <div className="msg-body">{c.text}</div>
              </div>
            )
          })
        )}
      </div>

      <div className="quick-chat-row">
        {QUICK_CHATS.map((qc) => (
          <button
            key={qc}
            type="button"
            className="quick-chip"
            onClick={() => handleQuickChat(qc)}
          >
            {qc}
          </button>
        ))}
      </div>

      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          className="input chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          maxLength={200}
        />
        <button type="submit" className="btn-hex primary btn-sm chat-send-btn" disabled={!text.trim()}>
          Gửi
        </button>
      </form>
    </div>
  )
}
