import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  BAC_KHACH_SAN, BAN_CO, MAU_NGUOI_CHOI, SO_O, mauCuaO, tenLoaiO,
} from "@co-ty-phu/shared";
import type { O } from "@co-ty-phu/shared";
import type { AnhChup } from "./state.js";

/* ====================================================================
   Kích thước bàn cờ, tính theo đơn vị thế giới
   ==================================================================== */
const GOC = 3.2;      // cạnh ô góc
const RONG = 2.0;     // bề ngang ô thường
const SAU = 3.2;      // chiều sâu ô thường
const DAY = 0.5;      // độ dày ô
const VIEN = 2.9;     // bề rộng viền ngoài, nơi đặt công trình
// Mỗi cạnh có 7 ô thường, tức 3,5 ô mỗi nửa cạnh tính từ tâm.
const NUA = GOC + RONG * 3.5;  // 10.2 — mép ngoài hàng ô
const BIA = NUA + VIEN;        // 13.1 — mép ngoài bệ
const TRUC = NUA - SAU / 2;    //  8.6 — khoảng cách từ tâm tới tâm ô

interface ViTriO {
  x: number; z: number; ry: number;
  ox: number; oz: number;   // hướng ra ngoài
  goc: boolean;
}

function viTriCuaO(i: number): ViTriO {
  const bien = NUA - GOC - RONG / 2;
  if (i === 0)      return { x: TRUC, z: TRUC, ry: 0, ox: 0.7, oz: 0.7, goc: true };
  if (i < 8)        return { x: bien - (i - 1) * RONG, z: TRUC, ry: 0, ox: 0, oz: 1, goc: false };
  if (i === 8)      return { x: -TRUC, z: TRUC, ry: -Math.PI / 2, ox: -0.7, oz: 0.7, goc: true };
  if (i < 16)       return { x: -TRUC, z: bien - (i - 9) * RONG, ry: -Math.PI / 2, ox: -1, oz: 0, goc: false };
  if (i === 16)     return { x: -TRUC, z: -TRUC, ry: Math.PI, ox: -0.7, oz: -0.7, goc: true };
  if (i < 24)       return { x: -bien + (i - 17) * RONG, z: -TRUC, ry: Math.PI, ox: 0, oz: -1, goc: false };
  if (i === 24)     return { x: TRUC, z: -TRUC, ry: Math.PI / 2, ox: 0.7, oz: -0.7, goc: true };
  return { x: TRUC, z: -bien + (i - 25) * RONG, ry: Math.PI / 2, ox: 1, oz: 0, goc: false };
}

/* ====================================================================
   Tiện ích hình khối
   ==================================================================== */
function hinhBo(w: number, d: number, r: number): THREE.Shape {
  r = Math.min(r, w / 2 - 0.002, d / 2 - 0.002);
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function hopBo(w: number, h: number, d: number, r: number, bev = 0.05): THREE.ExtrudeGeometry {
  const b = Math.min(bev, h * 0.24, r * 0.7);
  const g = new THREE.ExtrudeGeometry(hinhBo(w, d, r), {
    depth: h - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b,
    bevelSegments: 2, curveSegments: 6,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  g.computeVertexNormals();
  return g;
}

function M(color: THREE.ColorRepresentation, rough = 0.82, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 0.32 });
}
function Mp(color: THREE.ColorRepresentation, rough = 0.3, metal = 0, clear = 0.7) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: metal,
    clearcoat: clear, clearcoatRoughness: 0.22, envMapIntensity: 1.1,
  });
}

function khoi(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Làm màu công trình đậm và ấm hơn để nổi trên nền bàn cờ xanh xám. */
function damMau(c: THREE.Color) {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.s < 0.07) c.setHSL(0.095, 0.16, Math.min(0.88, hsl.l * 0.93));
  else c.setHSL(hsl.h, Math.min(1, hsl.s * 1.55), Math.max(0.12, Math.min(0.78, hsl.l * 0.88)));
}

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ====================================================================
   Công trình biểu tượng trên viền bàn cờ
   ==================================================================== */
function nhaMai(w: number, h: number, d: number, tuong: number, mai: THREE.ColorRepresentation) {
  const g = new THREE.Group();
  g.add(khoi(hopBo(w, h, d, 0.09, 0.035), M(tuong, 0.78)));
  const m = khoi(new THREE.ConeGeometry(Math.max(w, d) * 0.76, h * 0.72, 4), M(mai, 0.74), 0, h + h * 0.36, 0);
  m.rotation.y = Math.PI / 4;
  g.add(m);
  return g;
}

function thapTang(n: number, r0: number, hT: number, tuong: number, mai: number) {
  const g = new THREE.Group();
  let y = 0;
  let r = r0;
  for (let i = 0; i < n; i++) {
    r = r0 * (1 - i * 0.14);
    g.add(khoi(new THREE.CylinderGeometry(r * 0.82, r, hT, 8), M(tuong, 0.8), 0, y + hT / 2, 0));
    g.add(khoi(new THREE.ConeGeometry(r * 1.5, hT * 0.5, 8), M(mai, 0.7), 0, y + hT + hT * 0.22, 0));
    y += hT * 0.96;
  }
  g.add(khoi(new THREE.ConeGeometry(r0 * 0.3, hT * 0.9, 8), M(mai, 0.6), 0, y + hT * 0.42, 0));
  return g;
}

function thong(h: number) {
  const g = new THREE.Group();
  g.add(khoi(new THREE.CylinderGeometry(0.055, 0.08, h * 0.3, 6), M(0x7a5a42, 0.9), 0, h * 0.15, 0));
  for (let i = 0; i < 3; i++) {
    g.add(khoi(new THREE.ConeGeometry(0.34 - i * 0.08, h * 0.42, 7), M(i % 2 ? 0x3f8c4e : 0x47a05a, 0.9), 0, h * 0.32 + i * h * 0.24, 0));
  }
  return g;
}

function cayTron(h: number, mau = 0x4faa5c) {
  const g = new THREE.Group();
  g.add(khoi(new THREE.CylinderGeometry(0.06, 0.085, h * 0.42, 6), M(0x7a5a42, 0.9), 0, h * 0.21, 0));
  g.add(khoi(new THREE.SphereGeometry(h * 0.33, 10, 8), M(mau, 0.92), 0, h * 0.62, 0));
  return g;
}

function dua(h: number) {
  const g = new THREE.Group();
  const tr = khoi(new THREE.CylinderGeometry(0.05, 0.095, h, 7), M(0x9d7b55, 0.9), 0, h / 2, 0);
  tr.rotation.z = 0.13;
  g.add(tr);
  for (let i = 0; i < 6; i++) {
    const la = khoi(new THREE.ConeGeometry(0.1, 0.72, 4), M(0x3fa05a, 0.85));
    la.rotation.z = Math.PI / 2 - 0.42;
    la.rotation.y = (i * Math.PI) / 3;
    la.position.set(Math.cos((i * Math.PI) / 3) * 0.3, h - 0.04, Math.sin((i * Math.PI) / 3) * 0.3);
    g.add(la);
  }
  return g;
}

function nuiDa(h: number, r: number) {
  const g = new THREE.Group();
  const m = khoi(new THREE.ConeGeometry(r, h, 6, 1), M(0x72916f, 0.98), 0, h / 2, 0);
  m.rotation.y = Math.random() * 2;
  m.scale.set(1, 1, 0.82);
  g.add(m);
  g.add(khoi(new THREE.SphereGeometry(r * 0.5, 7, 5), M(0x5f8a5c, 0.98), r * 0.4, h * 0.22, r * 0.2));
  return g;
}

function matNuoc(r: number, mau: number) {
  const m = khoi(new THREE.CircleGeometry(r, 20),
    new THREE.MeshStandardMaterial({ color: mau, roughness: 0.06, metalness: 0.42, envMapIntensity: 1.6 }),
    0, 0.02, 0);
  m.rotation.x = -Math.PI / 2;
  m.castShadow = false;
  return m;
}

function caoOc(w: number, h: number, d: number, mau: number, cuaSo: THREE.Texture, boSuuTap: THREE.MeshStandardMaterial[]) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: mau, roughness: 0.72, emissiveMap: cuaSo, emissive: 0x000000, envMapIntensity: 0.4,
  });
  boSuuTap.push(mat);
  g.add(khoi(new THREE.BoxGeometry(w, h, d), mat, 0, h / 2, 0));
  g.add(khoi(hopBo(w * 0.62, 0.22, d * 0.62, 0.07, 0.03), M(0xe3e9f1, 0.7), 0, h, 0));
  g.add(khoi(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), M(0xc8d2de, 0.6), 0, h + 0.46, 0));
  return g;
}

function thuyenBuom() {
  const g = new THREE.Group();
  const than = khoi(new THREE.CylinderGeometry(0.17, 0.3, 1.25, 6), M(0x8a5f3d, 0.88), 0, 0.14, 0);
  than.rotation.z = Math.PI / 2;
  than.scale.set(1, 1, 0.55);
  g.add(than);
  g.add(khoi(new THREE.CylinderGeometry(0.025, 0.03, 1.0, 5), M(0x6d4a2e, 0.88), 0, 0.62, 0));
  g.add(khoi(new THREE.PlaneGeometry(0.62, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xf2d9a8, side: THREE.DoubleSide, roughness: 0.85 }), 0.3, 0.72, 0));
  g.add(khoi(new THREE.PlaneGeometry(0.4, 0.48),
    new THREE.MeshStandardMaterial({ color: 0xf6e6c4, side: THREE.DoubleSide, roughness: 0.85 }), -0.24, 0.6, 0));
  return g;
}

function congVom(w: number, h: number, mau: number) {
  const g = new THREE.Group();
  g.add(khoi(hopBo(0.22, h, 0.22, 0.06, 0.03), M(mau, 0.8), -w / 2, 0, 0));
  g.add(khoi(hopBo(0.22, h, 0.22, 0.06, 0.03), M(mau, 0.8), w / 2, 0, 0));
  g.add(khoi(new THREE.TorusGeometry(w / 2, 0.1, 6, 14, Math.PI), M(mau, 0.8), 0, h, 0));
  return g;
}

