import {
  BAC_KHACH_SAN, BAN_CO, DON_VI, MAU_NGUOI_CHOI, NHOM, SO_BIEN, SO_NHOM_THANG,
  THU_TU_NHOM,
  HE_SO_LE_HOI, HE_SO_LE_HOI_TOAN_QUOC,
  bangThue, bangThueBien, coTheBan, dinhDang, giaMua, giaMuaDut, giaMuaThucTe,
  giaTheChap, giaXay, heSoLeHoi, mauCuaO, oMuaDutDuoc, tenLeHoi, tenLoaiO,
} from "@co-ty-phu/shared";
import type { AnhChup } from "./state.js";

export type ManHinh = "dangnhap" | "sanh" | "phong";

export interface HudCallbacks {
  onDangNhapGoogle(): void;
  onDangNhapKhach(ten: string): void;
  onDangXuat(): void;
  onTaoPhong(ten: string, matKhau: string): void;
  onVaoPhong(roomId: string, matKhau: string): void;
  onRoiPhong(): void;
  onSanSang(): void;
  onTung(): void;
  onHanhDong(hd: string): void;
  onXay(o?: number): void;
  /** Bán bớt một bậc công trình ở ô, hoặc thế chấp ô nếu đã hết nhà. */
  onBan(o: number): void;
  /** Chọn một ô cho việc đang chờ. */
  onChon(o: number): void;
  /** Bước hai của thẻ tặng ô: chọn người nhận. */
  onChonNguoi(sid: string): void;
  onDoiMau(): void;
  onChoiLai(): void;
  onPhongTo(): void;
  onThuNho(): void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hud {
  private sid = "";
  private anh: AnhChup | null = null;
  private tienCu = new Map<string, number>();
  private oDangXem = -1;
  private boDemTimer?: number;
  private khoaQuyet = "";
  private phongDangHoi = "";
  private nguoiDung: { id: string; ten: string; anh?: string } | null = null;

  constructor(private cb: HudCallbacks) {
    this.ganSuKien();
    this.dungBangGia();
  }

  datSid(sid: string) { this.sid = sid; }

  /* ------------------------------------------------- đăng nhập và sảnh */

  /** Hiện đúng một trong ba màn: đăng nhập, sảnh phòng, hoặc bàn chơi. */
  datManHinh(man: ManHinh) {
    $("manDangNhap").hidden = man !== "dangnhap";
    $("manSanh").hidden = man !== "sanh";
    if (man !== "phong") {
      $("manCho").hidden = true;
      $("manMatKhau").hidden = true;
    }
    ($("btnGoogle") as HTMLButtonElement).disabled = false;
    ($("btnTaoPhong") as HTMLButtonElement).disabled = false;
  }

  /** Bật nút Google và lối vào thử theo những gì server cho phép. */
  datCauHinh(c: { google: boolean; khach: boolean }) {
    ($("btnGoogle") as HTMLButtonElement).disabled = !c.google;
    $("formKhach").hidden = !c.khach;
    const ghi = $("ghiChuDangNhap");
    ghi.hidden = c.google;
    if (!c.google) {
      ghi.textContent = c.khach
        ? "Máy chủ chưa cấu hình OAUTH_CLIENT_ID và OAUTH_CLIENT_SECRET nên nút Google đang tắt. Dùng lối vào thử bên dưới trong lúc chờ."
        : "Máy chủ chưa cấu hình đăng nhập Google. Liên hệ người quản trị.";
    }
  }

  datNguoiDung(nd: { id: string; ten: string; anh?: string } | null) {
    this.nguoiDung = nd;
    const el = $("hoSo");
    if (!nd) { el.innerHTML = ""; return; }
    const av = nd.anh
      ? `<img src="${this.thoat(nd.anh)}" alt="" referrerpolicy="no-referrer" />`
      : `<span class="av">${this.thoat(nd.ten.charAt(0).toUpperCase())}</span>`;
    el.innerHTML = `${av}<span>${this.thoat(nd.ten)}</span>`;
  }

  veDanhSachPhong(ds: {
    roomId: string; ten: string; coMatKhau: boolean;
    soNguoi: number; toiDa: number; trangThai: string; chu: string;
  }[]) {
    const wrap = $("danhSachPhong");
    $("sanhSub").textContent = ds.length
      ? `Đang có ${ds.length} phòng. Vào một phòng hoặc tạo phòng mới.`
      : "Chưa có phòng nào. Tạo một phòng để bắt đầu.";

    wrap.innerHTML = ds.map((p) => {
      const dangChoi = p.trangThai !== "cho";
      const day = p.soNguoi >= p.toiDa;
      const chan = dangChoi || day;
      const lyDo = dangChoi ? "Đang chơi" : day ? "Đã đầy" : "Vào";
      return `<div class="room">
        <div class="info">
          <div class="nm">${p.coMatKhau ? '<span class="khoa" title="Có mật khẩu">🔒</span>' : ""}<span>${this.thoat(p.ten)}</span></div>
          <div class="meta">${p.chu ? `Chủ phòng: ${this.thoat(p.chu)}` : "Phòng trống"}${dangChoi ? " · đang chơi" : ""}</div>
        </div>
        <div class="cnt">${p.soNguoi}/${p.toiDa}</div>
        <button type="button" data-room="${p.roomId}" data-khoa="${p.coMatKhau ? 1 : 0}"
          data-ten="${this.thoat(p.ten)}" ${chan ? "disabled" : ""}>${lyDo}</button>
      </div>`;
    }).join("");

    Array.prototype.forEach.call(wrap.querySelectorAll("button[data-room]"), (b: HTMLButtonElement) => {
      b.addEventListener("click", () => {
        const id = b.dataset.room!;
        if (b.dataset.khoa === "1") {
          this.phongDangHoi = id;
          $("mkSub").textContent = `Phòng "${b.dataset.ten}" cần mật khẩu để vào.`;
          ($("inpMatKhauVao") as HTMLInputElement).value = "";
          $("manMatKhau").hidden = false;
          ($("inpMatKhauVao") as HTMLInputElement).focus();
        } else {
          this.cb.onVaoPhong(id, "");
        }
      });
    });
  }

  /** Mở lại nút tạo phòng sau khi một lần thử thất bại. */
  moKhoaSanh() {
    ($("btnTaoPhong") as HTMLButtonElement).disabled = false;
    ($("btnGoogle") as HTMLButtonElement).disabled = false;
  }

  /** Bật tắt nút phóng to và lời nhắc kéo, theo mức zoom hiện tại. */
  capNhatZoom(z: number) {
    ($("btnZoomOut") as HTMLButtonElement).disabled = z <= 1.001;
    ($("btnZoomIn") as HTMLButtonElement).disabled = z >= 2.999;
    $("zoomhint").hidden = z <= 1.001;
  }

  // ------------------------------------------------------------ sự kiện

  private ganSuKien() {
    $("btnGoogle").addEventListener("click", () => {
      ($("btnGoogle") as HTMLButtonElement).disabled = true;
      this.cb.onDangNhapGoogle();
    });
    $("formKhach").addEventListener("submit", (e) => {
      e.preventDefault();
      const ten = ($("inpTenKhach") as HTMLInputElement).value.trim();
      this.cb.onDangNhapKhach(ten || "Khách");
    });
    $("btnDangXuat").addEventListener("click", () => this.cb.onDangXuat());
    $("btnRoiPhong").addEventListener("click", () => this.cb.onRoiPhong());

    $("formTaoPhong").addEventListener("submit", (e) => {
      e.preventDefault();
      const ten = ($("inpTenPhong") as HTMLInputElement).value.trim();
      const mk = ($("inpMatKhauPhong") as HTMLInputElement).value;
      ($("btnTaoPhong") as HTMLButtonElement).disabled = true;
      this.cb.onTaoPhong(ten, mk);
    });

    $("formMatKhau").addEventListener("submit", (e) => {
      e.preventDefault();
      const mk = ($("inpMatKhauVao") as HTMLInputElement).value;
      $("manMatKhau").hidden = true;
      if (this.phongDangHoi) this.cb.onVaoPhong(this.phongDangHoi, mk);
    });
    $("btnHuyMatKhau").addEventListener("click", () => {
      $("manMatKhau").hidden = true;
      this.phongDangHoi = "";
    });

    $("btnSanSang").addEventListener("click", () => this.cb.onSanSang());
    $("btnZoomIn").addEventListener("click", () => this.cb.onPhongTo());
    $("btnZoomOut").addEventListener("click", () => this.cb.onThuNho());
    $("btnRoll").addEventListener("click", () => this.cb.onTung());
    $("btnTheme").addEventListener("click", () => this.cb.onDoiMau());
    $("btnLegend").addEventListener("click", () => {
      const el = $("legend");
      el.hidden = !el.hidden;
      $("btnLegend").setAttribute("aria-pressed", String(!el.hidden));
      window.dispatchEvent(new Event("hud:layout"));
    });
    $("btnLog").addEventListener("click", () => {
      const el = $("log");
      el.hidden = !el.hidden;
      $("btnLog").setAttribute("aria-pressed", String(!el.hidden));
    });
    $("tcClose").addEventListener("click", () => this.dongTheO());
    $("btnChoiLai").addEventListener("click", () => this.cb.onChoiLai());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.dongTheO();
    });
  }

  // ------------------------------------------------------------ bảng giá

  private dungBangGia() {
    $("legendGroups").innerHTML = THU_TU_NHOM.map((key) => {
      const g = NHOM[key];
      const os = BAN_CO.filter((o) => o.nhom === key);
      return `<div class="grp"><span class="sw" style="background:${g.mau}"></span>
        <span class="gi"><span class="gn">${g.ten}</span>
        <span class="gc">${os.map((o) => o.ten).join(" · ")}</span>
        <span class="gp">${os.map((o) => `${o.gia}K`).join(" / ")}</span></span></div>`;
    }).join("");
    $("legendPorts").innerHTML = BAN_CO.filter((o) => o.loai === "bien").map((o) =>
      `<div class="grp"><span class="sw" style="background:#00a2b5"></span>
       <span class="gi"><span class="gn">${o.ten}</span>
       <span class="gc">${o.phu ?? ""}</span><span class="gp">${o.gia}K</span></span></div>`,
    ).join("")
      + `<div class="grp"><span class="sw" style="background:#00a2b5"></span>
         <span class="gi"><span class="gn">Gom đủ ${SO_BIEN} ô biển</span>
         <span class="gc">Thắng ngay lập tức</span></span></div>`;
  }

  // ------------------------------------------------------------- hiển thị

  ve(anh: AnhChup) {
    const dau = this.anh === null;
    this.anh = anh;

    this.veCho(anh);
    this.veNguoiChoi(anh, dau);
    this.vePanel(anh);
    this.veNhatKy(anh);
    this.veKetThuc(anh);

    const toi = anh.nguoiChoi.find((p) => p.sid === this.sid);
    const denLuot = anh.luotCua === this.sid;
    const btn = $("btnRoll") as HTMLButtonElement;
    btn.disabled = !(denLuot && anh.giaiDoan === "tung" && !!toi && !toi.phaSan);
    btn.textContent = toi?.oDao && denLuot ? "TUNG ĐỂ RA ĐẢO" : "TUNG XÚC XẮC";

    $("diceOut").textContent =
      anh.xx1 > 0
        ? `${anh.xx1} + ${anh.xx2} = ${anh.xx1 + anh.xx2}${anh.xx1 === anh.xx2 ? " (đôi)" : ""}`
        : anh.thongBao || "Bấm vào một ô để xem giá";
  }

  /** Phòng chờ bên trong một phòng cụ thể, trước khi ván bắt đầu. */
  private veCho(anh: AnhChup) {
    const man = $("manCho");
    if (anh.giaiDoan !== "cho" || !this.sid) { man.hidden = true; return; }
    man.hidden = false;

    $("choTen").textContent = anh.tenPhong || "Phòng chờ";
    $("seats").innerHTML = anh.nguoiChoi.map((p) => `
      <div class="seat">
        <span class="dot" style="background:${MAU_NGUOI_CHOI[p.mau % 4]}"></span>
        <span>${this.thoat(p.ten)}${p.sid === this.sid ? " (bạn)" : ""}${p.sid === anh.chuPhong ? " · chủ phòng" : ""}</span>
        <span class="st ${p.sanSang ? "ok" : ""}">${p.sanSang ? "Sẵn sàng" : "Đang chờ"}</span>
      </div>`).join("");

    const toi = anh.nguoiChoi.find((p) => p.sid === this.sid);
    $("btnSanSang").textContent = toi?.sanSang ? "Huỷ sẵn sàng" : "Sẵn sàng";
    $("choSub").textContent = anh.nguoiChoi.length < 2
      ? `Cần ít nhất 2 người, đang có ${anh.nguoiChoi.length}. Rủ thêm người vào phòng này.`
      : "Tất cả bấm Sẵn sàng là ván bắt đầu.";
  }

  private veNguoiChoi(anh: AnhChup, dau: boolean) {
    const wrap = $("players");
    if (wrap.childElementCount !== anh.nguoiChoi.length) wrap.innerHTML = "";

    anh.nguoiChoi.forEach((p, idx) => {
      let el = wrap.children[idx] as HTMLElement | undefined;
      if (!el) {
        el = document.createElement("div");
        el.innerHTML = `<div class="pip"></div><div class="meta">
          <span class="nm"></span><span class="cash"></span><span class="tag"></span></div>`;
        wrap.appendChild(el);
      }
      el.className = `player p${idx}${anh.luotCua === p.sid ? " luot" : ""}${p.phaSan ? " phasan" : ""}`;
      const pip = el.querySelector(".pip") as HTMLElement;
      pip.style.background = MAU_NGUOI_CHOI[p.mau % 4];
      pip.textContent = p.ten.charAt(0).toUpperCase();
      (el.querySelector(".nm") as HTMLElement).textContent = p.ten + (p.sid === this.sid ? " (bạn)" : "");
      (el.querySelector(".cash") as HTMLElement).textContent = dinhDang(p.tien);

      const tag = el.querySelector(".tag") as HTMLElement;
      tag.className = "tag";
      if (p.phaSan) { tag.textContent = "Phá sản"; tag.classList.add("off"); }
      else if (!p.ketNoi) { tag.textContent = "Mất kết nối"; tag.classList.add("off"); }
      else if (p.oDao) { tag.textContent = "Đảo Hoang"; tag.classList.add("off"); }
      else if (anh.luotCua === p.sid) tag.textContent = "Đang đi";
      else tag.textContent = "";

      const cu = this.tienCu.get(p.sid);
      if (!dau && cu !== undefined && cu !== p.tien) this.bayTien(el, p.tien - cu);
      this.tienCu.set(p.sid, p.tien);
    });
  }

  private bayTien(el: HTMLElement, delta: number) {
    const r = el.getBoundingClientRect();
    const s = $("stage").getBoundingClientRect();
    const d = document.createElement("div");
    d.className = `delta ${delta < 0 ? "tru" : "cong"}`;
    d.textContent = `${delta < 0 ? "−" : "+"}${dinhDang(Math.abs(delta))}`;
    d.style.left = `${r.left - s.left + r.width / 2}px`;
    d.style.top = `${r.top - s.top + r.height + 2}px`;
    $("deltas").appendChild(d);
    setTimeout(() => d.remove(), 1400);
  }

  private vePanel(anh: AnhChup) {
    const ap = $("actpanel");
    const cuaToi = anh.luotCua === this.sid;
    // Ba giai đoạn đều chờ người chơi bấm: quyết ở ô vừa dừng, gom tiền để
    // trả, và chọn ô cho thẻ cơ hội.
    const dangCho =
      anh.giaiDoan === "quyet" || anh.giaiDoan === "gom" || anh.giaiDoan === "chon";
    if (!dangCho || !cuaToi || anh.hanhDong.length === 0) {
      ap.classList.remove("show");
      window.setTimeout(() => { if (!ap.classList.contains("show")) ap.hidden = true; }, 220);
      if (this.boDemTimer) { clearInterval(this.boDemTimer); this.boDemTimer = undefined; }
      return;
    }

    const gom = anh.giaiDoan === "gom";
    const chon = anh.giaiDoan === "chon";
    const i = anh.oChoQuyet;
    const o = BAN_CO[i];
    const tt = anh.o[i];

    const tieuDe = gom ? "THIẾU TIỀN MẶT" : chon ? "THẺ CƠ HỘI" : null;
    $("apBand").style.background = gom ? "#d9534f" : chon ? "#ff8a3d" : o ? mauCuaO(o) : "#888";
    $("apGroup").textContent = tieuDe
      ?? (o?.loai === "dat" ? NHOM[o.nhom!].ten.toUpperCase() : o ? tenLoaiO(o) : "");
    $("apName").textContent = gom
      ? "Bán bớt tài sản"
      : chon
        ? this.tenKieuChon(anh.kieuChon)
        : o?.ten ?? "";
    $("apMsg").className = "msg";
    $("apMsg").textContent = anh.thongBao;

    // Bảng thuê theo bậc, chỉ có nghĩa với ô đất.
    const rent = $("apRent");
    if (!gom && !chon && o?.loai === "dat") {
      const b = bangThue(o.gia!);
      const he = tt ? heSoLeHoi(tt) : 1;
      rent.hidden = false;
      rent.innerHTML = [
        ["Mua đất", b[0]], ["Trọn bộ", b[0] * 2], ["3 nhà", b[3]], ["Khách sạn", b[4]],
      ].map(([t, v]) => `<div><em>${t}</em><b>${(v as number) * he}K</b></div>`).join("");
    } else {
      rent.hidden = true;
    }

    // Con số lớn bên cạnh: giá mua, giá mua đứt, tiền thuê, giá xây, hay số
    // tiền còn thiếu.
    const price = $("apPrice");
    if (gom) {
      price.innerHTML = `<b>${dinhDang(anh.tienCanGom)}</b><span>Cần gom</span>`;
    } else if (anh.hanhDong.includes("mua") && o && tt) {
      const he = heSoLeHoi(tt);
      price.innerHTML = he > 1
        ? `<b>${dinhDang(giaMuaThucTe(o, tt))}</b><span>Giá mua ×${he} vì lễ hội</span>`
        : `<b>${o.gia}K</b><span>Giá mua</span>`;
    } else if (anh.hanhDong.includes("muadut") && o && tt) {
      price.innerHTML = `<b>${dinhDang(giaMuaDut(o, tt))}</b><span>Giá mua đứt</span>`;
    } else if (anh.tienPhaiTra > 0) {
      price.innerHTML = `<b>${dinhDang(anh.tienPhaiTra)}</b><span>Đã trả thuê</span>`;
    } else if (anh.hanhDong.includes("xay") && o) {
      price.innerHTML = `<b>${Math.round(giaXay(o) / DON_VI)}K</b><span>Giá xây</span>`;
    } else {
      price.innerHTML = "";
    }

    const btns = $("apBtns");
    btns.innerHTML = "";
    const them = (nhan: string, loai: "pri" | "gh", chay: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `btn ${loai}`;
      b.textContent = nhan;
      b.addEventListener("click", chay);
      btns.appendChild(b);
    };

    if (chon && anh.kieuChon === "tangNguoi") {
      // Bước hai của thẻ tặng ô: mỗi đối thủ một nút.
      for (const sid of anh.nguoiChonDuoc) {
        const ng = anh.nguoiChoi.find((x) => x.sid === sid);
        if (!ng) continue;
        them(ng.ten, "pri", () => this.cb.onChonNguoi(sid));
      }
    } else if (chon) {
      // Mỗi ô hợp lệ thành một nút, không cần người chơi mò trên bàn cờ.
      for (const k of anh.oChonDuoc) {
        const ox = BAN_CO[k];
        if (!ox) continue;
        const tx = anh.o[k];
        const bac = tx?.nha ?? 0;
        const mo = bac >= BAC_KHACH_SAN ? " · khách sạn" : bac > 0 ? ` · ${bac} nhà` : "";
        const co = tx ? tenLeHoi(tx) : "";
        them(`${ox.ten}${mo}${co ? " · 🎏" : ""}`, "pri", () => this.cb.onChon(k));
      }
    } else if (gom) {
      // Danh sách ô bán được của chính mình, kèm số tiền thu về mỗi lần bấm.
      const docO = (k: number) => anh.o[k];
      for (const ox of BAN_CO) {
        const kq = coTheBan(docO, ox.i, this.sid, anh.nhaConLai);
        if (!kq.ok || kq.thuVe === undefined) continue;
        const viec = kq.viec === "khachsan" ? "bán khách sạn"
          : kq.viec === "nha" ? "bán 1 nhà" : "thế chấp";
        them(`${ox.ten}: ${viec} +${dinhDang(kq.thuVe)}`, "gh", () => this.cb.onBan(ox.i));
      }
      them("Để server tự bán", "pri", () => this.cb.onHanhDong("tudong"));
    } else {
      if (anh.hanhDong.includes("mua") && o && tt) {
        them(`MUA ${dinhDang(giaMuaThucTe(o, tt))}`, "pri", () => this.cb.onHanhDong("mua"));
      }
      if (anh.hanhDong.includes("muadut") && o && tt) {
        them(`MUA ĐỨT ${dinhDang(giaMuaDut(o, tt))}`, "pri", () => this.cb.onHanhDong("muadut"));
      }
      if (anh.hanhDong.includes("xay")) them("XÂY NHÀ", "pri", () => this.cb.onXay(i));
      if (anh.hanhDong.includes("boqua")) them("Bỏ qua", "gh", () => this.cb.onHanhDong("boqua"));
      if (anh.hanhDong.includes("tieptuc")) {
        them("Tiếp tục", anh.hanhDong.length === 1 ? "pri" : "gh", () => this.cb.onHanhDong("tieptuc"));
      }
    }

    ap.hidden = false;
    requestAnimationFrame(() => ap.classList.add("show"));
    this.chayDongHo(`${anh.giaiDoan}|${anh.luotCua}|${anh.oChoQuyet}|${anh.hanLuot}`);
  }

  private tenKieuChon(kieu: string): string {
    switch (kieu) {
      case "phaBo":         return "Chọn ô để phá bỏ";
      case "haBac":         return "Chọn ô để hạ một bậc";
      case "matDien":       return "Chọn ô để cắt điện";
      case "tangO":         return "Chọn ô của bạn để tặng";
      case "tangNguoi":     return "Tặng cho ai?";
      case "leHoiToanQuoc": return "Chọn ô đăng cai lễ hội";
      default:              return "Chọn một ô";
    }
  }

  /**
   * Thanh đếm ngược 25 giây, khớp với GIAY_QUYET bên server.
   *
   * Đồng hồ của phòng và của trình duyệt không chung mốc, nên ở đây chỉ đếm
   * ngược cục bộ và khởi động lại mỗi khi server mở một quyết định mới.
   */
  private chayDongHo(khoa: string) {
    if (khoa === this.khoaQuyet) return;
    this.khoaQuyet = khoa;
    if (this.boDemTimer) clearInterval(this.boDemTimer);

    const bar = $("apTimer").firstElementChild as HTMLElement;
    const batDau = performance.now();
    const TONG = 25_000;
    const chay = () => {
      const ti = Math.max(0, 1 - (performance.now() - batDau) / TONG);
      bar.style.transform = `scaleX(${ti})`;
      if (ti <= 0 && this.boDemTimer) { clearInterval(this.boDemTimer); this.boDemTimer = undefined; }
    };
    chay();
    this.boDemTimer = window.setInterval(chay, 100);
  }

  private veNhatKy(anh: AnhChup) {
    $("log").innerHTML = anh.nhatKy.map((d) =>
      `<div class="d ${d.loai}">${this.thoat(d.noiDung)}</div>`).join("");
  }

  private veKetThuc(anh: AnhChup) {
    const el = $("ketthuc");
    if (anh.giaiDoan !== "ketthuc") { el.hidden = true; return; }
    const thang = anh.nguoiChoi.find((p) => p.sid === anh.nguoiThang);
    $("ktTitle").textContent = thang
      ? (thang.sid === this.sid ? "Bạn thắng!" : `${thang.ten} thắng!`)
      : "Ván kết thúc";
    const vi =
      anh.lyDoThang === "bien" ? `gom đủ toàn bộ ${SO_BIEN} ô biển`
      : anh.lyDoThang === "nhom" ? `sở hữu trọn ${SO_NHOM_THANG} nhóm đất`
      : "là người cuối cùng còn trụ lại";
    $("ktSub").textContent = thang
      ? `${thang.ten} ${vi}, kết ván với ${dinhDang(thang.tien)}.`
      : "Không còn ai trụ lại.";
    el.hidden = false;
  }

  // ------------------------------------------------------- thẻ thông tin ô

  moTheO(i: number) {
    const anh = this.anh;
    const o = BAN_CO[i];
    if (!o) return;
    this.oDangXem = i;
    const tt = anh?.o[i];

    $("tcBand").style.background = mauCuaO(o);
    $("tcBand").textContent = tenLoaiO(o);
    $("tcTitle").textContent = o.ten;
    $("tcSub").textContent = o.loai === "dat"
      ? `${NHOM[o.nhom!].ten} · ${NHOM[o.nhom!].vung}`
      : (o.phu ?? "");

    const rows: [string, string][] = [];
    const he = tt ? heSoLeHoi(tt) : 1;
    const co = tt ? tenLeHoi(tt) : "";
    if (co) rows.push(["Đang có", `${co} — mọi giá ×${he}`]);

    if (o.loai === "dat") {
      const b = bangThue(o.gia!).map((v) => v * he);
      rows.push(["Giá mua", tt ? dinhDang(giaMuaThucTe(o, tt)) : `${o.gia}K`]);
      rows.push(["Thuê (mới cắm cờ)", `${b[0]}K`]);
      rows.push(["Trọn nhóm, chưa xây", `${b[0] * 2}K`]);
      (["1 nhà", "2 nhà", "3 nhà"] as const).forEach((t, k) => rows.push([t, `${b[k + 1]}K`]));
      rows.push(["Khách sạn", `${b[BAC_KHACH_SAN]}K`]);
      rows.push(["Giá xây mỗi bậc", `${Math.round(giaXay(o) / DON_VI)}K`]);
      rows.push(["Thế chấp", `${Math.round(giaTheChap(o) / DON_VI)}K`]);
    } else if (o.loai === "bien") {
      rows.push(["Giá mua", tt ? dinhDang(giaMuaThucTe(o, tt)) : `${o.gia}K`]);
      bangThueBien().forEach((v, k) => rows.push([`Sở hữu ${k + 1} ô biển`, `${v * he}K`]));
      rows.push([`Sở hữu cả ${SO_BIEN} ô biển`, "Thắng ngay"]);
      rows.push(["Mua đứt", "Không được, phải tự đi tới mà mua"]);
    } else if (o.loai === "goc" && o.icon === "lehoi") {
      rows.push(["Dừng ở đây", "Chọn một ô đất của bạn để đăng cai"]);
      rows.push(["Lễ hội toàn quốc", `Mọi giá ×${HE_SO_LE_HOI_TOAN_QUOC}`]);
      rows.push(["Lễ hội thường", `Mọi giá ×${HE_SO_LE_HOI}`]);
      rows.push(["Một ô mang cả hai", `Mọi giá ×${HE_SO_LE_HOI * HE_SO_LE_HOI_TOAN_QUOC}`]);
    } else if (o.loai === "thue") {
      rows.push(["Phải nộp", `10% tài sản, tối đa ${o.thue}K`]);
    } else {
      rows.push(["Loại ô", tenLoaiO(o)]);
    }

    if (tt?.chu) {
      const chu = anh?.nguoiChoi.find((p) => p.sid === tt.chu);
      rows.push(["Chủ sở hữu", chu ? chu.ten : "?"]);
      rows.push([
        "Bậc công trình",
        tt.nha >= BAC_KHACH_SAN ? "Khách sạn" : tt.nha > 0 ? `${tt.nha} nhà` : "Mới cắm cờ",
      ]);
      if (tt.chu !== this.sid) {
        const duoc = oMuaDutDuoc(o, tt);
        rows.push(["Giá mua đứt", duoc.ok ? dinhDang(giaMuaDut(o, tt)) : duoc.lyDo!]);
      }
      if (tt.theChap) rows.push(["Tình trạng", "Đang thế chấp"]);
      if (tt.matDien > 0) rows.push(["Tình trạng", `Mất điện ${tt.matDien} lượt nữa`]);
    } else if (o.loai === "dat" || o.loai === "bien") {
      rows.push(["Chủ sở hữu", "Chưa ai mua"]);
    }

    $("tcTable").innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("");

    // Nút nhanh khi đó là ô của mình: xây thêm bậc, hoặc bán bớt để xoay tiền.
    const nutXay = $("tcXay") as HTMLButtonElement;
    const cuaToi = tt?.chu === this.sid;
    nutXay.hidden = !(cuaToi && o.loai === "dat");
    if (cuaToi && o.loai === "dat") {
      nutXay.textContent = `Xây thêm một bậc (${Math.round(giaXay(o) / DON_VI)}K)`;
      nutXay.onclick = () => { this.cb.onXay(i); this.dongTheO(); };
    }

    const nutBan = $("tcBan") as HTMLButtonElement;
    const kqBan = cuaToi && anh
      ? coTheBan((k: number) => anh.o[k], i, this.sid, anh.nhaConLai)
      : undefined;
    nutBan.hidden = !kqBan?.ok;
    if (kqBan?.ok && kqBan.thuVe !== undefined) {
      const viec = kqBan.viec === "khachsan" ? "Bán khách sạn"
        : kqBan.viec === "nha" ? "Bán một nhà" : "Thế chấp ô này";
      nutBan.textContent = `${viec} (+${dinhDang(kqBan.thuVe)})`;
      nutBan.onclick = () => { this.cb.onBan(i); this.dongTheO(); };
    }

    const el = $("tilecard");
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("show"));
  }

  private dongTheO() {
    this.oDangXem = -1;
    const el = $("tilecard");
    el.classList.remove("show");
    setTimeout(() => { if (!el.classList.contains("show")) el.hidden = true; }, 200);
  }

  // ------------------------------------------------------------------ phụ

  bao(thongBao: string) {
    const el = $("toast");
    el.textContent = thongBao;
    el.hidden = false;
    window.setTimeout(() => { el.hidden = true; }, 2600);
  }

  /** Rời phòng hoặc mất kết nối: quay về sảnh, giữ nguyên trạng thái đăng nhập. */
  veSanh() {
    this.sid = "";
    this.anh = null;
    this.tienCu.clear();
    $("manCho").hidden = true;
    $("actpanel").hidden = true;
    $("players").innerHTML = "";
    this.datManHinh(this.nguoiDung ? "sanh" : "dangnhap");
  }

  get oDangChon() { return this.oDangXem; }

  private thoat(s: string): string {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
}

export { giaMua };
