# Cờ Tỷ Phú Việt

Game cờ tỷ phú nhiều người chơi thời gian thực. Bàn cờ 36 ô lấy theo tám nhóm
tỉnh thành Việt Nam và bốn thành phố biển, dựng 3D bằng Three.js, máy chủ
Colyseus giữ toàn quyền quyết định.

## Chạy thử

Cần Node.js 22 trở lên.

```bash
npm install
cp apps/backend/.env.example apps/backend/.env.development
```

Rồi mở `apps/backend/.env.development` và sinh hai khoá:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Chạy hai lần, dán vào `JWT_SECRET` và `SESSION_SECRET`. File này **không nằm
trong Git** — mỗi máy một khoá riêng.

Mở hai cửa sổ dòng lệnh:

```bash
npm run dev:server
```

```bash
npm run dev:web
```

Rồi mở <http://localhost:5180> ở **hai tab** — cần ít nhất hai người để bắt đầu.
Đăng nhập, một tab tạo phòng, tab kia vào phòng đó, rồi cả hai bấm **Sẵn sàng**.

Chưa cấu hình Google thì nút đăng nhập Google bị tắt và màn đăng nhập hiện
thêm lối **Vào thử với tên tạm** để chạy ở máy mình. Lối này tự tắt khi
`NODE_ENV=production` hoặc khi đã có khoá Google.

| Địa chỉ | Dùng để làm gì |
| --- | --- |
| <http://localhost:5180> | Giao diện người chơi |
| <http://localhost:2567/health> | Kiểm tra máy chủ còn sống |
| <http://localhost:2567/api/ban-co> | Dữ liệu bàn cờ dạng JSON |
| <http://localhost:2567/monitor> | Bảng theo dõi phòng đang mở |
| <http://localhost:2567/playground> | Công cụ gửi tin nhắn thử vào phòng |

Hai địa chỉ cuối chỉ bật khi `NODE_ENV` khác `production`.

## Cơ sở dữ liệu

PostgreSQL chạy bằng Docker ngay trên máy anh/chị. Tất cả đều miễn phí và mã
nguồn mở — không phải mua gói nào.

```bash
npm run db:bat      # bật PostgreSQL và Adminer
npm run db:day      # tạo bảng (chạy migration)
```

Rồi chạy server như bình thường. Kiểm tra bằng
<http://localhost:2567/health> — có `"luuTru": true` là đã nối được.

### Xem dữ liệu

Mở <http://localhost:8080> (Adminer, chạy sẵn trong `docker compose`):

| Ô | Điền |
| --- | --- |
| System | PostgreSQL |
| Server | `postgres` |
| Username | `cotyphu` |
| Password | `cotyphu` |
| Database | `cotyphu` |

Adminer chạy hoàn toàn trên máy, không gửi dữ liệu đi đâu. Ngoài ra còn
`npm run db:xem` mở Drizzle Studio — tiện hơn vì hiểu lược đồ, nhưng giao diện
của nó tải từ máy chủ của Drizzle.

### Ba bảng

| Bảng | Giữ gì |
| --- | --- |
| `nguoi_dung` | Tài khoản, tên, ảnh, số ván đã chơi và số ván thắng |
| `van_dau` | Mỗi ván một dòng: phòng nào, bắt đầu và kết thúc lúc nào, ai thắng |
| `ket_qua` | Kết quả từng người trong từng ván: tài sản, số ô, số nhà, có phá sản không |

**Mật khẩu phòng không nằm trong database.** Nó chỉ sống trong bộ nhớ của
phòng và mất khi phòng đóng.

### Lệnh hay dùng

| Lệnh | Việc |
| --- | --- |
| `npm run db:bat` | Bật PostgreSQL và Adminer |
| `npm run db:tat` | Tắt, vẫn giữ dữ liệu |
| `npm run db:xoa` | Tắt và **xoá sạch dữ liệu** |
| `npm run db:tao` | Sinh file migration sau khi sửa `schema.ts` |
| `npm run db:day` | Áp migration lên database |
| `npm run db:xem` | Mở Drizzle Studio |

### Không có database thì sao

Server vẫn chạy và chơi được bình thường, chỉ là không lưu lại gì: tài khoản
và lịch sử ván mất khi tắt. `/health` sẽ báo `"luuTru": false`. Làm vậy để
người mới tải mã về chơi thử được ngay mà chưa cần dựng Docker.

### Chuyển lên database trên mạng

Dữ liệu hiện nằm trên máy anh/chị, nên chỉ mình anh/chị chơi được và tắt máy
là tắt game. Khi cần người khác chơi thật, đổi `DATABASE_URL` trong
`apps/backend/.env.development` sang chuỗi kết nối của nhà cung cấp — Neon và
Supabase đều có gói miễn phí — rồi chạy lại `npm run db:day`. **Không phải sửa
dòng mã nào.**

