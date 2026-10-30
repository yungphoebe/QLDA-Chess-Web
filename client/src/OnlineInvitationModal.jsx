export default function OnlineInvitationModal({ invitation, onAccept, onDecline }) {
  if (!invitation) return null

  return (
    <div className="modal-backdrop invitation-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card invitation-card">
        <div className="invitation-icon">⚔️</div>
        <h3>Lời mời thách đấu!</h3>
        <p className="invitation-msg">
          Người chơi <strong className="highlight">{invitation.fromUsername}</strong> mời bạn tham gia ván cờ online.
        </p>
        <div className="room-code-badge small">
          <span className="code-label">Phòng</span>
          <span className="code-value">{invitation.roomId}</span>
        </div>

        <div className="invitation-actions">
          <button className="btn-hex primary" onClick={onAccept}>
            Chấp nhận
          </button>
          <button className="btn-hex" onClick={onDecline}>
            Từ chối
          </button>
        </div>
      </div>
    </div>
  )
}
