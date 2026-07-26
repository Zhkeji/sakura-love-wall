const { getDb } = require('./database');
let cache = {}, cacheTime = 0;
function loadSettings() {
  const now = Date.now();
  if (now - cacheTime < 5000 && Object.keys(cache).length > 0) return cache;
  const db = getDb(); if (!db) return cache;
  for (const r of db.prepare('SELECT key,value FROM settings').all()) cache[r.key] = r.value;
  cacheTime = now; return cache;
}
function getSetting(k) { return loadSettings()[k]; }
function setSetting(k, v) { getDb().prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,datetime('now'))").run(k,String(v)); cache[k]=String(v); }
function setSettings(obj) { for (const [k,v] of Object.entries(obj)) setSetting(k,v); }
module.exports = { loadSettings, getSetting, setSetting, setSettings };
