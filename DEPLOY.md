# Đưa game lên mạng

Hai nửa deploy riêng nhau:

| Phần | Là gì | Deploy ở đâu |
| --- | --- | --- |
| Frontend | Trang tĩnh HTML/JS, build bằng Vite | Vercel, Netlify, Cloudflare Pages… |
| Backend | Server Colyseus giữ WebSocket + PostgreSQL | Render, Railway, Fly.io, VPS |

Backend **không** đưa lên serverless được (Vercel Functions, Netlify
Functions, Cloudflare Workers). Đây là server giữ kết nối WebSocket sống
suốt ván và giữ trạng thái phòng trong bộ nhớ, nó cần một tiến trình chạy
liên tục.

---

## Phần 1 — Backend

### Dùng Render (cách đang chuẩn bị sẵn)

Trong repo đã có `Dockerfile` và `render.yaml`, nên Render dựng được cả
server lẫn PostgreSQL chỉ từ repo.

1. Vào [dashboard.render.com](https://dashboard.render.com) → **New** →
   **Blueprint** → chọn repo `3nabui/monopoly`.
2. Render đọc `render.yaml`, hiện ra một web service và một database. Bấm
   **Apply**.
3. Đợi build xong (lần đầu khoảng 3–5 phút). `JWT_SECRET`, `SESSION_SECRET`
   và `DATABASE_URL` Render tự sinh và tự nối, không phải điền.
4. Mở `https://<tên-service>.onrender.com/health`. Thấy
   `{"ok":true,...,"luuTru":true}` là server sống và đã nối được database.

Bảng trong database **tự dựng lúc server khởi động**, không phải chạy
migration bằng tay.

Bốn điểm của gói free cần biết trước:

- Web service **ngủ sau 15 phút không có lưu lượng vào**. Tin nhắn WebSocket
  cũng tính là lưu lượng, nên đang chơi thì không ngủ; nhưng cả bàn rời đi
  rồi quay lại sau là mất phòng, và lần đánh thức mất khoảng một phút. Chơi
  thật thì nâng lên gói Starter để server không ngủ.
- Mỗi workspace được **750 giờ chạy miễn phí mỗi tháng**. Một server chạy
  suốt ngày đêm hết khoảng 730 giờ, nên một service thì vừa đủ.
- Database free **hết hạn sau 30 ngày**. Sau đó có 14 ngày để nâng gói;
  quá hạn đó Render **xoá hẳn database cùng toàn bộ dữ liệu**. Lịch sử ván
  đấu mất, nhưng game vẫn chơi được bình thường.
- Mỗi workspace chỉ được **một database free**, dung lượng 1 GB, không sao
  lưu.

### Chỗ khác

`Dockerfile` ở thư mục gốc chạy được ở bất cứ đâu nhận Docker:

```bash
docker build -t co-ty-phu .
docker run -p 2567:2567 -e JWT_SECRET=... -e SESSION_SECRET=... \
  -e DATABASE_URL=postgres://... co-ty-phu
```

- **Railway** — nhận Dockerfile, thêm PostgreSQL bằng một cú bấm. Rẻ và
  tiện cho dự án nhỏ, nhưng tính tiền theo mức dùng nên khó đoán trước.
- **Fly.io** — rẻ nhất cho máy chia sẻ CPU, nhưng Postgres quản lý là dịch
  vụ riêng và đắt hơn hẳn; thường phải tự dựng Postgres.
- **VPS tự quản** — chạy Docker rồi đặt Nginx phía trước. Nginx phải chuyển
  tiếp được WebSocket:

  ```nginx
  location / {
      proxy_pass http://localhost:2567;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_read_timeout 86400s;
  }
  ```

### Biến môi trường của backend

| Biến | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `JWT_SECRET` | Có | Chuỗi ngẫu nhiên dài. Đổi nó là mọi người bị đăng xuất. |
| `SESSION_SECRET` | Có | Như trên. |
| `DATABASE_URL` | Không | Thiếu thì game vẫn chơi được, chỉ không lưu lịch sử. |
| `OAUTH_CLIENT_ID` | Không | Thiếu thì nút đăng nhập Google tắt. |
| `OAUTH_CLIENT_SECRET` | Không | Đi cùng cái trên. |
| `BACKEND_URL` | Không | Địa chỉ công khai của chính server. Trên Render tự lấy từ `RENDER_EXTERNAL_URL`, chỗ khác phải đặt tay. |
| `PORT` | Không | Mặc định 2567. Render **không** tự đặt biến này — `render.yaml` khai sẵn rồi; chỗ khác thì tự đặt cho khớp cổng dịch vụ mong đợi. |
| `NODE_ENV` | Nên | Đặt `production` để tắt `/monitor` và `/playground`. |

Hai chuỗi bí mật sinh bằng:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Chạy nhiều bản server

**Đừng**, trừ khi đã thêm Redis. Colyseus giữ danh sách phòng trong bộ nhớ
tiến trình; chạy hai bản thì mỗi bản thấy một danh sách khác nhau và người
chơi vào nhầm bản là không gặp được nhau. Muốn chạy nhiều bản thì phải cài
`@colyseus/redis-presence` và `@colyseus/redis-driver` trước.

---

## Phần 2 — Frontend

Build ra thư mục tĩnh, đưa lên đâu cũng được.

Cấu hình trên Vercel:

| Mục | Giá trị |
| --- | --- |
| Root Directory | `co-ty-phu/apps/frontend` |
| Build Command | để mặc định (`npm run build`) |
| Output Directory | `dist` |
| Install Command | để mặc định |

Một biến môi trường, **bắt buộc**:

```
VITE_SERVER = wss://<tên-service>.onrender.com
```

Phải là `wss://` chứ không phải `https://`, và không có dấu `/` ở cuối. Thiếu
biến này thì trang sẽ đi tìm server ở `ws://<chính nó>:2567` và không nối
được. Đổi biến xong phải **deploy lại**, Vite nhúng nó vào lúc build chứ
không đọc lúc chạy.

> Lần deploy đầu bị lỗi `Rolldown failed to resolve import "@co-ty-phu/shared"`
> là vì Vercel chỉ chạy `vite build` trong `apps/frontend` nên gói dùng chung
> chưa được dựng. Đã sửa bằng script `prebuild` trong
> `apps/frontend/package.json`, giờ nó tự dựng `shared` trước.

---

## Phần 3 — Đăng nhập Google

Làm sau cùng, khi đã biết địa chỉ thật của cả hai bên.

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   → **Create credentials** → **OAuth client ID** → **Web application**.
2. **Authorized redirect URIs**, điền đúng chuỗi này:

   ```
   https://<tên-service>.onrender.com/auth/provider/google/callback
   ```

3. Chép Client ID và Client secret vào `OAUTH_CLIENT_ID` và
   `OAUTH_CLIENT_SECRET` trên Render, rồi deploy lại backend.

Chưa làm bước này thì server vẫn chạy bình thường, chỉ là nút Google bị tắt.
Lối "vào thử với tên tạm" **không** bật ở môi trường production — cứ bấm là
có tài khoản mới, không kiểm chứng được ai là ai.

---

## Kiểm tra sau khi deploy

```bash
curl https://<backend>/health
```

Mong đợi `{"ok":true,"google":true,"luuTru":true,...}`:

- `google: false` → chưa điền hai biến OAuth.
- `luuTru: false` → chưa nối được database, xem log của service.

Rồi mở trang frontend, tạo một phòng và mở thêm một cửa sổ ẩn danh vào cùng
phòng đó. Hai bên thấy nhau là xong.

### Hỏng ở đâu thì xem gì

| Triệu chứng | Nguyên nhân thường gặp |
| --- | --- |
| Trang hiện "Đang kết nối…" mãi | `VITE_SERVER` sai, hoặc còn để `https://` thay vì `wss://` |
| Bấm Google xong quay về trang trắng | Redirect URI trên Google không khớp `BACKEND_URL` |
| Chơi được nhưng không lưu lịch sử | `DATABASE_URL` sai, xem log có dòng `[db]` |
| Vào phòng xong vài phút thì mất kết nối | Server gói free đã ngủ |
