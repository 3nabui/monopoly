# Cờ Tỷ Phú Việt

Game cờ tỷ phú nhiều người chơi thời gian thực. Bàn cờ 36 ô lấy theo tám nhóm
tỉnh thành Việt Nam và bốn thành phố biển, dựng 3D bằng Three.js, máy chủ
Colyseus giữ toàn quyền quyết định.

## Chạy thử

Cần Node.js 22 trở lên.

```bash
npm install
```

Mở hai cửa sổ dòng lệnh:

```bash
npm run dev:server
```

```bash
npm run dev:web
```

Rồi mở <http://localhost:5180> ở **hai tab** — cần ít nhất hai người để bắt đầu.
Nhập tên, bấm **Sẵn sàng** ở cả hai tab là ván chạy.

| Địa chỉ | Dùng để làm gì |
| --- | --- |
| <http://localhost:5180> | Giao diện người chơi |
| <http://localhost:2567/health> | Kiểm tra máy chủ còn sống |
| <http://localhost:2567/api/ban-co> | Dữ liệu bàn cờ dạng JSON |
| <http://localhost:2567/monitor> | Bảng theo dõi phòng đang mở |
| <http://localhost:2567/playground> | Công cụ gửi tin nhắn thử vào phòng |

Hai địa chỉ cuối chỉ bật khi `NODE_ENV` khác `production`.

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