/**
 * Dây cờ lễ hội: hai cột hai bên, một sợi dây võng và mấy lá cờ tam giác.
 * `rong` là khoảng cách hai cột, `cao` là độ cao dây, `z` là vị trí dọc ô.
 */
function dayCo(mau: THREE.ColorRepresentation, rong: number, cao: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const matCot = M(0xe3e9f1, 0.7);
  const matCo = new THREE.MeshStandardMaterial({
    color: mau, side: THREE.DoubleSide, roughness: 0.75, emissive: mau, emissiveIntensity: 0.12,
  });

  for (const sx of [-1, 1]) {
    g.add(khoi(new THREE.CylinderGeometry(0.028, 0.028, cao, 6), matCot, (sx * rong) / 2, cao / 2, z));
  }
  g.add(khoi(new THREE.BoxGeometry(rong, 0.02, 0.02), matCot, 0, cao - 0.05, z));

  // Năm lá cờ tam giác treo lủng lẳng dọc dây.
  const so = 5;
  for (let k = 0; k < so; k++) {
    const x = -rong / 2 + (rong / (so - 1)) * k;
    const hinh = new THREE.Shape();
    hinh.moveTo(-0.09, 0);
    hinh.lineTo(0.09, 0);
    hinh.lineTo(0, -0.22);
    hinh.closePath();
    const la = new THREE.Mesh(new THREE.ShapeGeometry(hinh), matCo);
    la.position.set(x, cao - 0.07, z);
    g.add(la);
  }
  return g;
}

/**
 * Ảnh đại diện tròn vẽ lên canvas, dùng làm mặt cho tấm biển trên quân cờ.
 *
 * Chưa có ảnh thật thì vẽ chữ cái đầu trên nền màu quân. Ảnh Google tải về
 * sau nên hàm trả canvas ngay, người gọi tự cập nhật texture khi ảnh xong.
 */
function texAvatar(mau: string, ten: string): HTMLCanvasElement {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  veNenAvatar(x, S, mau, ten);
  return c;
}

function veNenAvatar(x: CanvasRenderingContext2D, S: number, mau: string, ten: string) {
  x.clearRect(0, 0, S, S);
  // Vành trắng ngoài rồi tới vành màu quân, để quân nào ra quân nấy.
  x.fillStyle = "#ffffff";
  x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); x.fill();
  x.fillStyle = mau;
  x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 14, 0, Math.PI * 2); x.fill();

  x.fillStyle = "#ffffff";
  x.font = `800 ${Math.round(S * 0.46)}px "Baloo 2", sans-serif`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(ten.charAt(0).toUpperCase() || "?", S / 2, S / 2 + S * 0.03);
}

/** Cắt ảnh thành hình tròn và vẽ đè lên canvas đã có vành. */
function veAnhVaoAvatar(c: HTMLCanvasElement, img: HTMLImageElement, mau: string) {
  const S = c.width;
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, S, S);
  x.fillStyle = "#ffffff";
  x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); x.fill();

  x.save();
  x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 14, 0, Math.PI * 2); x.clip();
  const canh = Math.min(img.width, img.height) || 1;
  x.drawImage(img, (img.width - canh) / 2, (img.height - canh) / 2, canh, canh, 0, 0, S, S);
  x.restore();

  // Vành màu quân vẽ sau cùng, đè lên mép ảnh.
  x.strokeStyle = mau;
  x.lineWidth = 14;
  x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 9, 0, Math.PI * 2); x.stroke();
}

/** Cột cờ nhỏ cắm trên ô đã có chủ nhưng chưa xây gì. */
function cotCo(mau: THREE.Color, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(khoi(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), M(0xe3e9f1, 0.7), x, 0.47, z));
  g.add(khoi(new THREE.PlaneGeometry(0.42, 0.27),
    new THREE.MeshStandardMaterial({ color: mau, side: THREE.DoubleSide, roughness: 0.8 }),
    x + 0.21, 0.82, z));
  return g;
}

type XuongMoc = (cuaSo: THREE.Texture, boSuuTap: THREE.MeshStandardMaterial[]) => THREE.Group;

