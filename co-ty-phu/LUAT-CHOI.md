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
| Tiền thuê, giá xây, giá mua đứt, điều kiện thắng | `apps/shared/src/rules.ts` |
| Nội dung thẻ Cơ hội | `apps/shared/src/the.ts` |
| Thời gian mỗi lượt, số người tối đa | `apps/backend/src/rooms/CoTyPhuRoom.ts` |

Mấy con số hay phải chỉnh nhất đã gom thành hằng số đặt tên sẵn ở đầu
`rules.ts`: `HE_SO_MUA_DUT`, `SO_NHOM_THANG`, `BAC_TOI_DA_VONG_DAU`,
`LUOT_MAT_DIEN`, `BAC_KHACH_SAN`.

Sửa xong chạy lại `npm run dev:server`. Nếu sửa trong `apps/shared` thì chạy
`npm run build:shared` trước.

## Chuẩn bị

- **Chủ phòng chọn số người** lúc tạo phòng: 2, 3 hoặc 4. Phòng chỉ nhận đúng
  ngần ấy người, và phải đủ cả ngần ấy người cùng bấm Sẵn sàng thì ván mới
  bắt đầu — thiếu một người là vẫn chờ.
- Mỗi người cầm **1.500K** tiền mặt.
- Mọi người xuất phát ở ô **Xuất phát** và đi **thuận chiều kim đồng hồ**.
- Hộp cờ có **32 nhà** và **12 khách sạn**. Đây là giới hạn thật: hết nhà thì
  phải chờ người khác bán ra.

## Bàn cờ 32 ô

Bốn ô góc nằm ở vị trí 0, 8, 16, 24; mỗi cạnh có 7 ô thường nằm giữa hai góc.

| Ô | Tên | Nhóm | Giá |
| --- | --- | --- | --- |
| 0 | XUẤT PHÁT | góc | — |
| 1 | Đồng Văn | Hà Giang | 60K |
| 2 | Mèo Vạc | Hà Giang | 60K |
| 3 | Lũng Cú | Hà Giang | 80K |
| 4 | Biển Hạ Long | ô biển | 200K |
| 5 | Bắc Hà | Lào Cai | 100K |
| 6 | Bát Xát | Lào Cai | 100K |
| 7 | Sa Pa | Lào Cai | 120K |
| 8 | ĐẢO HOANG | góc | — |
| 9 | Tam Cốc | Ninh Bình | 140K |
| 10 | Hoa Lư | Ninh Bình | 140K |
| 11 | Tràng An | Ninh Bình | 160K |
| 12 | CƠ HỘI | thẻ | — |
| 13 | Thiên Mụ | Thừa Thiên Huế | 180K |
| 14 | Biển Đà Nẵng | ô biển | 200K |
| 15 | Đại Nội | Thừa Thiên Huế | 200K |
| 16 | LỄ HỘI TOÀN QUỐC | góc | Chọn ô đăng cai |
| 17 | Mỹ Sơn | Quảng Nam | 220K |
| 18 | Biển Nha Trang | ô biển | 200K |
| 19 | Hội An | Quảng Nam | 240K |
| 20 | CƠ HỘI | thẻ | — |
| 21 | Bảo Lộc | Lâm Đồng | 260K |
| 22 | Đà Lạt | Lâm Đồng | 280K |
| 23 | Đức Trọng | Lâm Đồng | 260K |
| 24 | DU LỊCH XUYÊN VIỆT | góc | Chọn ô để đi tới |
| 25 | Biển Phú Quốc | ô biển | 200K |
| 26 | Thủ Thiêm | TP. Hồ Chí Minh | 300K |
| 27 | Bến Thành | TP. Hồ Chí Minh | 320K |
| 28 | CƠ HỘI | thẻ | — |
| 29 | Ba Đình | Hà Nội | 350K |
| 30 | ĐÓNG THUẾ | thuế | 10% tài sản, tối đa 200K |
| 31 | Hoàn Kiếm | Hà Nội | 400K |

Tám nhóm đất: Hà Giang, Lào Cai, Ninh Bình, Lâm Đồng mỗi nhóm 3 ô; Thừa Thiên
Huế, Quảng Nam, TP. Hồ Chí Minh, Hà Nội mỗi nhóm 2 ô. Tổng 20 ô đất.

