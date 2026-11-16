# Luật chơi Cờ Tỷ Phú Việt

Tài liệu này mô tả đúng những gì mã nguồn đang làm. Sửa luật ở đây **không**
tự động đổi game — nhưng mỗi mục đều ghi rõ sửa ở file nào. Anh/chị cứ đánh
dấu vào đây rồi đưa lại, tôi sẽ sửa mã cho khớp.

Đơn vị tiền viết tắt là **K**, bằng 1.000 trong game. Ô giá 240K tức 240.000.

## Sửa ở đâu

| Muốn đổi | Mở file |
| --- | --- |
| Tên ô, giá đất, thứ tự ô trên bàn | `apps/shared/src/board.ts` |
| Tiền ban đầu, lương, tiền ra đảo, số nhà trong hộp | `apps/shared/src/board.ts` |
| Công thức tiền thuê, giá xây, giá thế chấp | `apps/shared/src/rules.ts` |
| Nội dung thẻ Cơ hội và Khí vận | `apps/shared/src/the.ts` |
| Thời gian mỗi lượt, số người tối đa | `apps/backend/src/rooms/CoTyPhuRoom.ts` |

Sửa xong chạy lại `npm run dev:server`. Nếu sửa trong `apps/shared` thì chạy
`npm run build:shared` trước.

## Chuẩn bị

- **2 đến 4 người**. Đủ 2 người và tất cả bấm Sẵn sàng là ván bắt đầu.
- Mỗi người cầm **1.500K** tiền mặt.
- Mọi người xuất phát ở ô **Xuất phát** và đi **thuận chiều kim đồng hồ**.
- Hộp cờ có **32 nhà** và **12 khách sạn**. Đây là giới hạn thật: hết nhà thì
  phải chờ người khác bán ra.

## Bàn cờ 36 ô

| Ô | Tên | Nhóm | Giá |
| --- | --- | --- | --- |
| 0 | XUẤT PHÁT | góc | — |
| 1 | Đồng Văn | Hà Giang | 60K |
| 2 | KHÍ VẬN | thẻ | — |
| 3 | Mèo Vạc | Hà Giang | 60K |
| 4 | THUẾ THU NHẬP | thuế | nộp 200K hoặc 10% tài sản |
| 5 | Biển Hạ Long | ô biển | 200K |
| 6 | Bắc Hà | Lào Cai | 100K |
| 7 | CƠ HỘI | thẻ | — |
| 8 | Sa Pa | Lào Cai | 120K |
| 9 | ĐẢO HOANG | góc | — |
| 10 | Tam Cốc | Ninh Bình | 140K |
| 11 | NHÀ MÁY ĐIỆN | tiện ích | 150K |
| 12 | Tràng An | Ninh Bình | 160K |
| 13 | CƠ HỘI | thẻ | — |
| 14 | Biển Đà Nẵng | ô biển | 200K |
| 15 | Thiên Mụ | Thừa Thiên Huế | 180K |
| 16 | KHÍ VẬN | thẻ | — |
| 17 | Đại Nội | Thừa Thiên Huế | 200K |
| 18 | LỄ HỘI TOÀN QUỐC | góc | — |
| 19 | Mỹ Sơn | Quảng Nam | 220K |
| 20 | CƠ HỘI | thẻ | — |
| 21 | Hội An | Quảng Nam | 240K |
| 22 | Biển Nha Trang | ô biển | 200K |
| 23 | Bảo Lộc | Lâm Đồng | 260K |
| 24 | CƠ HỘI | thẻ | — |
| 25 | Đà Lạt | Lâm Đồng | 280K |
| 26 | NHÀ MÁY NƯỚC | tiện ích | 150K |
| 27 | DU LỊCH XUYÊN VIỆT | góc | — |
| 28 | Thủ Thiêm | TP. Hồ Chí Minh | 300K |
| 29 | KHÍ VẬN | thẻ | — |
| 30 | Bến Thành | TP. Hồ Chí Minh | 320K |
| 31 | Biển Phú Quốc | ô biển | 200K |
| 32 | THUẾ XA XỈ | thuế | nộp 100K |
| 33 | Ba Đình | Hà Nội | 350K |
| 34 | CƠ HỘI | thẻ | — |
| 35 | Hoàn Kiếm | Hà Nội | 400K |