const MOC: Record<string, XuongMoc> = {
  nhaSan: () => {
    const g = new THREE.Group();
    for (const [x, z] of [[-0.45, 0], [0.45, 0.15]]) {
      const n = nhaMai(0.9, 0.44, 0.72, 0xe8d9bd, 0x8c6b4a);
      n.position.set(x, 0.26, z);
      g.add(n);
      for (const [cx, cz] of [[-0.34, -0.28], [0.34, -0.28], [-0.34, 0.28], [0.34, 0.28]]) {
        g.add(khoi(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 5), M(0x7a5a42, 0.9), x + cx, 0.13, z + cz));
      }
    }
    const nd = nuiDa(1.1, 0.5); nd.position.set(-1.25, 0, -0.3); g.add(nd);
    return g;
  },
  nuiDa: () => {
    const g = new THREE.Group();
    for (const [x, z, h, r] of [[0, 0, 1.5, 0.62], [0.95, 0.3, 1.0, 0.44], [-0.95, -0.2, 1.25, 0.5]]) {
      const n = nuiDa(h, r); n.position.set(x, 0, z); g.add(n);
    }
    return g;
  },
  nuiSong: () => {
    const g = new THREE.Group();
    g.add(matNuoc(1.25, 0x58b6d6));
    const n1 = nuiDa(1.35, 0.55); n1.position.set(-0.75, 0, -0.45); g.add(n1);
    const n2 = nuiDa(1.0, 0.42); n2.position.set(0.8, 0, -0.3); g.add(n2);
    const th = thuyenBuom(); th.scale.setScalar(0.5); th.position.set(0.1, 0.02, 0.5); g.add(th);
    return g;
  },
  ruongBac: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const r = 1.3 - i * 0.2;
      g.add(khoi(new THREE.CylinderGeometry(r, r + 0.05, 0.17, 14), M(i % 2 ? 0xa8cf6a : 0x93c45c, 0.95), 0, 0.085 + i * 0.15, 0));
    }
    return g;
  },
  ruongThong: (c, b) => {
    const g = MOC.ruongBac(c, b);
    const t1 = thong(1.3); t1.position.set(-1.05, 0, 0.5); g.add(t1);
    const t2 = thong(1.0); t2.position.set(1.1, 0, -0.4); g.add(t2);
    return g;
  },
  thuyenBuom: () => {
    const g = new THREE.Group();
    g.add(matNuoc(1.5, 0x3ba7c9));
    const t = thuyenBuom(); t.position.set(-0.15, 0.04, 0.25); g.add(t);
    const t2 = thuyenBuom(); t2.scale.setScalar(0.62); t2.position.set(0.85, 0.04, -0.45); t2.rotation.y = 0.6; g.add(t2);
    const n = nuiDa(1.5, 0.5); n.position.set(-1.0, 0, -0.65); g.add(n);
    const n2 = nuiDa(1.1, 0.38); n2.position.set(1.1, 0, 0.45); g.add(n2);
    return g;
  },
  cauVong: () => {
    const g = new THREE.Group();
    g.add(matNuoc(1.4, 0x3ba7c9));
    const c = congVom(1.9, 0.75, 0xf1c76b); c.position.y = 0.3; g.add(c);
    g.add(khoi(hopBo(2.0, 0.1, 0.3, 0.05, 0.03), M(0xe8b94f, 0.75), 0, 1.0, 0));
    const d1 = dua(1.0); d1.position.set(-1.15, 0, 0.55); g.add(d1);
    return g;
  },
  thapChuong: () => {
    const g = new THREE.Group();
    g.add(khoi(hopBo(1.5, 0.12, 1.0, 0.06, 0.04), M(0xd9cdb4, 0.9)));
    g.add(thapTang(5, 0.42, 0.34, 0xe9ddc6, 0xb0553f));
    const c = cayTron(0.85, 0x4b9a5c); c.position.set(-0.95, 0, 0.4); g.add(c);
    return g;
  },
  congThanh: () => {
    const g = new THREE.Group();
    g.add(khoi(hopBo(2.1, 0.72, 0.72, 0.08, 0.04), M(0xcfae7d, 0.86)));
    g.add(khoi(hopBo(2.35, 0.14, 0.95, 0.06, 0.04), M(0xb34a3c, 0.76), 0, 0.72, 0));
    g.add(khoi(hopBo(1.3, 0.5, 0.6, 0.07, 0.04), M(0xd9bd92, 0.86), 0, 0.86, 0));
    g.add(khoi(hopBo(1.55, 0.12, 0.8, 0.05, 0.04), M(0xb34a3c, 0.76), 0, 1.36, 0));
    g.add(khoi(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), M(0xdcd5c6, 0.8), 0, 1.78, 0));
    g.add(khoi(new THREE.PlaneGeometry(0.34, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xd93b4e, side: THREE.DoubleSide, roughness: 0.85 }), 0.18, 2.02, 0));
    return g;
  },
  thapCham: () => {
    const g = new THREE.Group();
    for (const [x, z, s] of [[-0.75, 0.1, 0.8], [0.15, -0.15, 1.15], [0.95, 0.2, 0.65]]) {
      const t = thapTang(3, 0.3, s * 0.34, 0xa8694c, 0x8d4f37);
      t.position.set(x, 0, z); t.scale.setScalar(s); g.add(t);
    }
    return g;
  },
  phoCo: () => {
    const g = new THREE.Group();
    const nha: [number, number, number][] = [[-0.78, 0, 0xf2d79b], [0, 0.12, 0xe9c478], [0.78, -0.05, 0xf3cf8c]];
    nha.forEach(([x, z, mau], i) => {
      const n = nhaMai(0.68, 0.56 + i * 0.06, 0.62, mau, 0x9c5a3c);
      n.position.set(x, 0, z); g.add(n);
    });
    for (let i = 0; i < 5; i++) {
      const d = khoi(new THREE.SphereGeometry(0.09, 8, 7),
        new THREE.MeshStandardMaterial({ color: 0xff6b5a, emissive: 0x7a1c0c, roughness: 0.6 }),
        -0.9 + i * 0.45, 1.12, 0.42);
      d.scale.y = 1.25;
      g.add(d);
    }
    return g;
  },
  resort: (c, b) => {
    const g = new THREE.Group();
    const n = matNuoc(1.45, 0x35b4cd); n.position.z = 0.35; g.add(n);
    g.add(khoi(hopBo(2.3, 0.1, 0.9, 0.1, 0.04), M(0xf0e2bd, 0.95), 0, 0, -0.55));
    const t = caoOc(0.72, 1.5, 0.6, 0xf6f3ec, c, b); t.position.set(-0.55, 0, -0.6); g.add(t);
    const d1 = dua(1.25); d1.position.set(0.5, 0, -0.45); g.add(d1);
    const d2 = dua(0.95); d2.position.set(1.0, 0, -0.2); g.add(d2);
    return g;
  },
  doiChe: () => {
    const g = new THREE.Group();
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const m = khoi(new THREE.SphereGeometry(0.26, 8, 6), M(r % 2 ? 0x4e9a57 : 0x58a862, 0.95),
          -1.0 + c * 0.66, 0.1, -0.52 + r * 0.42);
        m.scale.y = 0.6;
        g.add(m);
      }
    }
    const n = nhaMai(0.6, 0.4, 0.52, 0xf2ead6, 0x9c5a3c); n.position.set(1.15, 0, 0.45); g.add(n);
    return g;
  },
  nhaTho: () => {
    const g = new THREE.Group();
    g.add(khoi(hopBo(0.95, 0.8, 1.5, 0.08, 0.04), M(0xf0ddc0, 0.84), 0.35, 0, 0));
    const mai = khoi(new THREE.ConeGeometry(0.95, 0.5, 4), M(0xa64b3a, 0.76), 0.35, 1.0, 0);
    mai.rotation.y = Math.PI / 4; g.add(mai);
    g.add(khoi(hopBo(0.55, 1.6, 0.55, 0.07, 0.03), M(0xf5e6cc, 0.84), -0.7, 0, 0));
    g.add(khoi(new THREE.ConeGeometry(0.44, 0.95, 6), M(0xa64b3a, 0.72), -0.7, 2.0, 0));
    g.add(khoi(new THREE.SphereGeometry(0.08, 8, 6), Mp(0xf5b821, 0.3, 0.8), -0.7, 2.56, 0));
    const t1 = thong(1.45); t1.position.set(1.25, 0, 0.55); g.add(t1);
    const t2 = thong(1.1); t2.position.set(-1.3, 0, -0.5); g.add(t2);
    return g;
  },
  trucDien: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const x = -0.6 + i * 1.2;
      g.add(khoi(new THREE.CylinderGeometry(0.035, 0.075, 1.7, 5), M(0xb9c4d2, 0.6, 0.3), x, 0.85, 0));
      g.add(khoi(hopBo(0.62, 0.06, 0.07, 0.02, 0.015), M(0xb9c4d2, 0.6, 0.3), x, 1.5, 0));
      g.add(khoi(hopBo(0.46, 0.06, 0.07, 0.02, 0.015), M(0xb9c4d2, 0.6, 0.3), x, 1.2, 0));
    }
    g.add(khoi(hopBo(1.2, 0.55, 0.8, 0.08, 0.04), M(0xdfe6ee, 0.78), 0, 0, -0.75));
    return g;
  },
  thapNuoc: () => {
    const g = new THREE.Group();
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      g.add(khoi(new THREE.CylinderGeometry(0.045, 0.055, 1.1, 5), M(0xc3cedb, 0.7, 0.2), x, 0.55, z));
    }
    g.add(khoi(new THREE.CylinderGeometry(0.62, 0.5, 0.58, 12), M(0x6fc0dd, 0.45, 0.1), 0, 1.38, 0));
    g.add(khoi(new THREE.ConeGeometry(0.66, 0.3, 12), M(0x3f9dc0, 0.5), 0, 1.8, 0));
    return g;
  },
  caoOcDoi: (c, b) => {
    const g = new THREE.Group();
    const a = caoOc(0.8, 2.5, 0.8, 0xdce6f2, c, b); a.position.set(-0.55, 0, 0); g.add(a);
    const d = caoOc(0.68, 1.85, 0.68, 0xe8eef7, c, b); d.position.set(0.5, 0, 0.25); g.add(d);
    const e = caoOc(0.55, 1.25, 0.55, 0xd3dde9, c, b); e.position.set(1.2, 0, -0.3); g.add(e);
    return g;
  },
  choThap: () => {
    const g = new THREE.Group();
    g.add(khoi(hopBo(2.2, 0.78, 1.1, 0.09, 0.04), M(0xf1e2c4, 0.84)));
    g.add(khoi(hopBo(2.4, 0.12, 1.3, 0.06, 0.04), M(0xc2843f, 0.76), 0, 0.78, 0));
    g.add(khoi(hopBo(0.62, 0.72, 0.62, 0.07, 0.03), M(0xf7eed9, 0.84), 0, 0.9, 0));
    g.add(khoi(new THREE.ConeGeometry(0.5, 0.52, 4), M(0xc2843f, 0.72), 0, 1.86, 0));
    g.add(khoi(new THREE.CircleGeometry(0.17, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), 0, 1.4, 0.33));
    return g;
  },
  bienDua: () => {
    const g = new THREE.Group();
    const n = matNuoc(1.5, 0x2fbfd4); n.position.z = 0.3; g.add(n);
    g.add(khoi(hopBo(2.4, 0.1, 0.95, 0.12, 0.04), M(0xf5e9c8, 0.95), 0, 0, -0.6));
    for (const [x, z, h] of [[-0.9, -0.5, 1.35], [-0.1, -0.75, 1.05], [0.75, -0.45, 1.2]]) {
      const d = dua(h); d.position.set(x, 0, z); g.add(d);
    }
    const t = thuyenBuom(); t.scale.setScalar(0.5); t.position.set(0.85, 0.04, 0.6); g.add(t);
    return g;
  },
  chuaMotCot: () => {
    const g = new THREE.Group();
    g.add(matNuoc(1.2, 0x4aa6a8));
    g.add(khoi(new THREE.CylinderGeometry(0.17, 0.2, 0.75, 10), M(0xcfc2a8, 0.88), 0, 0.37, 0));
    g.add(khoi(hopBo(0.85, 0.36, 0.85, 0.07, 0.03), M(0xe4d6b8, 0.84), 0, 0.74, 0));
    const mai = khoi(new THREE.ConeGeometry(0.85, 0.45, 4), M(0xa8503c, 0.74), 0, 1.3, 0);
    mai.rotation.y = Math.PI / 4; g.add(mai);
    const t = cayTron(1.0, 0x3f8c4e); t.position.set(-1.1, 0, 0.5); g.add(t);
    return g;
  },
  thapRua: () => {
    const g = new THREE.Group();
    g.add(matNuoc(1.5, 0x3f8f7a));
    g.add(khoi(new THREE.CylinderGeometry(0.62, 0.72, 0.14, 14), M(0x8e9a86, 0.95), 0, 0.07, 0));
    g.add(khoi(hopBo(0.8, 0.5, 0.8, 0.06, 0.03), M(0xd6ceb8, 0.86), 0, 0.14, 0));
    g.add(khoi(hopBo(0.62, 0.42, 0.62, 0.06, 0.03), M(0xe1d9c3, 0.86), 0, 0.66, 0));
    g.add(khoi(hopBo(0.44, 0.34, 0.44, 0.05, 0.03), M(0xeae2cd, 0.86), 0, 1.08, 0));
    const mai = khoi(new THREE.ConeGeometry(0.44, 0.34, 4), M(0x97654a, 0.76), 0, 1.56, 0);
    mai.rotation.y = Math.PI / 4; g.add(mai);
    const c1 = cayTron(1.15, 0x46955a); c1.position.set(-1.25, 0, 0.5); g.add(c1);
    const c2 = cayTron(0.9, 0x3f8c4e); c2.position.set(1.2, 0, -0.45); g.add(c2);
    return g;
  },
};

function trangTriGoc(icon: string | undefined) {
  const g = new THREE.Group();
  if (icon === "xuatphat") {
    g.add(congVom(2.2, 1.3, 0xe02f52));
    g.add(khoi(hopBo(1.5, 0.16, 0.3, 0.06, 0.04), Mp(0xf5b821, 0.3, 0.8), 0, 1.4, 0));
    for (const x of [-1.3, 1.3]) {
      g.add(khoi(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), M(0xdfe6ee, 0.7), x, 0.7, 0.3));
      g.add(khoi(new THREE.PlaneGeometry(0.4, 0.26),
        new THREE.MeshStandardMaterial({ color: 0xf5b821, side: THREE.DoubleSide, roughness: 0.8 }),
        x + (x > 0 ? 0.2 : -0.2), 1.3, 0.3));
    }
  } else if (icon === "daohoang") {
    g.add(khoi(hopBo(2.2, 0.1, 1.6, 0.3, 0.04), M(0xf0e2bd, 0.95)));
    const n1 = nuiDa(1.5, 0.55); n1.position.set(-0.8, 0.05, -0.3); g.add(n1);
    const d1 = dua(1.5); d1.position.set(0.5, 0.05, 0.1); g.add(d1);
    const d2 = dua(1.1); d2.position.set(1.05, 0.05, -0.4); g.add(d2);
  } else if (icon === "lehoi") {
    g.add(khoi(new THREE.CylinderGeometry(1.25, 1.35, 0.22, 16), M(0xdc4b63, 0.84), 0, 0.11, 0));
    g.add(khoi(new THREE.CylinderGeometry(0.95, 0.95, 0.14, 16), M(0xf4e3bd, 0.9), 0, 0.28, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.add(khoi(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5), M(0xe8eef7, 0.75), Math.cos(a), 0.65, Math.sin(a)));
      g.add(khoi(new THREE.PlaneGeometry(0.36, 0.24),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf5b821 : 0x2f5bd4, side: THREE.DoubleSide, roughness: 0.82 }),
        Math.cos(a) + 0.18, 1.2, Math.sin(a)));
    }
    g.add(khoi(new THREE.OctahedronGeometry(0.34), Mp(0xf5b821, 0.25, 0.9), 0, 0.72, 0));
  } else {
    const mau = Mp(0xeef3f9, 0.3, 0.4);
    const than = khoi(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 12), mau, 0, 1.0, 0);
    than.rotation.z = Math.PI / 2; g.add(than);
    const mui = khoi(new THREE.ConeGeometry(0.2, 0.45, 12), mau, 1.12, 1.0, 0);
    mui.rotation.z = -Math.PI / 2; g.add(mui);
    g.add(khoi(hopBo(0.52, 0.07, 2.0, 0.05, 0.025), M(0xd93b4e, 0.65), 0, 1.02, 0));
    g.add(khoi(hopBo(0.3, 0.46, 0.09, 0.04, 0.02), M(0xd93b4e, 0.65), -0.75, 1.26, 0));
    g.add(khoi(hopBo(0.26, 0.06, 0.7, 0.04, 0.02), M(0xd93b4e, 0.65), -0.78, 1.02, 0));
    g.add(khoi(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6), M(0xcdd7e3, 0.7), 0, 0.5, 0));
  }
  return g;
}

