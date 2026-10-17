// LocalAdapter — keeps everything in this browser's localStorage (one JSON blob).
// Data is small (a few thousand rows a year), so saving the whole blob on each write is fine.
import { LOCAL_USER } from '../config.js';

const KEY = 'kozy.data.v1';

export class LocalAdapter {
  name = 'local';
  needsAuth = false;

  async init() {
    this.data = this.#read();
  }

  userLabel() { return LOCAL_USER; }

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
