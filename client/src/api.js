const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const auth = localStorage.getItem('auth_user')
  if (auth) {
    try {
      const parsed = JSON.parse(auth)
      if (parsed?.token) {
        headers['Authorization'] = `Bearer ${parsed.token}`
      }
    } catch {}
  }
  return headers
}

export async function login(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại')
  return data
}

export async function register(username, email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại')
  return data
}

export async function saveGame(gameData) {
  const res = await fetch(`${BASE_URL}/api/games/save`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(gameData),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Lưu ván cờ thất bại')
  return data
}

export async function getGames(username) {
  const query = username ? `?username=${encodeURIComponent(username)}` : ''
  const res = await fetch(`${BASE_URL}/api/games${query}`, {
    headers: getHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Không thể lấy danh sách ván cờ')
  return data.games || []
}

export async function getGame(id) {
  const res = await fetch(`${BASE_URL}/api/games/${id}`, {
    headers: getHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Không thể lấy ván cờ')
  return data.game
}

export async function deleteGame(id, username) {
  const query = username ? `?username=${encodeURIComponent(username)}` : ''
  const res = await fetch(`${BASE_URL}/api/games/${id}${query}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Không thể xóa ván cờ')
  return data
}