/* ====================================================================
   Vẽ nhãn ô bằng canvas
   ==================================================================== */
/**
 * Xếp chữ thành tối đa `maxDong` dòng, thu nhỏ dần cho tới khi vừa bề ngang.
 * Trả về các dòng và cỡ chữ đã chọn.
 */
function xepDong(
  ctx: CanvasRenderingContext2D, chu: string, maxW: number,
  coBatDau: number, weight: string, font: string, maxDong = 2,
): { dong: string[]; co: number } {
  const tu = chu.split(" ");
  for (let co = coBatDau; co >= 16; co -= 2) {
    ctx.font = `${weight} ${co}px ${font}`;
    if (ctx.measureText(chu).width <= maxW) return { dong: [chu], co };
    if (tu.length < 2 || maxDong < 2) continue;

    const dong: string[] = [];
    let hienTai = tu[0];
    for (const t of tu.slice(1)) {
      const thu = `${hienTai} ${t}`;
      if (ctx.measureText(thu).width <= maxW) hienTai = thu;
      else { dong.push(hienTai); hienTai = t; }
    }
    dong.push(hienTai);
    if (dong.length <= maxDong && dong.every((d) => ctx.measureText(d).width <= maxW)) {
      return { dong, co };
    }
  }
  ctx.font = `${weight} 16px ${font}`;
  return { dong: [chu], co: 16 };
}

function veDong(
  ctx: CanvasRenderingContext2D, kq: { dong: string[]; co: number },
  cx: number, cyGiua: number, weight: string, font: string,
) {
  ctx.font = `${weight} ${kq.co}px ${font}`;
  const buoc = kq.co * 1.02;
  const dau = cyGiua - ((kq.dong.length - 1) * buoc) / 2;
  kq.dong.forEach((d, i) => ctx.fillText(d, cx, dau + i * buoc));
}

/**
 * Vẽ nhãn một ô.
 *
 * `dao` dành cho hai cạnh ở phía xa người xem. Camera cố định nên hai cạnh đó
 * quay lưng lại: chữ vẽ bình thường sẽ hiện ngược đầu. Khi `dao` bật, toàn bộ
 * nội dung được vẽ xoay 180° ngay trong canvas, nên lên màn hình thì đọc xuôi
 * mà dải màu vẫn nằm đúng mép trong của ô.
 */
function veNhan(o: O, goc: boolean, dao: boolean): HTMLCanvasElement {
  // Canvas lớn hơn tỉ lệ ô thật để chữ còn nét khi thu nhỏ xuống màn hình.
  const W = goc ? 384 : 240;
  const H = 384;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  const mau = mauCuaO(o);
  const BALOO = '"Baloo 2", system-ui, sans-serif';
  const BVP = '"Be Vietnam Pro", system-ui, sans-serif';

  x.fillStyle = "#fcfdff";
  x.fillRect(0, 0, W, H);

  if (goc) {
    const g0 = x.createLinearGradient(0, 0, W, H);
    g0.addColorStop(0, `${mau}26`); g0.addColorStop(1, `${mau}0d`);
    x.fillStyle = g0; x.fillRect(0, 0, W, H);
    x.save();
    // Ô góc nằm chéo nên chữ xoay 45°; cạnh xa thì xoay thêm nửa vòng.
    x.translate(W / 2, H / 2);
    x.rotate(dao ? Math.PI * 0.75 : -Math.PI / 4);
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = mau;
    x.font = `700 92px ${BALOO}`;
    const bieu: Record<string, string> = { xuatphat: "▶", daohoang: "⚑", lehoi: "★", dulich: "✈" };
    x.fillText(bieu[o.icon ?? ""] ?? "●", 0, -56);
    x.fillStyle = "#13203a";
    veDong(x, xepDong(x, o.ten, 286, 46, "800", BALOO, 2), 0, 36, "800", BALOO);
    if (o.phu) {
      x.fillStyle = "#64748b";
      x.font = `600 22px ${BVP}`;
      x.fillText(o.phu, 0, 92);
    }
    x.restore();
    return c;
  }

  if (dao) {
    x.translate(W / 2, H / 2);
    x.rotate(Math.PI);
    x.translate(-W / 2, -H / 2);
  }
  /** Toạ độ dọc mong muốn trên màn hình, đổi sang toạ độ canvas. */
  const Y = (v: number) => (dao ? H - v : v);

  // Dải màu nhóm nằm ở mép trong của ô. Tên nhóm không in ở đây nữa — màu đã
  // nói rõ rồi, bỏ đi thì tên thành phố có thêm chỗ để phóng to.
  const daiH = o.loai === "dat" ? 58 : 50;

  // Nền theo chủ đề: ô biển có nước và đảo, ô đất có mảng màu nhóm nhạt,
  // tiện ích và thuế có sắc riêng. Vẽ trước để chữ nằm đè lên trên.
  if (o.loai === "bien") {
    const gn = x.createLinearGradient(0, Y(daiH), 0, Y(H));
    gn.addColorStop(0, "#9fdcef");
    gn.addColorStop(0.55, "#cdeefa");
    gn.addColorStop(1, "#fbfcfe");
    x.fillStyle = gn; x.fillRect(0, Y(H), W, H - daiH);

    // Sóng
    x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 4;
    for (const [sy, lech] of [[96, 0], [124, 34], [152, -26]] as const) {
      x.beginPath();
      for (let px = -20; px <= W + 20; px += 10) {
        const py = Y(sy + Math.sin((px + lech) / 22) * 5);
        if (px === -20) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }

    // Đảo cát với cây dừa
    const cx = W / 2;
    x.fillStyle = "#f3e2b4";
    x.beginPath(); x.ellipse(cx, Y(206), 64, 21, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#e6d09a";
    x.beginPath(); x.ellipse(cx + 10, Y(202), 32, 11, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#8a6a44"; x.lineWidth = 6; x.lineCap = "round";
    x.beginPath(); x.moveTo(cx - 4, Y(204)); x.quadraticCurveTo(cx - 15, Y(234), cx - 7, Y(254)); x.stroke();
    x.fillStyle = "#49a35e";
    for (const a of [-1.15, -0.45, 0.45, 1.15]) {
      x.save();
      x.translate(cx - 7, Y(254));
      x.rotate(dao ? Math.PI + a : a);
      x.beginPath(); x.ellipse(0, -15, 8, 24, 0, 0, Math.PI * 2); x.fill();
      x.restore();
    }
  } else if (o.loai === "dat") {
    const gn = x.createLinearGradient(0, Y(daiH), 0, Y(H));
    gn.addColorStop(0, `${mau}24`);
    gn.addColorStop(0.5, `${mau}0a`);
    gn.addColorStop(1, "#fbfcfe");
    x.fillStyle = gn; x.fillRect(0, Y(H), W, H - daiH);
  } else if (o.loai === "thue") {
    x.fillStyle = "#eef1f6"; x.fillRect(0, Y(H), W, H - daiH);
  }

  x.fillStyle = mau; x.fillRect(0, Y(daiH), W, daiH);
  x.fillStyle = "rgba(255,255,255,.22)"; x.fillRect(0, Y(6), W, 6);
  x.fillStyle = "rgba(0,0,0,.16)"; x.fillRect(0, Y(daiH), W, 6);
  x.textAlign = "center"; x.textBaseline = "middle";

  if (o.loai === "dat") {
    x.fillStyle = "#13203a";
    veDong(x, xepDong(x, o.ten, W - 22, 68, "800", BALOO, 2), W / 2, Y(176), "800", BALOO);

    x.strokeStyle = `${mau}66`; x.lineWidth = 4;
    x.beginPath(); x.moveTo(W / 2 - 44, Y(262)); x.lineTo(W / 2 + 44, Y(262)); x.stroke();

    x.fillStyle = mau;
    x.font = `800 62px ${BALOO}`;
    x.fillText(`${o.gia}K`, W / 2, Y(324));
  } else if (o.loai === "bien") {
    // Đảo và sóng đã vẽ ở nền, nên không cần biểu tượng mỏ neo nữa.
    x.fillStyle = "rgba(255,255,255,.96)"; x.font = `700 22px ${BVP}`;
    x.fillText("Ô BIỂN", W / 2, Y(daiH / 2));

    x.fillStyle = "#13203a";
    veDong(x, xepDong(x, o.ten, W - 18, 42, "800", BALOO, 2), W / 2, Y(300), "800", BALOO);

    x.fillStyle = mau; x.font = `800 48px ${BALOO}`;
    x.fillText(`${o.gia}K`, W / 2, Y(352));
  } else {
    const nhan: Record<string, string> = { cohoi: "CƠ HỘI", thue: "THUẾ" };
    const bieu: Record<string, string> = { cohoi: "?", thue: "₫" };
    x.fillStyle = "rgba(255,255,255,.96)"; x.font = `700 22px ${BVP}`;
    x.fillText(nhan[o.loai], W / 2, Y(daiH / 2));

    const cy = o.loai === "thue" ? 196 : 228;
    x.fillStyle = `${mau}22`;
    x.beginPath(); x.arc(W / 2, Y(cy), o.loai === "thue" ? 74 : 88, 0, Math.PI * 2); x.fill();
    x.fillStyle = mau;
    x.font = `800 ${o.loai === "thue" ? 108 : 130}px ${BALOO}`;
    x.fillText(bieu[o.loai], W / 2, Y(cy + 8));

    if (o.loai === "thue") {
      x.fillStyle = "#13203a";
      veDong(x, xepDong(x, o.ten, W - 16, 34, "800", BALOO, 2), W / 2, Y(306), "800", BALOO);
      x.fillStyle = "#8d9bad"; x.font = `700 28px ${BVP}`;
      x.fillText(`Nộp ${o.thue}K`, W / 2, Y(356));
    }
  }
  return c;
}

function matXucXac(n: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fbfcfe"; x.fillRect(0, 0, 128, 128);
  x.fillStyle = "#d93b4e";
  const P: Record<number, [number, number][]> = {
    1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]],
    4: [[36, 36], [92, 36], [36, 92], [92, 92]],
    5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]],
    6: [[36, 30], [36, 64], [36, 98], [92, 30], [92, 64], [92, 98]],
  };
  for (const [px, py] of P[n]) { x.beginPath(); x.arc(px, py, 11, 0, Math.PI * 2); x.fill(); }
  return c;
}