Bốn ô biển: Hạ Long (4), Đà Nẵng (14), Nha Trang (18), Phú Quốc (25).

Số ô ở cột đầu chính là số dùng trong thẻ `diToi`.

## Một lượt chơi

1. Tung hai xúc xắc. Hai quân lăn khoảng 3 giây, dừng lại, kết quả hiện ở
   giữa màn hình cho cả bàn cùng thấy, rồi quân cờ mới bắt đầu đi.
2. Đi số ô bằng tổng điểm, rồi xử lý ô vừa dừng (mua, trả thuê, mua đứt,
   rút thẻ, nộp thuế…).
3. Tung ra **đôi** thì được đi thêm một lượt. **Đôi ba lần liên tiếp** thì vào
   Đảo Hoang ngay, không đi theo lần đôi thứ ba.

Mỗi lượt có đồng hồ: **30 giây** để tung, **25 giây** cho mọi quyết định
(mua, mua đứt, xây, bán gom tiền, chọn ô cho thẻ). Hết giờ server tự quyết
thay, không ai bị treo ván vì người khác rời máy.

Đi qua hoặc dừng đúng ô Xuất phát đều nhận **200K**, và tính là sang vòng mới.

## Mua đất

Dừng ở ô chưa có chủ thì được chọn một trong bốn mức, không bị ép một giá:

| Chọn | Phải trả |
| --- | --- |
| Mua đất | giá đất |
| Mua kèm 1 nhà | giá đất + 1 × giá xây |
| Mua kèm 2 nhà | giá đất + 2 × giá xây |
| Mua kèm 3 nhà | giá đất + 3 × giá xây |

Ví dụ Đồng Văn giá 60K, giá xây 15K mỗi bậc: 60K / 75K / 90K / 105K.

Mua kèm nhà không rẻ hơn mua rồi xây dần về tiền — vẫn đúng giá đất cộng
đúng giá xây — chỉ đỡ phải chờ tới lượt sau. **Không mua thẳng lên khách
sạn**: bậc cuối phải xây riêng. Ô biển thì chỉ mua đất, không xây được.

Luật vòng đầu vẫn áp dụng: vòng thứ nhất chỉ mua kèm tối đa 2 nhà.

Không mua thì ô đó vẫn trống.

Ô vừa mua chưa có nhà nào — trên bàn 3D nó được **cắm một lá cờ** màu người
chơi. Đó là bậc 0 của thang công trình.

## Thang công trình

Năm bậc, thay cho thang sáu bậc của cờ tỷ phú cổ điển:

```
mua đất (cắm cờ) → 1 nhà → 2 nhà → 3 nhà → khách sạn
```

**Xây tự do.** Ô đất nào của mình cũng xây được — không cần sở hữu trọn nhóm,
không có luật xây đều, muốn dồn hết nhà vào một ô cũng được. Đây là khác biệt
lớn nhất so với cờ tỷ phú cổ điển: tiền thuê leo nhanh hơn hẳn và ván ngắn lại.

Chỉ còn bốn thứ chặn lại, và cả bốn đều là ràng buộc vật lý chứ không phải
điều kiện luật:

- Ô phải là **đất của mình** và **chưa thế chấp**.
- Ô **chưa lên khách sạn** (đã ở bậc cuối thì thôi).
- **Hộp cờ còn quân** — 32 nhà và 12 khách sạn là giới hạn thật.
- **Đủ tiền mặt.**

Giá xây mỗi bậc bằng khoảng 1/4 giá mua, làm tròn tới bội số của 5K. Lên
khách sạn thì trả 3 nhà về hộp và lấy ra 1 khách sạn.

**Luật vòng đầu:** tính từ ô Xuất phát, người chơi ở **vòng thứ nhất không
được xây tới bậc 3 nhà** ở bất cứ ô nào — tối đa 2 nhà. Qua ô Xuất phát là
sang vòng 2, hết hạn chế. Luật này giữ cho người đi sau không bị bỏ xa ngay
từ đầu ván.

