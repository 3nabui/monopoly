import {
  BAN_CO, DON_VI, MAU_NGUOI_CHOI, NHOM, THU_TU_NHOM,
  bangThue, dinhDang, giaMua, giaTheChap, giaXay, mauCuaO, tenLoaiO,
} from "@co-ty-phu/shared";
import type { AnhChup } from "./state.js";

export interface HudCallbacks {
  onVaoPhong(ten: string): void;
  onSanSang(): void;
  onTung(): void;
  onHanhDong(hd: string): void;
  onXay(o?: number): void;
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

  constructor(private cb: HudCallbacks) {
    this.ganSuKien();
    this.dungBangGia();
  }

  datSid(sid: string) { this.sid = sid; }

  /** Bật tắt nút phóng to và lời nhắc kéo, theo mức zoom hiện tại. */
  capNhatZoom(z: number) {
    ($("btnZoomOut") as HTMLButtonElement).disabled = z <= 1.001;
    ($("btnZoomIn") as HTMLButtonElement).disabled = z >= 2.999;
    $("zoomhint").hidden = z <= 1.001;
  }

  // ------------------------------------------------------------ sự kiện

  private ganSuKien() {
    $("formVao").addEventListener("submit", (e) => {
      e.preventDefault();
      const ten = ($("inpTen") as HTMLInputElement).value.trim();
      ($("btnVao") as HTMLButtonElement).disabled = true;
      this.cb.onVaoPhong(ten || "Người chơi");
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
    ).join("");
  }

  // ------------------------------------------------------------- hiển thị

  ve(anh: AnhChup) {
    const dau = this.anh === null;
    this.anh = anh;

    this.veSanh(anh);
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

  private veSanh(anh: AnhChup) {
    const sanh = $("sanh");
    if (anh.giaiDoan !== "cho") { sanh.hidden = true; return; }
    if (!this.sid) return;        // chưa vào phòng thì giữ màn nhập tên
    sanh.hidden = false;
    $("vaoPhong").hidden = true;
    $("choPhong").hidden = false;

    $("seats").innerHTML = anh.nguoiChoi.map((p) => `
      <div class="seat">
        <span class="dot" style="background:${MAU_NGUOI_CHOI[p.mau % 4]}"></span>
        <span>${this.thoat(p.ten)}${p.sid === this.sid ? " (bạn)" : ""}</span>
        <span class="st ${p.sanSang ? "ok" : ""}">${p.sanSang ? "Sẵn sàng" : "Đang chờ"}</span>
      </div>`).join("");

    const toi = anh.nguoiChoi.find((p) => p.sid === this.sid);
    $("btnSanSang").textContent = toi?.sanSang ? "Huỷ sẵn sàng" : "Sẵn sàng";
    $("choSub").textContent = anh.nguoiChoi.length < 2
      ? "Cần ít nhất 2 người. Mở thêm một tab nữa để thử."
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
    if (anh.giaiDoan !== "quyet" || !cuaToi || anh.hanhDong.length === 0) {
      ap.classList.remove("show");
      window.setTimeout(() => { if (!ap.classList.contains("show")) ap.hidden = true; }, 220);
      if (this.boDemTimer) { clearInterval(this.boDemTimer); this.boDemTimer = undefined; }
      return;
    }

    const i = anh.oChoQuyet;
    const o = BAN_CO[i];
    $("apBand").style.background = o ? mauCuaO(o) : "#888";
    $("apGroup").textContent = o?.loai === "dat" ? NHOM[o.nhom!].ten.toUpperCase() : o ? tenLoaiO(o) : "";
    $("apName").textContent = o?.ten ?? "";
    $("apMsg").className = "msg";
    $("apMsg").textContent = anh.thongBao;

    // bảng thuê bốn mức
    const rent = $("apRent");
    if (o?.loai === "dat") {
      const b = bangThue(o.gia!);
      rent.hidden = false;
      rent.innerHTML = [["Đất trống", b[0]], ["Trọn bộ", b[0] * 2], ["3 nhà", b[3]], ["Khách sạn", b[5]]]
        .map(([t, v]) => `<div><em>${t}</em><b>${v}K</b></div>`).join("");
    } else {
      rent.hidden = true;
    }

    // giá hoặc tiền phải trả
    const price = $("apPrice");
    if (anh.hanhDong.includes("mua") && o) {
      price.innerHTML = `<b>${o.gia}K</b><span>Giá mua</span>`;
    } else if (anh.tienPhaiTra > 0) {
      price.innerHTML = `<b>${dinhDang(anh.tienPhaiTra)}</b><span>Tiền thuê</span>`;
    } else if (anh.hanhDong.includes("xay") && o) {
      price.innerHTML = `<b>${Math.round(giaXay(o) / DON_VI)}K</b><span>Giá xây</span>`;
    } else {
      price.innerHTML = "";
    }

    const btns = $("apBtns");
    btns.innerHTML = "";
    const them = (nhan: string, loai: "pri" | "gh", hd: string) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `btn ${loai}`;
      b.textContent = nhan;
      b.addEventListener("click", () => (hd === "xay" ? this.cb.onXay(i) : this.cb.onHanhDong(hd)));
      btns.appendChild(b);
    };
    if (anh.hanhDong.includes("mua")) them(`MUA ${o!.gia}K`, "pri", "mua");
    if (anh.hanhDong.includes("tra")) them(`TRẢ ${dinhDang(anh.tienPhaiTra)}`, "pri", "tra");
    if (anh.hanhDong.includes("xay")) them("XÂY NHÀ", "pri", "xay");
    if (anh.hanhDong.includes("boqua")) them("Bỏ qua", "gh", "boqua");
    if (anh.hanhDong.includes("tieptuc")) {
      them("Tiếp tục", anh.hanhDong.length === 1 ? "pri" : "gh", "tieptuc");
    }

    ap.hidden = false;
    requestAnimationFrame(() => ap.classList.add("show"));
    this.chayDongHo(`${anh.luotCua}|${anh.oChoQuyet}|${anh.hanLuot}`);
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
    $("ktSub").textContent = thang
      ? `${thang.ten} là người cuối cùng còn trụ lại với ${dinhDang(thang.tien)}.`
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
    if (o.loai === "dat") {
      const b = bangThue(o.gia!);
      rows.push(["Giá mua", `${o.gia}K`]);
      rows.push(["Thuê (đất trống)", `${b[0]}K`]);
      rows.push(["Trọn nhóm, chưa xây", `${b[0] * 2}K`]);
      (["1 nhà", "2 nhà", "3 nhà", "4 nhà"] as const).forEach((t, k) => rows.push([t, `${b[k + 1]}K`]));
      rows.push(["Khách sạn", `${b[5]}K`]);
      rows.push(["Giá xây mỗi nhà", `${Math.round(giaXay(o) / DON_VI)}K`]);
      rows.push(["Thế chấp", `${Math.round(giaTheChap(o) / DON_VI)}K`]);
    } else if (o.loai === "bien") {
      rows.push(["Giá mua", `${o.gia}K`]);
      [25, 50, 100, 200].forEach((v, k) => rows.push([`Sở hữu ${k + 1} ô biển`, `${v}K`]));
    } else if (o.loai === "tienich") {
      rows.push(["Giá mua", `${o.gia}K`]);
      rows.push(["Sở hữu 1 tiện ích", "Điểm xúc xắc ×4"]);
      rows.push(["Sở hữu cả 2", "Điểm xúc xắc ×10"]);
    } else if (o.loai === "thue") {
      rows.push(["Phải nộp", `${o.thue}K`]);
    } else {
      rows.push(["Loại ô", tenLoaiO(o)]);
    }

    if (tt?.chu) {
      const chu = anh?.nguoiChoi.find((p) => p.sid === tt.chu);
      rows.push(["Chủ sở hữu", chu ? chu.ten : "?"]);
      if (tt.nha) rows.push(["Đã xây", tt.nha >= 5 ? "1 khách sạn" : `${tt.nha} nhà`]);
      if (tt.theChap) rows.push(["Tình trạng", "Đang thế chấp"]);
    } else if (o.loai === "dat" || o.loai === "bien" || o.loai === "tienich") {
      rows.push(["Chủ sở hữu", "Chưa ai mua"]);
    }

    $("tcTable").innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("");

    // Nút xây nhanh khi đó là đất của mình và đang tới lượt mình.
    const nutXay = $("tcXay") as HTMLButtonElement;
    const cuaToi = tt?.chu === this.sid && o.loai === "dat";
    nutXay.hidden = !cuaToi;
    if (cuaToi) {
      nutXay.textContent = `Xây nhà ở đây (${Math.round(giaXay(o) / DON_VI)}K)`;
      nutXay.onclick = () => { this.cb.onXay(i); this.dongTheO(); };
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

  matKetNoi() {
    $("sanh").hidden = false;
    $("vaoPhong").hidden = false;
    $("choPhong").hidden = true;
    ($("btnVao") as HTMLButtonElement).disabled = false;
    $("vaoSub").textContent = "Mất kết nối với máy chủ. Thử vào lại.";
  }

  get oDangChon() { return this.oDangXem; }

  private thoat(s: string): string {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
}

export { giaMua };
