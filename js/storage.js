// storage.js
//
// This is the ONLY file in the app that talks to localStorage directly.
// Every method returns a Promise, even though localStorage is synchronous —
// on purpose. When Stage 4 replaces local storage with real fetch() calls to
// the Cloudflare DB, only the bodies of these functions change. Every view
// that calls `storage.getCourses()` etc. keeps working unmodified, because
// it already awaits a Promise today.

const KEYS = {
  player: 'golf.player',
  courses: 'golf.courses',
  rounds: 'golf.rounds',
  theme: 'golf.theme',
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

  // --- theme preference ---
  async getThemePreference() {
    return read(KEYS.theme, null); // null = follow system setting
  },
  async saveThemePreference(mode) {
    write(KEYS.theme, mode);
  },

  // --- utility ---
  async clearAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
