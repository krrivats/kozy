// LocalAdapter — keeps everything in this browser's localStorage (one JSON blob).
// Data is small (a few thousand rows a year), so saving the whole blob on each write is fine.
import { LOCAL_USER, LOCAL_PREVIEW_USERS, GUEST } from '../config.js';

// A guest keeps a separate copy, so it never mixes with anyone's real data on this device.
const KEY = GUEST ? 'kozy.guest.v1' : 'kozy.data.v1';

export class LocalAdapter {
  name = 'local';
  needsAuth = false;

  async init() {
    this.data = this.#read();
    // ?role=member / ?role=viewer previews the other views on this laptop.
    const preview = LOCAL_PREVIEW_USERS[new URLSearchParams(location.search).get('role')] || null;
    this.user = GUEST ? { label: 'Guest', role: 'owner' } : (preview || LOCAL_USER);
    this.preview = !!preview;
    this.guest = GUEST;
  }

  userLabel() { return this.user.label; }

  role() { return this.user.role; }

  userEmail() { return ''; }

  async load() {
    return this.data;
  }

  async write(col, doc) {
    const arr = this.data[col] || (this.data[col] = []);
    const i = arr.findIndex((d) => d.id === doc.id);
    if (i >= 0) arr[i] = doc; else arr.push(doc);
    this.#save();
  }

  async delete(col, id) {
    this.data[col] = (this.data[col] || []).filter((d) => d.id !== id);
    this.#save();
  }

  async replaceAll(data) {
    this.data = structuredClone(data);
    this.#save();
  }

  #read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('Kozy: could not read local data', e);
      return {};
    }
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Kozy: could not save local data', e);
      alert('Could not save on this device (storage full?). Export a backup from Settings.');
    }
  }
}