## Đăng nhập bằng Google

1. Vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   tạo một **OAuth client ID** loại **Web application**.
2. Ở mục **Authorized redirect URIs**, thêm đúng địa chỉ này:

   ```
   http://localhost:2567/auth/provider/google/callback
   ```

   Khi lên môi trường thật thì thêm địa chỉ tương ứng của máy chủ, ví dụ
   `https://game.example.com/auth/provider/google/callback`.
3. Chép Client ID và Client secret vào `apps/backend/.env.development`:

   ```
   OAUTH_CLIENT_ID=...
   OAUTH_CLIENT_SECRET=...
   ```
4. Khởi động lại server. Nút Google tự bật, lối vào thử tự tắt.

`JWT_SECRET` và `SESSION_SECRET` là khoá ký token đăng nhập. Mỗi môi trường
một giá trị riêng, **không bao giờ đưa lên kho mã** — ai có khoá là tự ký được
token và đăng nhập thành bất kỳ ai. Mẫu nằm ở `.env.example` với giá trị rỗng;
file thật `.env.development` đã nằm trong `.gitignore`.

### Luồng đăng nhập chạy thế nào

Trình duyệt gọi `client.auth.signInWithProvider("google")`, cửa sổ phụ mở trang
Google, Google gọi ngược về `/auth/provider/google/callback` trên server, server
dựng hồ sơ người chơi rồi ký thành JWT trả về. Mỗi lần vào phòng, SDK đính kèm
JWT đó và `Room.onAuth` xác minh lại.

Tên hiển thị **lấy từ tài khoản đăng nhập**, không lấy từ dữ liệu client gửi
lên — có test riêng cho việc này.

## Phòng chơi

- Sảnh dùng `LobbyRoom` của Colyseus nên danh sách phòng cập nhật ngay khi có
  người tạo, vào hoặc rời phòng; không phải bấm tải lại.
- Phòng có thể đặt mật khẩu. Mật khẩu được băm bằng scrypt và chỉ nằm trong bộ
  nhớ của phòng — **không vào state, không vào thông tin hiển thị ở sảnh**, nên
  client không có đường nào đọc được. Có test kiểm tra điều này.
- Tối thiểu 2 người, tối đa 4. Ván bắt đầu khi tất cả bấm Sẵn sàng.
- Ván đã bắt đầu thì phòng bị khoá, người mới không vào được nữa.

## Cấu trúc

```
apps/
  shared/     @co-ty-phu/shared    dữ liệu bàn cờ và luật chơi, không phụ thuộc môi trường
  backend/    @co-ty-phu/backend   máy chủ Colyseus, nơi duy nhất được sửa trạng thái
  frontend/   @co-ty-phu/frontend  Three.js + HUD, chỉ đọc và vẽ lại
```

### Vì sao tách `shared`

Bảng giá đất, công thức tiền thuê, luật xây đều, điều kiện trọn nhóm — tất cả
nằm trong `apps/shared` và **cả hai bên cùng import**. Client tính trước để hiện
HUD ngay không phải chờ mạng, server tính lại để chốt. Viết một lần nên hai bên
không bao giờ lệch nhau.

Nếu viết backend bằng ngôn ngữ khác, luật chơi phải viết hai lần bằng hai ngôn
ngữ, rồi sẽ lệch — đây là nguồn lỗi kinh điển của game bàn online.

### Server giữ toàn quyền

Client chỉ gửi **ý định**: "tôi tung xúc xắc", "tôi mua", "tôi xây". Server mới
là bên gieo xúc xắc (`apps/backend/src/rng.ts`, dùng `crypto.randomInt`), kiểm
tra có đúng lượt không, có đủ tiền không, rồi cập nhật trạng thái và phát lại
cho cả phòng.

Không có đường nào để client tự khai kết quả xúc xắc hay tự cộng tiền. Thử gửi
`tungXucXac` khi chưa tới lượt thì tin nhắn bị bỏ qua — có test cho đúng việc
này.

## Luật đã cài

- Bàn 36 ô: 4 ô góc, 16 ô đất (8 nhóm × 2 ô), 4 ô biển, 2 tiện ích, 8 ô thẻ, 2 ô thuế
- Tung xúc xắc, đi qua Xuất phát nhận 200K
- Tung đôi được đi thêm lượt; đôi ba lần liên tiếp thì vào Đảo Hoang
- Đảo Hoang: tung đôi để ra, hoặc sau 3 lượt nộp 50K
- Mua đất, bỏ qua, trả tiền thuê
- Tiền thuê: đất lẻ theo mức cơ bản, trọn nhóm nhân đôi, có nhà thì theo bảng,
  ô biển theo số ô sở hữu (25/50/100/200K), tiện ích theo điểm xúc xắc (×4 hoặc ×10)