function texCuaSo(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000"; x.fillRect(0, 0, 128, 256);
  for (let r = 0; r < 11; r++) {
    for (let k = 0; k < 4; k++) {
      if (Math.random() < 0.26) continue;
      x.fillStyle = "#fff";
      x.fillRect(12 + k * 27, 14 + r * 21, 16, 12);
    }
  }
  return c;
}

/** Mặt nhựa có vạch kẻ đứt ở giữa, lặp dọc theo chiều dài mỗi đoạn đường. */
function texDuong(vach: boolean): HTMLCanvasElement {
  const W = 256, H = 64;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;

  x.fillStyle = "#59606b";
  x.fillRect(0, 0, W, H);

  // Hạt sạn cho mặt đường đỡ phẳng lì.
  x.globalAlpha = 0.06;
  for (let i = 0; i < 700; i++) {
    x.fillStyle = Math.random() < 0.5 ? "#000" : "#fff";
    x.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
  }
  x.globalAlpha = 1;

  // Vệt sáng dọc hai mép cho giống lề đường.
  x.fillStyle = "rgba(255,255,255,.12)";
  x.fillRect(0, 0, W, 3);
  x.fillRect(0, H - 3, W, 3);

  if (vach) {
    x.fillStyle = "rgba(255,255,255,.72)";
    const dai = 46, cach = 38;
    for (let px = 10; px < W; px += dai + cach) {
      x.fillRect(px, H / 2 - 3, Math.min(dai, W - px), 6);
    }
  }
  return c;
}

function texCo(): HTMLCanvasElement {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  x.fillStyle = css("--grass"); x.fillRect(0, 0, S, S);
  x.fillStyle = css("--grass-2");
  for (let i = 0; i < S; i += 96) x.fillRect(i, 0, 48, S);
  x.globalAlpha = 0.07; x.fillStyle = "#000";
  for (let k = 0; k < 2200; k++) {
    x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 1 + Math.random() * 2.4, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  x.save();
  x.translate(S / 2, S / 2);
  x.textAlign = "center"; x.textBaseline = "middle";
  x.globalAlpha = 0.19; x.fillStyle = "#fff";
  x.font = '800 132px "Baloo 2", system-ui, sans-serif'; x.fillText("CỜ TỶ PHÚ", 0, -56);
  x.font = '800 96px "Baloo 2", system-ui, sans-serif'; x.fillText("VIỆT NAM", 0, 56);
  x.globalAlpha = 0.16; x.strokeStyle = "#fff"; x.lineWidth = 8;
  x.beginPath(); x.moveTo(-250, 126); x.lineTo(250, 126); x.stroke();
  x.restore();
  return c;
}

function texMay(): HTMLCanvasElement {
  const W = 256, H = 140;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  for (const [bx, by, r] of [[72, 86, 46], [128, 70, 56], [180, 88, 42], [102, 96, 40], [158, 98, 38]]) {
    const g = x.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, "rgba(255,255,255,.98)");
    g.addColorStop(0.6, "rgba(255,255,255,.72)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill();
  }
  return c;
}

function nenTroi(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 8; c.height = 512;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, css("--sky-1"));
  g.addColorStop(0.55, css("--sky-2"));
  g.addColorStop(1, css("--sky-3"));
  x.fillStyle = g; x.fillRect(0, 0, 8, 512);
  return c;
}

function texMoiTruong(): HTMLCanvasElement {
  const W = 512, H = 256;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css("--sky-1"));
  g.addColorStop(0.4, css("--sky-2"));
  g.addColorStop(0.5, css("--sky-3"));
  g.addColorStop(0.52, "#9cc07f");
  g.addColorStop(1, "#5f9a55");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const sx = W * 0.72, sy = H * 0.2;
  const sg = x.createRadialGradient(sx, sy, 0, sx, sy, H * 0.42);
  sg.addColorStop(0, "rgba(255,252,238,1)");
  sg.addColorStop(0.2, "rgba(255,245,216,.5)");
  sg.addColorStop(1, "rgba(255,245,216,0)");
  x.fillStyle = sg; x.fillRect(0, 0, W, H * 0.52);
  return c;
}

/* ====================================================================
   Quân cờ: hàng đợi đường đi để nhảy từng ô một
   ==================================================================== */
interface Quan {
  nhom: THREE.Group;
  oHienTai: number;
  duongDi: number[];
  t: number;
}

/* ====================================================================
   Lớp chính
   ==================================================================== */
