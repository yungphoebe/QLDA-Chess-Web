import { useState } from 'react'
import Auth from './Auth.jsx'
import Lobby from './Lobby.jsx'
import Game from './Game.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [match, setMatch] = useState(null) // { mode, level } — giữ lại để về sảnh vẫn chọn sẵn chế độ cũ
  const [playing, setPlaying] = useState(false)

  if (!user) return <Auth onLogin={setUser} />
  if (!playing) {
    return (
      <Lobby
        user={user}
        initial={match}
        onPlay={(m) => {
          setMatch(m)
          setPlaying(true)
        }}
        onLogout={() => {
          setUser(null)
          setMatch(null)
        }}
      />
    )
  }
  return <Game {...match} user={user} onExit={() => setPlaying(false)} />
}