Số ô ở cột đầu chính là số dùng trong thẻ `diToi`.

## Một lượt chơi

1. Tung hai xúc xắc, đi số ô bằng tổng điểm.
2. Xử lý ô vừa dừng (mua, trả thuê, rút thẻ, nộp thuế…).
3. Tung ra **đôi** thì được đi thêm một lượt. **Đôi ba lần liên tiếp** thì vào
   Đảo Hoang ngay, không đi theo lần đôi thứ ba.

Mỗi lượt có đồng hồ: **30 giây** để tung, **25 giây** để quyết định. Hết giờ
server tự quyết thay — tự trả tiền thuê, tự bỏ qua ô chưa mua.

Đi qua hoặc dừng đúng ô Xuất phát đều nhận **200K**. Bị đưa thẳng vào Đảo
Hoang thì không nhận.

## Mua đất

Dừng ở ô chưa có chủ thì được mua đúng giá in trên bàn. Không mua thì ô đó
vẫn trống.

> **Chưa làm:** luật đấu giá. Trong cờ tỷ phú thật, người từ chối mua thì ô
> được đưa ra đấu giá cho cả bàn, giá khởi điểm có thể thấp tuỳ ý. Thiếu luật
> này thì đất lâu hết, không ai trọn nhóm được, và ván kéo dài. Đây là việc
> đáng làm tiếp nhất.

## Tiền thuê

Chủ đất thu tiền khi có người dừng lại. Đang thế chấp thì không thu được gì.

### Ô đất

| Tình trạng | Tiền thuê |
| --- | --- |
| Đất lẻ, chưa trọn nhóm | mức cơ bản |
| Trọn cả nhóm, chưa xây nhà | **gấp đôi** mức cơ bản |
| 1 nhà | 5× cơ bản |
| 2 nhà | 15× cơ bản |
| 3 nhà | 45× cơ bản |
| 4 nhà | 80× cơ bản |
| Khách sạn | 125× cơ bản |

Mức cơ bản bằng **1/10 giá mua**. Ví dụ Hoàn Kiếm 400K thì cơ bản 40K, trọn
nhóm 80K, ba nhà 1.800K, khách sạn 5.000K.

### Ô biển

Tính theo số ô biển người đó sở hữu, không phụ thuộc ô nào:

| Số ô biển | Tiền thuê |
| --- | --- |
| 1 | 25K |
| 2 | 50K |
| 3 | 100K |
| 4 | 200K |

### Ô tiện ích

- Sở hữu 1 ô: điểm xúc xắc **× 4**
- Sở hữu cả 2 ô: điểm xúc xắc **× 10**

## Xây nhà

Điều kiện: sở hữu **trọn nhóm**, không ô nào trong nhóm đang thế chấp, và
tuân thủ **luật xây đều** — số nhà giữa hai ô bất kỳ trong nhóm không lệch
nhau quá 1.

Giá xây mỗi căn bằng khoảng 1/4 giá mua, làm tròn tới bội số của 5K. Bốn nhà
rồi thì nâng lên khách sạn, trả 4 nhà về hộp.

Bán nhà lại cho nhà băng chỉ được **nửa giá xây**.

## Đảo Hoang

Ba cách vào: dừng ở ô Đảo Hoang không phải do ghé thăm, rút thẻ "vào Đảo
Hoang", hoặc tung đôi ba lần liên tiếp.

Ba cách ra: tung được đôi, hoặc sau **3 lượt** thì buộc nộp **50K**.

Ở trong đảo vẫn thu tiền thuê và xây nhà bình thường, chỉ mất quyền di chuyển.

## Thiếu tiền và phá sản

Không đủ tiền mặt thì server **tự bán nhà rồi thế chấp đất** để gom đủ. Vẫn
không đủ thì phá sản: tài sản trả hết về thị trường và người đó rời cuộc chơi.

> **Chưa làm:** thế chấp và bán nhà thủ công. Hiện người chơi không tự chọn
> bán gì, server tự quyết theo thứ tự ô trên bàn.

Người cuối cùng còn trụ lại là người thắng.

## Thẻ Cơ hội