Bán một bậc lại cho nhà băng chỉ được **nửa giá xây**.

## Tiền thuê

Chủ đất thu tiền khi có người dừng lại. Đang thế chấp hoặc đang mất điện thì
không thu được gì.

### Ô đất

| Bậc | Tiền thuê |
| --- | --- |
| Mua đất, chưa trọn nhóm | mức cơ bản |
| Mua đất, đã trọn cả nhóm | **gấp đôi** mức cơ bản |
| 1 nhà | 4× cơ bản |
| 2 nhà | 10× cơ bản |
| 3 nhà | 22× cơ bản |
| Khách sạn | 40× cơ bản |

Mức cơ bản bằng **1/10 giá mua**.

Vài ô tiêu biểu, tính bằng K:

| Ô | Giá | Xây mỗi bậc | 1 nhà | 2 nhà | 3 nhà | Khách sạn |
| --- | --- | --- | --- | --- | --- | --- |
| Đồng Văn | 60 | 15 | 24 | 60 | 132 | 240 |
| Sa Pa | 120 | 30 | 48 | 120 | 264 | 480 |
| Tam Cốc | 140 | 35 | 56 | 140 | 308 | 560 |
| Hội An | 240 | 60 | 96 | 240 | 528 | 960 |
| Bến Thành | 320 | 80 | 128 | 320 | 704 | 1.280 |
| Hoàn Kiếm | 400 | 100 | 160 | 400 | 880 | 1.600 |

Bậc cuối cố ý dừng ở 40× chứ không phải 125× như cờ tỷ phú cổ điển. Từ khi bỏ
luật trọn nhóm thì một ô lẻ cũng lên được khách sạn, nên nếu giữ 125× thì ô
đắt nhất thu 5.000K — gấp hơn ba lần tiền khởi điểm, ai dừng vào là phá sản
ngay tại chỗ. Ở mức 40×, Hoàn Kiếm thu 1.600K, nhỉnh hơn tiền khởi điểm một
chút: vẫn là đòn rất đau nhưng bán bớt tài sản thì còn đường sống.

Năm hệ số này nằm ở `HE_SO_THUE` trong `rules.ts`, sửa một dòng là xong. Hạ
bậc cuối thì ván dài ra, nâng lên thì ván ngắn lại.

Trọn nhóm vẫn được thưởng gấp đôi ở bậc chưa xây, và vẫn là một trong ba cách
thắng ván — nhưng nó không còn là điều kiện để xây nữa.

### Ô biển

| Số ô biển | Tiền thuê |
| --- | --- |
| 1 | 25K |
| 2 | 60K |
| 3 | 150K |
| 4 | 300K |

Mức thứ tư không bao giờ thu được: gom đủ cả bốn ô biển là thắng ngay, ván
dừng tại đó.

## Du lịch xuyên Việt

Dừng ở ô góc 24 thì được **chọn một ô đất hoặc ô biển bất kỳ** trên bàn cờ để
đi tới. Không chọn được ô góc, ô Cơ hội hay ô thuế — đi tới đó thì chẳng để
làm gì.

Đi ngang ô Xuất phát trên đường tới vẫn **nhận đủ 200K** và tính là sang vòng
mới. Tới nơi thì ô đó được xử lý như một nước đi bình thường: chưa có chủ thì
được mua, có chủ thì trả tiền thuê rồi chọn mua đứt.

Hết 25 giây không chọn thì server đi tới ô hợp lệ đầu tiên.

## Lễ hội

Hai loại cờ lễ hội, đều làm ô đắt lên. Ô mang cờ nào thì **tiền thuê, giá mua
và giá mua đứt** của ô đó nhân lên theo hệ số.

| Loại cờ | Hệ số | Ai đặt |
| --- | --- | --- |
| Lễ hội thường | ×2 | Server giăng ngẫu nhiên 2 ô lúc mở ván, cố định suốt trận |
| Lễ hội toàn quốc | ×3 | Người chơi, khi dừng ở ô góc Lễ hội toàn quốc |
| Một ô mang cả hai | ×6 | |