export class BanCo3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private world = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private rim: THREE.DirectionalLight;

  private bgTex: THREE.CanvasTexture;
  private coTex: THREE.CanvasTexture;
  private matTop = M("#5c84ad", 0.9);
  private matSide = M("#43688e", 0.95);
  private matDeep = M("#2f4c6c", 1);
  private matRock = M("#27425e", 1);
  private matKerb = M("#e4d9b8", 0.9);
  private matCoNen = M("#78c553", 1);
  private vatLieuCuaSo: THREE.MeshStandardMaterial[] = [];

  private oMeshes: THREE.Mesh[] = [];
  private viTri: ViTriO[] = [];
  private soHuu = new Map<number, THREE.Group>();
  private coLeHoi = new Map<number, THREE.Group>();
  private quan = new Map<string, Quan>();
  private dice: THREE.Mesh[] = [];
  /** Độ cao nghỉ của hai con xúc xắc, để thả về đúng chỗ sau khi nảy. */
  private diceY: number[] = [];
  /**
   * Hoạt ảnh gieo: tungT chạy từ 0 tới 1 rồi dừng. Bằng 1 nghĩa là không có
   * hoạt ảnh nào đang chạy.
   */
  private tungT = 1;
  private tungDich: [number, number] = [1, 1];
  private tungQuay: { x: number; y: number; z: number }[] = [];
  private lanTungCu = -1;
  private may: THREE.Sprite[] = [];
  private cocTien: THREE.Group[] = [];

  private raycaster = new THREE.Raycaster();
  private chuot = new THREE.Vector2();
  private onChonO?: (i: number) => void;
  private dong = 0;
  private khungCanCapNhat = true;
  private lechTrai = 0;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private onZoom?: (z: number) => void;
  private huy = false;

  constructor(private canvas: HTMLCanvasElement) {
    const cao = window.innerWidth >= 860;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cao ? 2 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.bgTex = new THREE.CanvasTexture(nenTroi());
    this.bgTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.bgTex;
    this.scene.fog = new THREE.Fog(new THREE.Color(css("--sky-2")), 70, 142);

    this.camera = new THREE.OrthographicCamera(-20, 20, 20, -20, -80, 160);
    this.camera.position.copy(new THREE.Vector3(1, 1.08, 1).normalize().multiplyScalar(60));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x9fb2c6, 0.12);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.45);
    this.sun.position.set(19, 23, 13);
    this.sun.castShadow = true;
    const sm = cao ? 4096 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.fill = new THREE.DirectionalLight(0xbcd9ff, 0.26);
    this.fill.position.set(-20, 11, -15);
    this.rim = new THREE.DirectionalLight(0xffffff, 0.3);
    this.rim.position.set(-8, 5, 18);
    this.scene.add(this.hemi, this.sun, this.fill, this.rim, this.world);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();

    this.coTex = new THREE.CanvasTexture(texCo());
    this.coTex.colorSpace = THREE.SRGBColorSpace;
    this.coTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.dungBan();
    this.dungHauKy();
    this.dongBoMau();
    this.ganSuKien();
    this.ve();
  }

  /* ---------------------------------------------------------- dựng cảnh */

  private dungBan() {
    // ExtrudeGeometry chia hai nhóm vật liệu: nhóm 0 là hai mặt phẳng, nhóm 1 là cạnh.
    const slab = new THREE.Mesh(hopBo(BIA * 2, 1.15, BIA * 2, 1.6, 0.14), [this.matTop, this.matSide]);
    slab.position.set(0, -1.15, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.world.add(slab);
    this.world.add(khoi(hopBo(BIA * 2 - 1.3, 1.1, BIA * 2 - 1.3, 1.4, 0.1), this.matDeep, 0, -2.2, 0));

    const daDay = khoi(new THREE.ConeGeometry(BIA * 0.92, 3.6, 7), this.matRock, 0, -2.1, 0);
    daDay.rotation.x = Math.PI; daDay.rotation.y = 0.4;
    this.world.add(daDay);
    for (const [x, y, z, r] of [[5.5, -3.6, 3.2, 2.1], [-6.2, -3.9, -4.0, 2.6], [1.5, -4.6, -6.0, 1.7]]) {
      const m = khoi(new THREE.ConeGeometry(r, r * 1.5, 6), this.matRock, x, y, z);
      m.rotation.x = Math.PI; m.rotation.y = Math.random() * 3;
      this.world.add(m);
    }

    const SAN = (NUA - SAU) * 2;
    this.world.add(khoi(hopBo(SAN + 0.55, 0.16, SAN + 0.55, 1.05, 0.05), this.matKerb));
    this.world.add(khoi(hopBo(SAN, 0.2, SAN, 0.9, 0.05), this.matCoNen));
    const mc = khoi(new THREE.PlaneGeometry(SAN - 0.26, SAN - 0.26),
      new THREE.MeshStandardMaterial({ map: this.coTex, roughness: 1 }), 0, 0.202, 0);
    mc.rotation.x = -Math.PI / 2;
    mc.castShadow = false;
    this.world.add(mc);

    /* ---- vòng đường nhựa chạy sát mép trong hàng ô ---- */
    const RONG_DUONG = 1.25;
    const MEP = SAN / 2 + 0.02;              // mép ngoài, nằm ngay dưới hàng ô
    const GIUA = MEP - RONG_DUONG / 2;
    const DAI = (MEP - RONG_DUONG) * 2;      // đoạn thẳng, chừa chỗ cho bốn góc

    const texVach = new THREE.CanvasTexture(texDuong(true));
    texVach.colorSpace = THREE.SRGBColorSpace;
    texVach.wrapS = THREE.RepeatWrapping;
    texVach.repeat.set(7, 1);
    texVach.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const matVach = new THREE.MeshStandardMaterial({ map: texVach, roughness: 0.96 });

    const texTron = new THREE.CanvasTexture(texDuong(false));
    texTron.colorSpace = THREE.SRGBColorSpace;
    const matTron = new THREE.MeshStandardMaterial({ map: texTron, roughness: 0.96 });

    // Bốn đoạn thẳng. Xoay quanh X để nằm ngang, xoay quanh Z để đổi chiều dài.
    const doan: [number, number, number][] = [
      [0, GIUA, 0], [0, -GIUA, 0], [GIUA, 0, Math.PI / 2], [-GIUA, 0, Math.PI / 2],
    ];
    for (const [dx, dz, xoay] of doan) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(DAI, RONG_DUONG), matVach);
      m.rotation.set(-Math.PI / 2, 0, xoay);
      m.position.set(dx, 0.206, dz);
      m.receiveShadow = true;
      this.world.add(m);
    }
    // Bốn góc bo vuông nối các đoạn lại.
    for (const dx of [GIUA, -GIUA]) {
      for (const dz of [GIUA, -GIUA]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(RONG_DUONG, RONG_DUONG), matTron);
        m.rotation.x = -Math.PI / 2;
        m.position.set(dx, 0.206, dz);
        m.receiveShadow = true;
        this.world.add(m);
      }
    }

    const cuaSo = new THREE.CanvasTexture(texCuaSo());
    cuaSo.wrapS = cuaSo.wrapT = THREE.RepeatWrapping;
    const matO = M(0xffffff, 0.8);

    BAN_CO.forEach((o, i) => {
      const v = viTriCuaO(i);
      this.viTri.push(v);
      const w = v.goc ? GOC : RONG;
      const d = v.goc ? GOC : SAU;

      const g = new THREE.Group();
      g.position.set(v.x, 0, v.z);
      g.rotation.y = v.ry;

      const than = khoi(hopBo(w - 0.07, DAY, d - 0.07, 0.17, 0.055), matO);
      than.userData.index = i;
      g.add(than);
      this.oMeshes.push(than);

      // Camera cố định nhìn từ hướng +x +z, nên hai cạnh tây (ô 9–17) và bắc
      // (ô 18–26) quay lưng lại người xem: nhãn của chúng phải vẽ đảo đầu.
      const tex = new THREE.CanvasTexture(veNhan(o, v.goc, i >= 8 && i <= 23));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const nhan = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.26, d - 0.26),
        new THREE.MeshBasicMaterial({ map: tex }));
      nhan.rotation.x = -Math.PI / 2;
      nhan.position.y = DAY + 0.006;
      g.add(nhan);
      this.world.add(g);

      // công trình biểu tượng trên viền ngoài
      const len = Math.hypot(v.ox, v.oz) || 1;
      const day = v.goc ? GOC / 2 + VIEN * 0.52 : SAU / 2 + VIEN * 0.46;
      const px = v.x + (v.ox / len) * day;
      const pz = v.z + (v.oz / len) * day;
      const prop = v.goc ? trangTriGoc(o.icon) : o.moc && MOC[o.moc] ? MOC[o.moc](cuaSo, this.vatLieuCuaSo) : null;
      if (prop) {
        prop.position.set(px, 0, pz);
        prop.rotation.y = v.ry;
        prop.scale.setScalar(v.goc ? 1.05 : 0.95);
        prop.traverse((m) => {
          if (!(m instanceof THREE.Mesh)) return;
          m.castShadow = true;
          m.receiveShadow = true;
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat?.color) damMau(mat.color);
        });
        this.world.add(prop);
      }
    });

    // xúc xắc
    this.dice = [0, 1].map((i) => {
      const mats = [1, 6, 2, 5, 3, 4].map((n) => {
        const t = new THREE.CanvasTexture(matXucXac(n));
        t.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshPhysicalMaterial({
          map: t, roughness: 0.28, metalness: 0.04, clearcoat: 0.8, clearcoatRoughness: 0.14, envMapIntensity: 1.2,
        });
      });
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), mats);
      m.position.set(i ? 1.35 : -1.35, 0.72, i ? 0.95 : -0.45);
      m.castShadow = true;
      this.world.add(m);
      this.diceY[i] = m.position.y;
      return m;
    });

    // cọc tiền trang trí
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], idx) => {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const t = khoi(hopBo(1.5, 0.16, 0.8, 0.05, 0.03), M(i % 2 ? 0x7fc46b : 0x6bb45a, 0.88), (i % 2) * 0.1, i * 0.17, (i % 2) * 0.08);
        t.rotation.y = (Math.random() - 0.5) * 0.3;
        g.add(t);
      }
      for (let k = 0; k < 3; k++) {
        g.add(khoi(hopBo(0.75, 0.22, 0.42, 0.07, 0.04), Mp(0xf0b429, 0.2, 1, 0.25), -1.3, 0.11 + k * 0.23, 0.5 - k * 0.1));
      }
      g.position.set(sx * (BIA + 1.5), -1.5, sz * (BIA + 1.5));
      g.rotation.y = idx * 1.3;
      g.scale.setScalar(1.3);
      g.userData = { y0: -1.5, ph: idx * 1.7 };
      this.world.add(g);
      this.cocTien.push(g);
    });

    // mây
    const mayTex = new THREE.CanvasTexture(texMay());
    for (let i = 0; i < 13; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mayTex, transparent: true, depthWrite: false }));
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 16;
      const s = 5 + Math.random() * 7;
      sp.scale.set(s, s * 0.5, 1);
      sp.position.set(Math.cos(a) * r, -3 + Math.random() * 9, Math.sin(a) * r);
      sp.material.opacity = 0.45 + Math.random() * 0.45;
      sp.userData = { a, r, sp: 0.00018 + Math.random() * 0.00032, y: sp.position.y, ph: Math.random() * 6 };
      this.scene.add(sp);
      this.may.push(sp);
    }
  }

  private dungHauKy() {
    const s = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(s);
    const rt = new THREE.WebGLRenderTarget(Math.max(1, s.x), Math.max(1, s.y), {
      samples: window.innerWidth >= 860 ? 4 : 2,
      type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(s, 0.22, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    // OutputPass lo tone mapping và chuyển sang sRGB ở cuối chuỗi, nên quầng
    // sáng được tính trong không gian tuyến tính — đúng về mặt vật lý.
    this.composer.addPass(new OutputPass());
  }

  /* ------------------------------------------------------------ ánh sáng */

  dongBoMau() {
    this.bgTex.image = nenTroi();
    this.bgTex.needsUpdate = true;
    this.coTex.image = texCo();
    this.coTex.needsUpdate = true;
    this.matTop.color.set(css("--slab-top"));
    this.matSide.color.set(css("--slab-side"));
    this.matDeep.color.set(css("--slab-deep"));
    this.matRock.color.set(css("--rock"));
    this.matKerb.color.set(css("--kerb"));
    this.matCoNen.color.set(css("--grass"));

    // Chỉ còn một bộ màu: ban ngày, nắng gắt, màu no.
    //
    // Phơi sáng cố ý giữ dưới 1: đẩy cao hơn thì mọi kênh màu bị cắt ngọn và
    // bàn cờ bạc trắng ra — đã mắc đúng lỗi đó một lần. Muốn rực hơn thì tăng
    // độ bão hoà của bảng màu trong style.css chứ đừng tăng phơi sáng.
    this.hemi.intensity = 0.16;
    this.sun.intensity = 1.75;
    this.sun.color.set(0xfff4e2);
    this.fill.intensity = 0.32;
    this.rim.intensity = 0.38;
    this.renderer.toneMappingExposure = 0.62;
    (this.scene.fog as THREE.Fog).color.set(css("--sky-2"));
    // Chuỗi hậu kỳ chạy trong không gian tuyến tính, nên đặt ngưỡng ở 1.0:
    // chỉ những gì thực sự phát sáng mới toả quầng, mặt ô trắng thì không.
    if (this.bloom) {
      this.bloom.strength = 0.3;
      this.bloom.threshold = 1.0;
      this.bloom.radius = 0.5;
    }
    for (const m of this.vatLieuCuaSo) {
      m.emissive.set(0x000000);
      m.emissiveIntensity = 0;
    }
    for (const s of this.may) s.material.color.set(0xffffff);

    if (this.envRT) this.envRT.dispose();
    const t = new THREE.CanvasTexture(texMoiTruong());
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    this.envRT = this.pmrem.fromEquirectangular(t);
    this.scene.environment = this.envRT.texture;
    t.dispose();
  }

  /* --------------------------------------------------------- cập nhật */

  capNhat(anh: AnhChup) {
    // sở hữu, nhà, khách sạn
    anh.o.forEach((tt, i) => this.veSoHuu(i, tt, anh));

    // cờ lễ hội
    anh.o.forEach((tt, i) => this.veLeHoi(i, tt));

    // quân cờ
    const conSong = new Set(anh.nguoiChoi.map((p) => p.sid));
    for (const [sid, q] of this.quan) {
      if (!conSong.has(sid)) { this.world.remove(q.nhom); this.quan.delete(sid); }
    }
    for (const p of anh.nguoiChoi) {
      let q = this.quan.get(p.sid);
      if (!q) {
        q = { nhom: this.taoQuan(p), oHienTai: p.viTri, duongDi: [], t: 0 };
        this.world.add(q.nhom);
        this.quan.set(p.sid, q);
        this.datQuanVaoO(q, p.viTri, anh);
      }
      q.nhom.visible = !p.phaSan;
      const dich = q.duongDi.length ? q.duongDi[q.duongDi.length - 1] : q.oHienTai;
      if (dich !== p.viTri) this.lenDuongDi(q, dich, p.viTri, p.buocCuoi);
    }

    // xúc xắc
    if (anh.xx1 > 0 && anh.xx2 > 0) {
      if (anh.soLanTung !== this.lanTungCu) {
        // Lần gieo mới: chạy hoạt ảnh. Mọi client đều thấy vì soLanTung nằm
        // trong state, không phải hiệu ứng cục bộ của riêng người tung.
        const dau = this.lanTungCu < 0;
        this.lanTungCu = anh.soLanTung;
        if (dau) {
          // Người mới vào giữa ván thì đặt luôn mặt cuối, khỏi gieo lại một
          // lần tung đã xảy ra từ trước.
          this.datMatXucXac(this.dice[0], anh.xx1);
          this.datMatXucXac(this.dice[1], anh.xx2);
        } else {
          this.gieoXucXac(anh.xx1, anh.xx2);
        }
      } else if (this.tungT >= 1) {
        this.datMatXucXac(this.dice[0], anh.xx1);
        this.datMatXucXac(this.dice[1], anh.xx2);
      }
    }
  }

  /** Bắt đầu hoạt ảnh gieo, kết thúc đúng hai mặt server đã chốt. */
  private gieoXucXac(a: number, b: number) {
    this.tungT = 0;
    this.tungDich = [a, b];
    // Mỗi con một trục quay riêng, nếu không hai con quay y hệt nhau trông
    // như một khối.
    this.tungQuay = this.dice.map(() => ({
      x: (Math.random() * 2 - 1) * 16 + 10,
      y: (Math.random() * 2 - 1) * 16 + 10,
      z: (Math.random() * 2 - 1) * 16 + 10,
    }));
  }

  /**
   * Quân cờ: chân đế và thân như cũ, nhưng thay quả cầu trên đỉnh bằng tấm
   * biển tròn mang ảnh đại diện của người chơi.
   *
   * Tấm biển là Sprite nên luôn quay mặt về phía máy quay, nhìn từ góc nào
   * cũng thấy rõ mặt người — quả cầu cũ thì bốn quân chỉ khác nhau mỗi màu.
   */
  private taoQuan(p: { mau: number; ten: string; anh: string }): THREE.Group {
    const maCss = MAU_NGUOI_CHOI[p.mau % MAU_NGUOI_CHOI.length];
    const mau = new THREE.Color(maCss);
    const g = new THREE.Group();

    g.add(khoi(new THREE.CylinderGeometry(0.33, 0.42, 0.13, 26), Mp(mau, 0.3, 0.2, 0.85), 0, 0.065, 0));
    g.add(khoi(new THREE.CylinderGeometry(0.12, 0.26, 0.5, 22), Mp(mau, 0.3, 0.2, 0.85), 0, 0.37, 0));
    const co = khoi(new THREE.TorusGeometry(0.17, 0.035, 10, 24), Mp(0xf7f9fc, 0.18, 0.6, 0.6), 0, 0.6, 0);
    co.rotation.x = Math.PI / 2;
    g.add(co);

    const canvas = texAvatar(maCss, p.ten);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const bien = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    bien.scale.setScalar(0.92);
    bien.position.set(0, 1.08, 0);
    g.add(bien);

    if (p.anh) {
      // Ảnh Google cần crossOrigin thì canvas mới không bị nhiễm bẩn; tải
      // hỏng thì cứ để nguyên chữ cái đầu, không sao cả.
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.onload = () => {
        try {
          veAnhVaoAvatar(canvas, img, maCss);
          tex.needsUpdate = true;
        } catch { /* canvas bị nhiễm bẩn thì giữ chữ cái đầu */ }
      };
      img.src = p.anh;
    }
    return g;
  }

  private datQuanVaoO(q: Quan, i: number, anh: AnhChup) {
    const v = this.viTri[i];
    const lech = this.doLech(i, anh);
    q.nhom.position.set(v.x + Math.cos(v.ry) * lech, DAY, v.z - Math.sin(v.ry) * lech);
    q.oHienTai = i;
  }

  /** Nhiều quân cùng ô thì xoè ra cho khỏi chồng lên nhau. */
  private doLech(i: number, anh: AnhChup): number {
    const cung = anh.nguoiChoi.filter((p) => p.viTri === i && !p.phaSan);
    if (cung.length <= 1) return 0;
    return 0;
  }

  /**
   * Dựng đường đi cho quân cờ.
   *
   * Hướng lấy từ `buocCuoi` mà server gửi xuống, không tự đoán bằng đường
   * ngắn nhất. Đoán đường ngắn nhất là sai: thẻ "đi thẳng về ô Xuất phát" từ
   * ô 14 là đi tới 22 ô và được nhận lương, nhưng đường ngắn nhất lại là lùi
   * 14 ô — quân sẽ chạy ngược trong khi nhật ký báo đã qua Xuất phát.
   *
   * `buocCuoi` bằng 0 nghĩa là bị dời thẳng (vào Đảo Hoang): nhảy một nhịp
   * sang thẳng ô đích thay vì bước qua từng ô.
   */
  private lenDuongDi(q: Quan, tu: number, den: number, buocCuoi: number) {
    const buoc: number[] = [];

    if (buocCuoi === 0) {
      buoc.push(den);
    } else {
      const huong = buocCuoi > 0 ? 1 : -1;
      const soBuoc = Math.min(Math.abs(buocCuoi), SO_O);
      for (let k = 1; k <= soBuoc; k++) buoc.push(((tu + huong * k) % SO_O + SO_O) % SO_O);
      // Lệch so với vị trí server chốt (mất gói, vào lại phòng) thì chốt lại.
      if (buoc[buoc.length - 1] !== den) buoc.push(den);
    }

    q.duongDi = buoc;
    q.t = 0;
  }

  private datMatXucXac(m: THREE.Mesh, n: number) {
    const huong: [number, number, number][] = [
      [0, -Math.PI / 2, 0], [Math.PI / 2, 0, 0], [0, 0, 0],
      [0, Math.PI, 0], [-Math.PI / 2, 0, 0], [0, Math.PI / 2, 0],
    ];
    const [x, y, z] = huong[n - 1];
    m.rotation.set(x, y, z);
  }

  private veSoHuu(i: number, tt: AnhChup["o"][number], anh: AnhChup) {
    const cu = this.soHuu.get(i);
    const khoa = `${tt.chu}|${tt.nha}|${tt.theChap}|${tt.matDien > 0 ? 1 : 0}`;
    if (cu && cu.userData.khoa === khoa) return;
    if (cu) { this.world.remove(cu); this.soHuu.delete(i); }
    if (!tt.chu) return;

    const nguoi = anh.nguoiChoi.find((p) => p.sid === tt.chu);
    if (!nguoi) return;
    const o = BAN_CO[i];
    const v = this.viTri[i];
    const w = v.goc ? GOC : RONG;
    const d = v.goc ? GOC : SAU;
    const mau = new THREE.Color(MAU_NGUOI_CHOI[nguoi.mau % MAU_NGUOI_CHOI.length]);

    const g = new THREE.Group();
    g.position.set(v.x, DAY, v.z);
    g.rotation.y = v.ry;
    g.userData.khoa = khoa;

    // Thanh màu ở mép trong cho biết ô có chủ. Xám nghĩa là ô đang thế chấp
    // hoặc mất điện, tức chủ ô tạm thời không thu được tiền thuê.
    const tatTien = tt.theChap || tt.matDien > 0;
    g.add(khoi(hopBo(w - 0.4, 0.06, 0.17, 0.05, 0.022),
      Mp(tatTien ? 0x8b95a5 : mau, 0.45, 0.2, 0.5), 0, 0.016, d / 2 - 0.27));

    // Bậc công trình: 0 là mới cắm cờ, 1..3 là nhà, 4 là khách sạn.
    if (o.loai === "dat" && tt.nha >= BAC_KHACH_SAN) {
      const ks = nhaMai(1.15, 0.48, 0.8, 0xfdfdfd, mau);
      ks.position.set(0, 0, -d / 2 + 0.74);
      ks.scale.setScalar(0.92);
      g.add(ks);
    } else if (o.loai === "dat" && tt.nha > 0) {
      for (let h = 0; h < tt.nha; h++) {
        const nh = nhaMai(0.4, 0.3, 0.4, 0xfdfdfd, mau);
        nh.position.set(-((tt.nha - 1) * 0.46) / 2 + h * 0.46, 0, -d / 2 + 0.5);
        g.add(nh);
      }
    } else {
      // Ô đất mới mua và ô biển: cắm cờ cho biết đã có chủ nhưng chưa xây.
      g.add(cotCo(mau, o.loai === "bien" ? w / 2 - 0.34 : 0, -d / 2 + 0.42));
    }

    if (tt.matDien > 0) {
      // Bóng đèn tắt: khối xám nhỏ đặt cạnh cờ, nhìn là biết ô đang mất điện.
      g.add(khoi(new THREE.SphereGeometry(0.17, 10, 8), M(0x5c6472, 0.55),
        -w / 2 + 0.38, 0.22, -d / 2 + 0.42));
    }
    g.traverse((m) => { if (m instanceof THREE.Mesh) m.castShadow = true; });
    this.world.add(g);
    this.soHuu.set(i, g);
  }

  /**
   * Dây cờ lễ hội treo ở mép ngoài ô, không đè lên nhà cửa vốn nằm ở mép
   * trong. Cờ đỏ là lễ hội thường, cờ vàng là lễ hội toàn quốc; ô mang cả
   * hai thì treo hai dây chồng lên nhau ở hai độ cao khác nhau.
   */
  private veLeHoi(i: number, tt: AnhChup["o"][number]) {
    const khoa = `${tt.leHoi ? 1 : 0}${tt.leHoiToanQuoc ? 1 : 0}`;
    const cu = this.coLeHoi.get(i);
    if (cu && cu.userData.khoa === khoa) return;
    if (cu) { this.world.remove(cu); this.coLeHoi.delete(i); }
    if (khoa === "00") return;

    const v = this.viTri[i];
    const w = v.goc ? GOC : RONG;
    const d = v.goc ? GOC : SAU;

    const g = new THREE.Group();
    g.position.set(v.x, DAY, v.z);
    g.rotation.y = v.ry;
    g.userData.khoa = khoa;

    const z = -d / 2 + 0.3;
    if (tt.leHoi) g.add(dayCo(0xe0484f, w - 0.5, 0.62, z));
    if (tt.leHoiToanQuoc) g.add(dayCo(0xf4c230, w - 0.5, 1.02, z));

    g.traverse((m) => { if (m instanceof THREE.Mesh) m.castShadow = true; });
    this.world.add(g);
    this.coLeHoi.set(i, g);
  }

  /* ------------------------------------------------------------ sự kiện */

  setOnChonO(cb: (i: number) => void) { this.onChonO = cb; }

  /** Dành chỗ bên trái màn hình cho bảng giá khi màn đủ rộng. */
  datLechTrai(px: number) {
    this.lechTrai = px;
    this.khungCanCapNhat = true;
  }

  /**
   * Phóng to và kéo bàn cờ.
   *
   * Bàn cờ vẫn cố định hướng — không xoay. Đây chỉ là chuyện nhìn gần hay nhìn
   * xa, cần thiết vì ở mức vừa khít màn hình, mỗi ô chỉ rộng khoảng 50 pixel
   * nên chữ trên ô rất khó đọc.
   */
  datZoom(z: number) {
    const cu = this.zoom;
    this.zoom = Math.max(1, Math.min(3, z));
    if (this.zoom === 1) { this.panX = 0; this.panY = 0; }
    else if (cu > 0) { this.panX *= this.zoom / cu; this.panY *= this.zoom / cu; }
    this.khungCanCapNhat = true;
    this.onZoom?.(this.zoom);
  }
  phongTo() { this.datZoom(this.zoom * 1.35); }
  thuNho() { this.datZoom(this.zoom / 1.35); }
  get mucZoom() { return this.zoom; }
  setOnZoom(cb: (z: number) => void) { this.onZoom = cb; }

  private ganSuKien() {
    let dx = 0, dy = 0;
    let keo = false;
    let truocX = 0, truocY = 0;

    this.canvas.addEventListener("pointerdown", (e) => {
      dx = e.clientX; dy = e.clientY;
      truocX = e.clientX; truocY = e.clientY;
      if (this.zoom > 1) {
        keo = true;
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.style.cursor = "grabbing";
      }
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (keo) {
        this.panX += e.clientX - truocX;
        this.panY += e.clientY - truocY;
        truocX = e.clientX; truocY = e.clientY;
        this.khungCanCapNhat = true;
        return;
      }
      this.canvas.style.cursor =
        this.oDuoiChuot(e) >= 0 ? "pointer" : this.zoom > 1 ? "grab" : "default";
    });

    const thaKeo = (e: PointerEvent) => {
      if (!keo) return;
      keo = false;
      try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* đã nhả rồi */ }
      this.canvas.style.cursor = this.zoom > 1 ? "grab" : "default";
    };
    this.canvas.addEventListener("pointercancel", thaKeo);

    this.canvas.addEventListener("pointerup", (e) => {
      const daKeo = Math.abs(e.clientX - dx) + Math.abs(e.clientY - dy) > 10;
      thaKeo(e);
      if (daKeo) return;
      const i = this.oDuoiChuot(e);
      if (i >= 0) this.onChonO?.(i);
    });

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.datZoom(this.zoom * (e.deltaY > 0 ? 1 / 1.18 : 1.18));
    }, { passive: false });

    // Chụm hai ngón trên cảm ứng.
    let khoangCach0 = 0;
    let zoom0 = 1;
    const diem = new Map<number, { x: number; y: number }>();
    this.canvas.addEventListener("pointerdown", (e) => {
      diem.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (diem.size === 2) {
        const [a, b] = [...diem.values()];
        khoangCach0 = Math.hypot(a.x - b.x, a.y - b.y);
        zoom0 = this.zoom;
        keo = false;
      }
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!diem.has(e.pointerId)) return;
      diem.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (diem.size === 2 && khoangCach0 > 0) {
        const [a, b] = [...diem.values()];
        this.datZoom((zoom0 * Math.hypot(a.x - b.x, a.y - b.y)) / khoangCach0);
      }
    });
    const boDiem = (e: PointerEvent) => { diem.delete(e.pointerId); if (diem.size < 2) khoangCach0 = 0; };
    this.canvas.addEventListener("pointerup", boDiem);
    this.canvas.addEventListener("pointercancel", boDiem);
  }

  private oDuoiChuot(e: PointerEvent): number {
    const r = this.canvas.getBoundingClientRect();
    this.chuot.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.chuot.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.raycaster.setFromCamera(this.chuot, this.camera);
    const hit = this.raycaster.intersectObjects(this.oMeshes, false);
    return hit.length ? (hit[0].object.userData.index as number) : -1;
  }

  private dongKhung() {
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    if (W === 0 || H === 0) return;
    this.renderer.setSize(W, H, false);
    this.composer.setSize(W, H);

    /**
     * Khung vừa khít chỉ tính tới mặt bàn cờ và các công trình trên viền.
     * Phần chân đảo và đám mây phía dưới được phép tràn ra ngoài màn hình —
     * nếu tính cả chúng, chiều cao bị thổi lên và bàn cờ co lại thấy rõ.
     */
    const R = BIA + 0.6;
    const pts: THREE.Vector3[] = [];
    for (const x of [-R, R]) for (const z of [-R, R]) for (const y of [-1.4, 3.0]) pts.push(new THREE.Vector3(x, y, z));

    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
    let halfW = 0, halfH = 0;
    const v = new THREE.Vector3();
    for (const p of pts) {
      v.copy(p).applyMatrix4(this.camera.matrixWorldInverse);
      halfW = Math.max(halfW, Math.abs(v.x));
      halfH = Math.max(halfH, Math.abs(v.y));
    }

    // Lề nhỏ thôi: bàn cờ là hình thoi nên bốn góc màn hình vốn đã trống,
    // đó cũng là chỗ đặt thanh người chơi.
    const padX = 6, padY = 10;

    /**
     * Hộp bao tám đỉnh ở trên rộng hơn bóng thật của bàn cờ: bốn đỉnh hộp
     * chiếu ra ngoài hình thoi, nên nếu vừa khít theo hộp thì bàn cờ nhỏ hơn
     * hẳn so với khung. Nhân thêm một hệ số để hình thoi chạm sát mép màn
     * hình; phần tràn ra chỉ là trời ở bốn góc.
     */
    const KHIT = 1.16;
    const usableW = Math.max(220, W - padX * 2 - this.lechTrai);
    const usableH = Math.max(220, H - padY * 2);
    const vuaKhit = Math.min(usableW / (halfW * 2), usableH / (halfH * 2));
    const scale = vuaKhit * KHIT * this.zoom;

    // Giới hạn kéo để bàn cờ không bị lôi ra khỏi màn hình.
    const toiDaX = Math.max(0, halfW * scale - usableW / 2);
    const toiDaY = Math.max(0, halfH * scale - usableH / 2);
    this.panX = Math.max(-toiDaX, Math.min(toiDaX, this.panX));
    this.panY = Math.max(-toiDaY, Math.min(toiDaY, this.panY));

    const viewW = W / scale / 2;
    const viewH = H / scale / 2;
    const lech = this.lechTrai / 2 / scale + this.panX / scale;
    const lechDoc = this.panY / scale;

    this.camera.left = -viewW - lech;
    this.camera.right = viewW - lech;
    this.camera.top = viewH + lechDoc;
    this.camera.bottom = -viewH + lechDoc;
    this.camera.updateProjectionMatrix();
  }

  /* -------------------------------------------------------- vòng lặp vẽ */

  private ve = () => {
    if (this.huy) return;
    requestAnimationFrame(this.ve);

    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    if (this.khungCanCapNhat || W !== this.canvas.width / this.renderer.getPixelRatio()) {
      this.khungCanCapNhat = false;
      this.dongKhung();
    }

    this.dong += 0.016;
    this.world.position.y = Math.sin(this.dong * 0.55) * 0.1;
    for (const g of this.cocTien) {
      g.position.y = g.userData.y0 + Math.sin(this.dong * 0.7 + g.userData.ph) * 0.22;
      g.rotation.y += 0.0015;
    }
    for (const s of this.may) {
      const u = s.userData;
      u.a += u.sp;
      s.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(this.dong * 0.35 + u.ph) * 0.35, Math.sin(u.a) * u.r);
    }

    // xúc xắc đang gieo: quay nhanh rồi chậm dần, nảy hai nhịp rồi nằm im
    if (this.tungT < 1) {
      this.tungT = Math.min(1, this.tungT + 0.022);
      const t = this.tungT;
      const cham = (1 - t) ** 1.6;
      this.dice.forEach((m, i) => {
        const q = this.tungQuay[i];
        if (q) {
          m.rotation.x += q.x * 0.016 * cham;
          m.rotation.y += q.y * 0.016 * cham;
          m.rotation.z += q.z * 0.016 * cham;
        }
        const nay = Math.abs(Math.sin(t * Math.PI * 2.3)) * (1 - t) * 2.6;
        m.position.y = (this.diceY[i] ?? 0.72) + nay;
      });
      if (this.tungT >= 1) {
        // Chốt đúng mặt mà server đã gieo.
        this.datMatXucXac(this.dice[0], this.tungDich[0]);
        this.datMatXucXac(this.dice[1], this.tungDich[1]);
        this.dice.forEach((m, i) => { m.position.y = this.diceY[i] ?? 0.72; });
      }
    }

    // quân cờ nhảy từng ô một
    for (const q of this.quan.values()) {
      if (q.duongDi.length === 0) continue;
      q.t += 0.075;
      const tu = this.viTri[q.oHienTai];
      const den = this.viTri[q.duongDi[0]];
      const t = Math.min(1, q.t);
      q.nhom.position.x = tu.x + (den.x - tu.x) * t;
      q.nhom.position.z = tu.z + (den.z - tu.z) * t;
      q.nhom.position.y = DAY + Math.sin(t * Math.PI) * 0.8;
      if (t >= 1) {
        q.oHienTai = q.duongDi.shift()!;
        q.t = 0;
      }
    }

    this.composer.render();
  };

  dispose() {
    this.huy = true;
    this.envRT?.dispose();
    this.pmrem.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

/** Danh sách ô, để HUD dựng bảng giá mà không phải nhập lại dữ liệu. */
export { BAN_CO };
