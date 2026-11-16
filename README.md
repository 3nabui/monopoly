# Cờ Tỷ Phú Việt

Game cờ tỷ phú nhiều người chơi, bàn cờ 36 ô lấy theo tám nhóm tỉnh thành Việt
Nam và bốn thành phố biển.

Kho này có hai phần:

| Thư mục | Là gì |
| --- | --- |
| [`co-ty-phu/`](co-ty-phu/) | Dự án thật: monorepo gồm server Colyseus, client Three.js và package luật chơi dùng chung. Xem [README của nó](co-ty-phu/README.md) để biết cách chạy. |
| `co-ty-phu-viet.html` | Bản mẫu giao diện 3D chạy độc lập, mở thẳng bằng trình duyệt, không cần server. Dùng để xem và góp ý về hình ảnh trước khi code. |

## Chạy nhanh

```bash
cd co-ty-phu
npm install
```

Rồi mở hai cửa sổ dòng lệnh:

```bash
npm run dev:server
```

```bash
npm run dev:web
```

Mở <http://localhost:5180> ở hai tab — cần ít nhất hai người để bắt đầu ván.
