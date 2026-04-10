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
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
};
