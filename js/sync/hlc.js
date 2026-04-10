// Hybrid Logical Clock - Versioning monótono con tolerancia a skew
window.HLC = {
  local: { physical: Date.now(), logical: 0 },

  now() {
    const physical = Date.now();
    if (physical > this.local.physical) {
      this.local = { physical, logical: 0 };
    } else {
      this.local.logical++;
    }
    return { ...this.local };
  },

  receive(remote) {
    const local = this.now();
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