- Xây nhà và khách sạn, có kiểm tra trọn nhóm, **luật xây đều**, và giới hạn
  thật của hộp cờ (32 nhà, 12 khách sạn)
- Thẻ Cơ hội và Khí vận, mỗi bộ 10 thẻ, rút xong xuống đáy bộ
- Thiếu tiền thì **tự bán nhà rồi thế chấp đất** để gom đủ; vẫn không đủ thì phá sản
- Người cuối cùng còn trụ lại là người thắng
- Đồng hồ đếm ngược mỗi lượt; hết giờ server tự quyết thay (tự trả tiền thuê,
  tự bỏ qua ô chưa mua)
- Rớt mạng vẫn giữ ghế 60 giây, vào lại là chơi tiếp

### Chưa cài

Những phần này cố tình để lại, không phải quên:

- **Đấu giá.** Bỏ qua một ô thì ô đó vẫn trống, chưa có phiên đấu giá thật.
  Đây là luật quan trọng nhất còn thiếu — nó giữ cho ván chơi không kéo dài vô tận.
- **Giao dịch giữa người chơi.** Đổi đất, bán đất cho nhau, thoả thuận giá.
- **Thế chấp và giải chấp thủ công.** Hiện chỉ tự động khi thiếu tiền.
- **Lưu trữ.** Trạng thái nằm trong bộ nhớ tiến trình; server tắt là mất ván.
  Xem phần dưới.
- **Tài khoản.** Chưa có đăng nhập, ai vào cũng tạo người chơi mới.

## Lệnh

| Lệnh | Việc |
| --- | --- |
| `npm run dev:server` | Chạy máy chủ, tự nạp lại khi sửa mã |
| `npm run dev:web` | Chạy giao diện ở cổng 5180 |
| `npm run build` | Build cả ba package |
| `npm test` | Chạy bộ test luật chơi |
| `npm run typecheck` | Kiểm kiểu toàn bộ |

Sửa file trong `apps/shared` thì chạy lại `npm run build:shared` (hoặc
`npm run dev -w apps/shared` để tự build khi lưu).

## Test

```bash
npm test
```

Bộ test ở `apps/backend/test/CoTyPhuRoom.test.ts` dùng `@colyseus/testing` để
mở phòng thật và nối client thật vào. Nó kiểm tra cấu trúc bàn cờ, điều kiện bắt
đầu ván, việc chặn người chưa tới lượt, luồng mua đất, và các công thức tiền thuê.

## Đưa lên môi trường thật

Những việc cần làm thêm, theo thứ tự nên làm:

1. **Redis** cho đăng ký phòng và pub/sub giữa các tiến trình. Colyseus có sẵn
   driver; không có Redis thì chỉ chạy được một tiến trình duy nhất.
2. **PostgreSQL** cho tài khoản, lịch sử ván, số dư. Nên lưu **từng hành động
   dưới dạng nhật ký sự kiện** thay vì chỉ lưu trạng thái cuối — khi có tranh
   cãi hoặc người chơi rớt mạng, phát lại là ra.
3. **Tầng phân phối phòng.** WebSocket không co giãn như HTTP: kết nối bám dính
   vào một node, nên cần lớp điều phối để biết phòng nào đang ở node nào.
4. **Đặt máy chủ gần người chơi.** Singapore là lựa chọn gần Việt Nam nhất trong
   các nhà cung cấp lớn; muốn độ trễ thấp hơn nữa thì đặt trong nước.

Biến môi trường `VITE_SERVER` ở phía client để trỏ sang máy chủ khác, ví dụ
`VITE_SERVER=wss://game.example.com npm run build -w apps/frontend`.

## Phần 3D

`apps/frontend/src/board3d.ts` dựng toàn bộ cảnh bằng mã, không dùng file mô hình.

Camera **trực giao và cố định** — bàn cờ không xoay được. Đây là lựa chọn có
chủ đích: mọi ô có cùng kích thước trên màn hình, và vì góc nhìn không đổi nên
sau này có thể nướng sẵn ánh sáng, cắt bỏ phần khuất, hoặc thay nền xa bằng ảnh
dựng sẵn — những tối ưu không làm được nếu người chơi xoay được bàn cờ.

Chuỗi hậu kỳ: `RenderPass` → `UnrealBloomPass` → `OutputPass`. OutputPass lo
tone mapping và chuyển sang sRGB ở cuối, nên quầng sáng được tính trong không
gian tuyến tính. Ngưỡng bloom đặt ở 1.0 để chỉ những gì thật sự phát sáng mới
toả quầng — mặt ô màu trắng thì không.

Muốn nâng chất lượng hơn nữa thì thay các khối dựng bằng mã bằng mô hình glTF
dựng trong Blender, nén bằng Draco. Đó là thứ tạo khác biệt lớn nhất, lớn hơn
mọi hiệu ứng ánh sáng.
