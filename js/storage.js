// storage.js
//
// This is the ONLY file in the app that talks to localStorage directly.
// Every method returns a Promise, even though localStorage is synchronous —
// on purpose. When Stage 4 replaces local storage with real fetch() calls to
// the Cloudflare DB, only the bodies of these functions change. Every view
// that calls `storage.getCourses()` etc. keeps working unmodified, because
// it already awaits a Promise today.

import { SCHEMA_VERSION, makeBag } from './models.js';

const KEYS = {
  player: 'golf.player',
  courses: 'golf.courses',
  rounds: 'golf.rounds',
  bags: 'golf.bags',
  theme: 'golf.theme',
  design: 'golf.design', // 'standard' | 'm3' | 'glass' — manual choice, used when designAuto is false
  designAuto: 'golf.designAuto', // true = follow the device's OS family automatically
  palette: 'golf.palette', // { id: 'fairway'|'ocean'|'sunset'|'slate'|'custom', primary, secondary, tertiary }
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Failed to read ${key} from storage`, err);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to write ${key} to storage`, err);
  }
}

export const storage = {
  // --- player (local profile, pre-accounts) ---
  async getPlayer() {
    return read(KEYS.player, null);
  },
  async savePlayer(player) {
    write(KEYS.player, player);
    return player;
  },

  // --- courses ---
  async getCourses() {
    return read(KEYS.courses, []);
  },
  async getCourse(id) {
    return read(KEYS.courses, []).find((c) => c.id === id) || null;
  },
  async saveCourse(course) {
    const courses = read(KEYS.courses, []);
    const idx = courses.findIndex((c) => c.id === course.id);
    course.updatedAt = new Date().toISOString();
    if (idx >= 0) courses[idx] = course;
    else courses.push(course);
    write(KEYS.courses, courses);
    return course;
  },
  async deleteCourse(id) {
    write(KEYS.courses, read(KEYS.courses, []).filter((c) => c.id !== id));
  },

  // --- rounds ---
  async getRounds() {
    return read(KEYS.rounds, []);
  },
  async getRound(id) {
    return read(KEYS.rounds, []).find((r) => r.id === id) || null;
  },
  async saveRound(round) {
    const rounds = read(KEYS.rounds, []);
    const idx = rounds.findIndex((r) => r.id === round.id);
    if (idx >= 0) rounds[idx] = round;
    else rounds.push(round);
    write(KEYS.rounds, rounds);
    return round;
  },
  async deleteRound(id) {
    write(KEYS.rounds, read(KEYS.rounds, []).filter((r) => r.id !== id));
  },

  // --- bags (clubs) ---
  // Lazily seeded: the very first read ever creates one default bag (a
  // standard club set) rather than requiring some separate "first run"
  // setup step. Every read after that just returns what's actually saved.
  async getBags() {
    const bags = read(KEYS.bags, []);
    if (bags.length) return bags;
    const seeded = [makeBag()];
    write(KEYS.bags, seeded);
    return seeded;
  },
  async getBag(id) {
    return (await this.getBags()).find((b) => b.id === id) || null;
  },
  async saveBag(bag) {
    const bags = read(KEYS.bags, []);
    const idx = bags.findIndex((b) => b.id === bag.id);
    bag.updatedAt = new Date().toISOString();
    if (idx >= 0) bags[idx] = bag;
    else bags.push(bag);
    write(KEYS.bags, bags);
    return bag;
  },
  async deleteBag(id) {
    const remaining = read(KEYS.bags, []).filter((b) => b.id !== id);
    // Never leave zero bags — the club picker and "which bag?" round-start
    // step both assume at least one exists. Deleting down to the last one
    // just isn't offered in the UI (see views/bags.js), this is a second,
    // deeper backstop against ending up with none.
    write(KEYS.bags, remaining.length ? remaining : [makeBag()]);
  },

  // --- theme preference (light/dark) ---
  async getThemePreference() {
    return read(KEYS.theme, null); // null = follow system setting
  },
  async saveThemePreference(mode) {
    write(KEYS.theme, mode);
  },

  // --- design language (Standard / Material 3 / Liquid Glass) ---
  async getDesignPreference() {
    return read(KEYS.design, 'standard'); // last manually-picked value (used when auto is off)
  },
  async saveDesignPreference(design) {
    write(KEYS.design, design);
  },
  async getDesignAuto() {
    return read(KEYS.designAuto, true); // default: match the device automatically
  },
  async saveDesignAuto(auto) {
    write(KEYS.designAuto, auto);
  },

  // --- color palette ---
  async getPalette() {
    return read(KEYS.palette, null); // null = default Fairway palette
  },
  async savePalette(palette) {
    write(KEYS.palette, palette);
  },

  // --- utility ---
  async clearAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
  async exportAll() {
    const [player, courses, rounds, bags] = await Promise.all([read(KEYS.player, null), read(KEYS.courses, []), read(KEYS.rounds, []), read(KEYS.bags, [])]);
    return { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), player, courses, rounds, bags };
  },
  // Full replace, not a merge — restoring a backup means "make this device
  // match the file," not "combine the two." Only touches keys actually
  // present (and shaped as expected) in the imported data, so a partial or
  // hand-edited export doesn't wipe fields it never mentioned.
  async importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Not a valid export file.');
    if (!Array.isArray(data.courses) && !Array.isArray(data.rounds) && !Array.isArray(data.bags) && !data.player) {
      throw new Error("This doesn't look like a Fairway export file.");
    }
    if (Array.isArray(data.courses)) write(KEYS.courses, data.courses);
    if (Array.isArray(data.rounds)) write(KEYS.rounds, data.rounds);
    if (Array.isArray(data.bags)) write(KEYS.bags, data.bags);
    if (data.player) write(KEYS.player, data.player);
  },
};