**Lễ hội thường.** Mở ván, server chọn ngẫu nhiên 2 ô để giăng cờ. Chỉ chọn
trong ô đất và ô biển — ô góc, ô Cơ hội và ô Đóng thuế không có giá nên không
giăng. Hai ô này không ai dời được, là hai điểm nóng cố định mà cả bàn nhìn
thấy ngay từ đầu.

**Lễ hội toàn quốc.** Cả bàn chỉ có **đúng một ô** mang cờ này. Dừng ở ô góc
16 thì được chọn một ô đất của mình để đăng cai — cờ ở chỗ cũ hạ xuống, kể cả
khi chỗ cũ là đất của người khác. Ai không sở hữu ô đất nào thì lượt đó không
có gì xảy ra.

Cờ lễ hội toàn quốc **gắn với ô chứ không gắn với người**. Ô đổi chủ vì bị
mua đứt hay được tặng thì cờ vẫn ở đó, chủ mới hưởng. Chỉ khi ô thành **vô
chủ** — bị thẻ Giải toả mặt bằng phá, hoặc chủ phá sản — thì cờ mới hạ.

Giá xây và giá thế chấp **không** chịu hệ số lễ hội. Lễ hội toàn quốc dời đi
dời lại suốt ván, nếu nó kéo theo cả hai khoản đó thì mỗi lần dời là một lần
xáo trộn sổ sách của mọi người.

Ba con số nằm ở `SO_LE_HOI_THUONG`, `HE_SO_LE_HOI` và `HE_SO_LE_HOI_TOAN_QUOC`
trong `rules.ts`.

## Mua đứt ô của người khác

Dừng vào ô đã có chủ thì **tiền thuê bị trừ ngay, không có nút từ chối**. Sau
khi trả xong, người chơi được chọn **mua đứt** ô đó hoặc **bỏ qua**.

Chỉ **ô đất** mới mua đứt được.

**Giá mua đứt = 2 × (giá mua ô + tổng tiền đã xây trên ô).**

Giá mua ô ở đây là giá đã nhân hệ số lễ hội, nên ô đang có lễ hội thì mua đứt
đắt hơn hẳn.

Toàn bộ số tiền đó trả thẳng cho chủ cũ, nhà băng không lấy đồng nào. Nhà cửa
trên ô đổi chủ theo, không bị phá.

Ví dụ: Hoàn Kiếm giá 400K, giá xây 100K mỗi bậc.

| Tình trạng ô | Giá mua đứt |
| --- | --- |
| Mới cắm cờ | 800K |
| 1 nhà | 1.000K |
| 2 nhà | 1.200K |
| 3 nhà | 1.400K |
| Khách sạn | **không mua đứt được** |

Ba trường hợp không mua đứt được:

- **Ô biển.** Gom đủ cả bốn ô biển là thắng ngay, nên nếu mua đứt được thì ai
  có tiền cũng giật được chiến thắng từ tay người khác — mà ô biển lại rẻ
  nhất bàn để mua đứt vì không xây nhà được. Muốn có biển thì phải tự đi tới
  ô đó và mua.
- Ô **đã lên khách sạn** — đó là phần thưởng cho người dám xây tới bậc cuối.
- Ô **đang thế chấp**.

Hệ số 2 nằm ở `HE_SO_MUA_DUT` trong `rules.ts`. Nâng lên 3 thì mua đứt hiếm
hơn hẳn và chủ đất an toàn hơn.

## Thắng ván

Ba cách, kiểm tra ngay sau mỗi lần một ô đổi chủ:

1. **Gom đủ toàn bộ 4 ô biển** — thắng ngay.
2. **Sở hữu trọn 3 nhóm đất** — thắng ngay.
3. **Là người cuối cùng chưa phá sản.**

## Đảo Hoang

Ba cách vào: dừng ở ô Đảo Hoang không phải do ghé thăm, rút thẻ "vào Đảo
Hoang", hoặc tung đôi ba lần liên tiếp.

Hai cách ra: tung được đôi, hoặc sau **3 lượt** thì buộc nộp **50K**.

Ở trong đảo vẫn thu tiền thuê và xây nhà bình thường, chỉ mất quyền di chuyển.

## Thiếu tiền và phá sản