Ô số 7, 13, 20, 24, 34. Mười thẻ, trộn riêng, rút xong xuống đáy bộ.

| Nội dung | Hiệu ứng |
| --- | --- |
| Trúng thầu dự án ven biển, nhận 150K. | nhận 150K |
| Đi thẳng về ô Xuất phát và nhận lương. | đi tới ô 0 |
| Lạc đường trên đèo, lùi lại 3 ô. | lùi 3 ô |
| Vi phạm quy hoạch, vào Đảo Hoang. | vào Đảo Hoang |
| Khách du lịch đông bất ngờ, nhận 100K. | nhận 100K |
| Chi phí quảng bá du lịch, nộp 80K. | nộp 80K |
| Bạn thắng cuộc thi khởi nghiệp, mỗi người trả bạn 50K. | thu 50K mỗi người |
| Đi thẳng tới Biển Nha Trang. | đi tới ô 22 |
| Bảo trì toàn bộ bất động sản: 25K mỗi nhà, 100K mỗi khách sạn. | sửa nhà |
| Cổ tức quỹ đầu tư, nhận 50K. | nhận 50K |

## Thẻ Khí vận

Ô số 2, 16, 29. Mười thẻ, trộn riêng.

| Nội dung | Hiệu ứng |
| --- | --- |
| Hoàn thuế cuối năm, nhận 200K. | nhận 200K |
| Viện phí sau chuyến leo núi, nộp 100K. | nộp 100K |
| Mừng khai trương, mỗi người trả bạn 30K. | thu 30K mỗi người |
| Khao cả bàn một chầu, trả mỗi người 40K. | trả 40K mỗi người |
| Bán lô đất cũ, nhận 120K. | nhận 120K |
| Phạt xây dựng sai phép, nộp 150K. | nộp 150K |
| Đi thẳng tới Hội An. | đi tới ô 21 |
| Trốn thuế bị phát hiện, vào Đảo Hoang. | vào Đảo Hoang |
| Tiền thưởng cuối quý, nhận 80K. | nhận 80K |
| Sửa chữa sau bão: 20K mỗi nhà, 75K mỗi khách sạn. | sửa nhà |

### Các kiểu hiệu ứng viết được

Khi thêm thẻ mới trong `apps/shared/src/the.ts`, chọn một trong tám kiểu:

| Kiểu | Viết | Ý nghĩa |
| --- | --- | --- |
| `nhan` | `{ loai: "nhan", so: 150 }` | Nhà băng trả cho người rút |
| `nop` | `{ loai: "nop", so: 80 }` | Người rút trả cho nhà băng |
| `thuMoiNguoi` | `{ loai: "thuMoiNguoi", so: 50 }` | Mỗi người khác trả cho người rút |
| `traMoiNguoi` | `{ loai: "traMoiNguoi", so: 40 }` | Người rút trả cho từng người khác |
| `diToi` | `{ loai: "diToi", o: 22 }` | Đi tới ô số 22, nhận lương nếu qua Xuất phát |
| `vaoDao` | `{ loai: "vaoDao" }` | Vào Đảo Hoang, không nhận lương |
| `luiLai` | `{ loai: "luiLai", so: 3 }` | Lùi lại 3 ô |
| `suaNha` | `{ loai: "suaNha", moiNha: 25, moiKhachSan: 100 }` | Nộp tiền theo số nhà đang có |

Muốn thêm kiểu hiệu ứng hoàn toàn mới thì cần sửa cả `the.ts` và hàm
`apDungThe` trong `apps/backend/src/rooms/CoTyPhuRoom.ts` — nhắn tôi.

## Những luật chưa làm

Liệt kê để anh/chị biết game đang thiếu gì so với cờ tỷ phú đầy đủ:

- **Đấu giá** khi người dừng chân từ chối mua — quan trọng nhất
- **Giao dịch giữa người chơi**: đổi đất, bán đất cho nhau
- **Thế chấp và giải chấp thủ công**
- **Thẻ "Thoát khỏi Đảo Hoang"** giữ lại dùng sau
- Luật nhà tuỳ chọn: gom thuế vào Bãi đỗ xe, nhận gấp đôi khi dừng đúng ô
  Xuất phát
