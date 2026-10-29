# Sở Hán Tranh Hùng · Cờ tướng online

Đồ án môn Quản lý dự án: web chơi cờ tướng.

## Tính năng

- Đăng nhập / đăng ký (hiện mới có giao diện)
- Chọn chế độ: đấu với máy (Nhập môn, Trung cấp, Cao thủ), 2 người cùng máy
- Luật cờ tướng đầy đủ: chân mã, mắt tượng, ngòi pháo, tốt qua sông, cung tướng, cấm hai tướng đối mặt
- Máy chơi bằng negamax + cắt tỉa alpha-beta, chạy trong Web Worker
- Biên bản nước đi theo ký hiệu Việt Nam (P2-5, M2.3...)
- Mỗi loại quân có animation di chuyển riêng

## Công nghệ

- Client: React + Vite
- Server: Node.js + Express + Socket.IO (đang làm)

## Chạy thử

```bash
cd client
npm install
npm run dev
```

Mở http://localhost:5173

Chạy test luật cờ:

```bash
cd client
npm test
```

## Cấu trúc

```
client/
  src/xiangqi.js       luật cờ tướng + máy chơi
  src/xiangqi.test.js  test luật cờ
  src/aiWorker.js      chạy máy chơi ở luồng riêng
  src/Board.jsx        bàn cờ + animation
  src/Game.jsx         màn hình ván cờ
  src/Lobby.jsx        chọn chế độ
  src/Auth.jsx         đăng nhập / đăng ký
server/
  index.js             Express + Socket.IO
```

## Lộ trình

- [x] Bàn cờ, luật cờ, chơi 2 người cùng máy
- [x] Chơi với máy
- [ ] Tạo phòng, vào phòng bằng mã, chơi online (Socket.IO)
- [ ] Đăng ký / đăng nhập thật (JWT + MongoDB), lưu và tải ván cờ
- [ ] Chat trong phòng
- [ ] Mời bạn qua link
- [ ] Video call (WebRTC)
- [ ] Deploy
