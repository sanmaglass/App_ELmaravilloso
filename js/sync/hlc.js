// Hybrid Logical Clock - Versioning monótono con tolerancia a skew
window.HLC = {
  local: { physical: Date.now(), logical: 0 },
  MAX_SKEW_MS: 120000, // 2 minutos máximo de desfase tolerable

  now() {
    const physical = Date.now();
    if (physical > this.local.physical) {
      this.local = { physical, logical: 0 };
    } else {
      this.local.logical++;
      if (this.local.logical > 999999) {
        console.warn('⚠️ HLC logical overflow — forzando reset al reloj del sistema');
        this.local = { physical, logical: 0 };
      }
    }
    return { ...this.local };
  },

  receive(remote) {
    const local = this.now();
    const skew = Math.abs(remote.physical - local.physical);
    if (skew > this.MAX_SKEW_MS) {
      console.warn(`⚠️ HLC: skew de ${skew}ms excede límite (${this.MAX_SKEW_MS}ms), ignorando remote`);
      return { ...this.local };
    }
    if (remote.physical > local.physical) {
      this.local = { physical: remote.physical, logical: remote.logical + 1 };
    } else if (remote.physical === local.physical && remote.logical >= local.logical) {
      this.local.logical = remote.logical + 1;
    }
    return { ...this.local };
  },

  encode({ physical, logical }) {
    return physical * 1000000 + logical;
  },

  decode(encoded) {
    return {
      physical: Math.floor(encoded / 1000000),
      logical: encoded % 1000000
    };
  },

  compare(hlc1, hlc2) {
    if (hlc1.physical !== hlc2.physical) return hlc1.physical > hlc2.physical ? 1 : -1;
    return hlc1.logical > hlc2.logical ? 1 : (hlc1.logical < hlc2.logical ? -1 : 0);
  }
};
