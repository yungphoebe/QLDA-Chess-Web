# Sở Hán Tranh Hùng · Cờ tướng online

Đồ án môn Quản lý dự án: web chơi cờ tướng online thời gian thực.

## Tính năng đã hoàn thiện

1. **Đăng nhập / Đăng ký**:
   - Xác thực bảo mật bằng JWT + Bcrypt.
   - Hỗ trợ chơi nhanh bằng tài khoản Khách (Guest).
2. **Chế độ chơi đa dạng**:
   - Đấu với máy (3 cấp độ: Nhập môn, Trung cấp, Cao thủ) chạy negamax + alpha-beta trong Web Worker.
   - Chơi 2 người trên cùng 1 máy (PvP cục bộ).
   - Đấu online 2 người thời gian thực qua mạng bằng Socket.IO.
3. **Mời bạn**:
   - Tạo phòng sinh mã phòng 6 ký tự ngẫu nhiên (vd: `ABC123`).
   - Vào phòng bằng mã phòng hoặc truy cập trực tiếp đường link `.../?room=ABC123` hoặc `.../room/ABC123`.
   - Nút **Sao chép link** và hộp thoại **Chia sẻ qua mạng xã hội** (Facebook, Zalo, Telegram, X, WhatsApp, Web Share API).
   - Mời bạn trong game từ **Danh sách người chơi đang online** (thông báo lời mời thời gian thực: Chấp nhận / Từ chối).
4. **Chơi 2 người online**:
   - Đồng bộ nước đi qua Socket.IO server.
   - Server kiểm tra tính hợp lệ của từng nước đi bằng `xiangqi.js` (Server-side validation) để chống gian lận.
   - Xử lý mất kết nối (disconnect) và tự động vào lại (reconnect / rejoin) mà không mất ván cờ.
   - Hỗ trợ tính năng Cầu hòa (Offer Draw) và Đầu hàng (Resign).
5. **Lưu / Tải bàn cờ**:
   - Lưu ván cờ (thế cờ 90 ô + toàn bộ biên bản nước đi) vào MongoDB (kèm cơ chế fallback lưu trữ JSON an toàn khi chưa bật MongoDB).
   - Danh sách các ván đã chơi / đã lưu của người dùng.
   - Chơi tiếp ván dở (tiếp tục nước đi và thế cờ đã lưu).
6. **Chat trong phòng**:
   - Khung chat thời gian thực cạnh bàn cờ qua Socket.IO.
   - Phân biệt màu quân người gửi (Đỏ, Đen, Khán giả) và tin nhắn thông báo hệ thống.
   - Hàng nút tin nhắn nhanh (Quick chat) tiện lợi: "Xin chào!", "Nước cờ hay lắm!", "Xin hòa nhé?", v.v.

---

## Công nghệ

- **Client**: React 19, Vite, Socket.IO Client.
- **Server**: Node.js, Express, Socket.IO, Mongoose / MongoDB, JWT, Bcrypt.

---

## Hướng dẫn chạy

### 1. Chạy Server

```bash
cd server
npm install
npm run start
```
Server chạy tại: `http://localhost:3001`

*(Tùy chọn: Bạn có thể chỉnh sửa file `server/.env` để cấu hình `MONGODB_URI` kết nối MongoDB Atlas hoặc MongoDB local).*

### 2. Chạy Client

```bash
cd client
npm install
npm run dev
```
Client chạy tại: `http://localhost:5173`

### 3. Chạy kiểm thử tự động (Unit & Integration Tests)

Kiểm thử luật cờ client:
```bash
cd client
npm test
```

Kiểm thử 4 tính năng server (Phòng, Validate nước đi, Reconnect, Lưu/Tải MongoDB, Chat):
```bash
cd server
npm test
```