Không đủ tiền mặt để trả một khoản bắt buộc thì ván **dừng lại chờ người
chơi**: bảng hiện danh sách ô của họ kèm số tiền thu về nếu bán, họ bấm từng ô
cho tới khi đủ. Bán theo bậc — khách sạn hạ về 3 nhà, nhà hạ một căn, hết nhà
thì thế chấp cả ô.

Ai không muốn chọn thì bấm **"Để server tự bán"**, hoặc cứ để hết 25 giây,
server bán thay theo thứ tự ô trên bàn.

Ngoài lúc bị ép, người chơi còn **bán chủ động bất cứ lúc nào tới lượt mình**:
bấm vào ô của mình trên bàn cờ rồi chọn nút bán trong thẻ thông tin.

Bán hết vẫn không đủ thì phá sản: tài sản trả hết về thị trường, người đó rời
cuộc chơi, chủ nợ nhận nốt phần tiền còn lại.

> **Chưa dừng chờ chọn ô ở hai chỗ:** thẻ "trả mỗi người" và tiền ra Đảo
> Hoang vẫn để server tự bán, vì hai khoản này chạy theo vòng lặp. Thuê, thuế
> và các thẻ nộp tiền một lần thì đều có bước chọn.

## Thẻ Cơ hội

Ô số 12, 20, 28. Mười sáu thẻ, trộn khi mở phòng, rút xong xuống đáy bộ.
Không còn bộ Khí vận.

| Nội dung | Hiệu ứng |
| --- | --- |
| Trúng thầu dự án ven biển, nhận 150K. | nhận 150K |
| Hoàn thuế cuối năm, nhận 200K. | nhận 200K |
| Khách du lịch đông bất ngờ, nhận 100K. | nhận 100K |
| Đi thẳng về ô Xuất phát và nhận lương. | đi tới ô 0 |
| Đi thẳng tới Biển Nha Trang. | đi tới ô 18 |
| Lạc đường trên đèo, lùi lại 3 ô. | lùi 3 ô |
| Vi phạm quy hoạch, vào Đảo Hoang. | vào Đảo Hoang |
| Chi phí quảng bá du lịch, nộp 80K. | nộp 80K |
| Phạt xây dựng sai phép, nộp 150K. | nộp 150K |
| Bạn thắng cuộc thi khởi nghiệp, mỗi người trả bạn 50K. | thu 50K mỗi người |
| Khao cả bàn một chầu, trả mỗi người 40K. | trả 40K mỗi người |
| Bảo trì bất động sản: 25K mỗi nhà, 100K mỗi khách sạn. | sửa nhà |
| **Giải toả mặt bằng:** chọn một ô của người khác để phá bỏ, ô đó thành vô chủ. | chọn ô |
| **Thanh tra xây dựng:** chọn một ô của người khác để hạ một bậc công trình. | chọn ô |
| **Sự cố lưới điện:** chọn một ô của người khác, ô đó mất điện 5 lượt tung. | chọn ô |
| **Làm từ thiện:** chọn một ô của bạn để tặng người chơi kế tiếp. | chọn ô |

### Bốn thẻ tương tác

Rút trúng một trong bốn thẻ này thì ván dừng lại, bảng hiện danh sách ô hợp lệ
dưới dạng nút bấm, người chơi chọn một ô (hoặc bấm thẳng vào ô trên bàn cờ).
Hết 25 giây thì server chọn thay.

| Thẻ | Nhắm vào | Không nhắm được |
| --- | --- | --- |
| Giải toả mặt bằng | ô đất của người khác | ô đã có khách sạn |
| Thanh tra xây dựng | ô đất của người khác đã có 1–3 nhà | ô khách sạn, ô chưa xây |
| Sự cố lưới điện | ô đất của người khác | ô đang mất điện sẵn |
| Làm từ thiện | ô đất của chính mình | — |

Ba điểm cần anh/chị biết vì tôi phải tự quyết:

- **Cả bốn thẻ chỉ nhắm vào ô đất, không đụng tới ô biển.** Anh/chị viết "ô
  đất" nên tôi hiểu theo nghĩa hẹp. Ô biển vì vậy hoàn toàn bất khả xâm
  phạm: không thẻ nào đánh được, cũng không mua đứt được. Ai đi tới trước
  thì giữ được, và gom đủ bốn ô là thắng.
