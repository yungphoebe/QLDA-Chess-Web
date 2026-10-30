import { useState } from 'react'

export default function ShareModal({ roomId, onClose }) {
  const [copied, setCopied] = useState(false)

  // Link tham gia phòng
  const shareUrl = `${window.location.origin}?room=${roomId}`
  const shareTitle = `Thách đấu cờ tướng online!`
  const shareText = `Vào thách đấu cờ tướng với tôi tại phòng ${roomId}: ${shareUrl}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        })
      } catch {}
    } else {
      handleCopy()
    }
  }

  const socialLinks = [
    {
      name: 'Facebook',
      icon: '📘',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Zalo',
      icon: '💬',
      url: `https://zalo.me/share?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Telegram',
      icon: '✈️',
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'X (Twitter)',
      icon: '🐦',
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'WhatsApp',
      icon: '🟢',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`,
    },
  ]

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card share-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Mời bạn bè vào phòng</h3>
          <button className="icon-btn close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="room-code-badge">
          <span className="code-label">MÃ PHÒNG</span>
          <span className="code-value">{roomId}</span>
        </div>

        <div className="copy-section">
          <input className="input share-link-input" readOnly value={shareUrl} />
          <button className={`btn-hex ${copied ? 'copied' : 'primary'}`} onClick={handleCopy}>
            {copied ? '✓ Đã sao chép!' : 'Sao chép link'}
          </button>
        </div>

        {navigator.share && (
          <button className="btn-hex native-share-btn" onClick={handleNativeShare}>
            📲 Chia sẻ qua ứng dụng thiết bị
          </button>
        )}

        <div className="social-grid-title">Chia sẻ qua mạng xã hội:</div>
        <div className="social-grid">
          {socialLinks.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn"
            >
              <span className="social-icon">{s.icon}</span>
              <span className="social-name">{s.name}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
