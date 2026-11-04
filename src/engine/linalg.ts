// Yoğun (dense) doğrusal sistem çözücü: kısmi pivotlamalı Gauss eliminasyonu.
// Devre boyutları (≤ ~100 bilinmeyen) için yeterince hızlıdır ve harici bağımlılık gerektirmez.

export class SingularMatrixError extends Error {
  constructor(public row: number) {
    super(`Tekil matris (satır ${row})`);
  }
}

/**
 * A·x = b çözer. A (n×n, satır-öncelikli) ve b yerinde değiştirilir; sonuç x'e yazılır.
 */
export function solveDense(A: Float64Array, b: Float64Array, n: number, x: Float64Array): void {
  for (let k = 0; k < n; k++) {
    // Pivot seçimi
    let piv = k;
    let max = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(A[i * n + k]);
      if (v > max) {
        max = v;
        piv = i;
      }
    }
    if (max < 1e-15) throw new SingularMatrixError(k);
    if (piv !== k) {
      for (let j = k; j < n; j++) {
        const t = A[k * n + j];
        A[k * n + j] = A[piv * n + j];
        A[piv * n + j] = t;
      }
      const t = b[k];
      b[k] = b[piv];
      b[piv] = t;
    }
    const akk = A[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const f = A[i * n + k] / akk;
      if (f === 0) continue;
      A[i * n + k] = 0;
      for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      b[i] -= f * b[k];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i * n + j] * x[j];
    x[i] = s / A[i * n + i];
  }
}