- **Thẻ tặng ô có hai bước:** chọn ô của mình, rồi chọn tặng cho ai. Bàn chỉ
  còn một đối thủ thì bỏ qua bước hai. Hết 25 giây ở bước hai thì tặng người
  ngồi kế tiếp.
- **Mất điện đếm theo lượt tung của cả bàn**, không phải lượt riêng của chủ ô.
  5 lượt tung với bàn 2 người là khoảng 2 vòng rưỡi.

### Các kiểu hiệu ứng viết được

Khi thêm thẻ mới trong `apps/shared/src/the.ts`, chọn một trong chín kiểu:

| Kiểu | Viết | Ý nghĩa |
| --- | --- | --- |
| `nhan` | `{ loai: "nhan", so: 150 }` | Nhà băng trả cho người rút |
| `nop` | `{ loai: "nop", so: 80 }` | Người rút trả cho nhà băng |
| `thuMoiNguoi` | `{ loai: "thuMoiNguoi", so: 50 }` | Mỗi người khác trả cho người rút |
| `traMoiNguoi` | `{ loai: "traMoiNguoi", so: 40 }` | Người rút trả cho từng người khác |
| `diToi` | `{ loai: "diToi", o: 18 }` | Đi tới ô số 18, nhận lương nếu qua Xuất phát |
| `vaoDao` | `{ loai: "vaoDao" }` | Vào Đảo Hoang, không nhận lương |
| `luiLai` | `{ loai: "luiLai", so: 3 }` | Lùi lại 3 ô |
| `suaNha` | `{ loai: "suaNha", moiNha: 25, moiKhachSan: 100 }` | Nộp tiền theo số nhà đang có |
| `chon` | `{ loai: "chon", kieu: "phaBo" }` | Bắt chọn một ô; `kieu` là `phaBo`, `haBac`, `matDien` hoặc `tangO` |

Muốn thêm kiểu hiệu ứng hoàn toàn mới thì cần sửa cả `the.ts` và hàm
`apDungThe` trong `apps/backend/src/rooms/CoTyPhuRoom.ts` — nhắn tôi.

## Cả bàn cùng thấy gì

Bảng hành động ở đáy màn hình chỉ hiện cho người đang tới lượt — đó là chỗ
bấm nút. Những gì cả bàn cần biết thì phát thành **tấm thẻ giữa màn hình**,
mọi người chơi thấy giống hệt nhau cùng lúc:

- Thẻ Cơ hội vừa rút, kèm tên người rút.
- Kết quả bốn thẻ tương tác: ai phá ô của ai, ai cắt điện ô nào, ai tặng gì
  cho ai.
- Ô vừa bị mua đứt và giá bao nhiêu.
- Lễ hội thường đầu ván mở ở đâu, và mỗi lần lễ hội toàn quốc đổi chỗ.

Ô xúc xắc dưới đáy cũng ghi tên người vừa tung chứ không chỉ ghi số điểm.
Nhật ký bên phải giữ lại 14 dòng gần nhất cho ai muốn xem lại.

## Những luật chưa làm

Liệt kê để anh/chị biết game đang thiếu gì so với cờ tỷ phú đầy đủ:

- **Đấu giá** khi người dừng chân từ chối mua ô chưa có chủ. Giờ đã có mua đứt
  nên đất không còn bị đóng băng như trước, nhưng đấu giá vẫn làm ván nhanh hơn.
- **Giao dịch tự do giữa người chơi**: đổi đất, thoả thuận giá. Mua đứt là
  giao dịch một chiều, không cần chủ cũ đồng ý.
- **Giải chấp**: thế chấp rồi thì chưa có nút chuộc lại, nên ô đó cũng không
  xây tiếp được cho tới hết ván.
- **Thẻ "Thoát khỏi Đảo Hoang"** giữ lại dùng sau.
- **Thẻ `diToi` không kích hoạt ô đích**: "Đi thẳng tới Biển Nha Trang" chỉ
  dời quân, không cho mua và không bắt trả thuê ở ô đó.
