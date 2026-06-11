// Device ID Management - UUID v4 estable por dispositivo
window.DeviceId = {
  key: 'wm_device_id',

  get() {
    let id = localStorage.getItem(this.key);
    if (!id) {
      id = this.uuid4();
      localStorage.setItem(this.key, id);
      console.log(`🆔 Device ID generado: ${id}`);
    }
    return id;
  },

  uuid4() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    // fallback con valores criptográficamente seguros
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    return [...buf].map((b, i) =>
      ([4,6,8,10].includes(i) ? '-' : '') + b.toString(16).padStart(2,'0')
    ).join('');
  }
};
