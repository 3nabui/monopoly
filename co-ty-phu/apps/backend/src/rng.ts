import { randomInt } from "node:crypto";

/**
 * Xúc xắc chỉ được gieo ở đây, trên server, bằng nguồn ngẫu nhiên mã hoá.
 *
 * Không bao giờ để client tự gieo rồi gửi kết quả lên: chỉ cần mở công cụ
 * nhà phát triển là họ gửi được "tôi vừa tung đôi sáu".
 */
export function gieoXucXac(): [number, number] {
  return [randomInt(1, 7), randomInt(1, 7)];
}

/** Trộn mảng tại chỗ theo thuật toán Fisher–Yates. */
export function tron<T>(mang: T[]): T[] {
  for (let i = mang.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [mang[i], mang[j]] = [mang[j], mang[i]];
  }
  return mang;
}
