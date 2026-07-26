const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/love-wall.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db = null;

function createDbWrapper(sqlDb) {
  return {
    _db: sqlDb,
    prepare(sql) {
      return {
        run(...params) { try { sqlDb.run(sql, params); saveDb(); } catch (e) { console.error('DB run:', e.message); } },
        get(...params) {
          try {
            const stmt = sqlDb.prepare(sql);
            if (params.length > 0) stmt.bind(params);
            if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
            stmt.free(); return undefined;
          } catch (e) { return undefined; }
        },
        all(...params) {
          try {
            const results = []; const stmt = sqlDb.prepare(sql);
            if (params.length > 0) stmt.bind(params);
            while (stmt.step()) results.push(stmt.getAsObject());
            stmt.free(); return results;
          } catch (e) { return []; }
        }
      };
    },
    exec(sql) { try { sqlDb.run(sql); saveDb(); } catch (e) { console.error('DB exec:', e.message); } }
  };
}

function saveDb() {
  if (!db) return;
  try { const data = db._db.export(); fs.writeFileSync(dbPath, Buffer.from(data)); } catch (e) {}
}

async function initDatabase() {
  const SQL = await initSqlJs();
  let sqlDb;
  if (fs.existsSync(dbPath)) { sqlDb = new SQL.Database(fs.readFileSync(dbPath)); }
  else { sqlDb = new SQL.Database(); }
  db = createDbWrapper(sqlDb);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,nickname TEXT NOT NULL,avatar TEXT DEFAULT '/img/loge.png',bio TEXT DEFAULT '',role TEXT DEFAULT 'user',status TEXT DEFAULT 'active',created_at TEXT DEFAULT (datetime('now')),last_login TEXT);
    CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,images TEXT DEFAULT '[]',likes INTEGER DEFAULT 0,comments_count INTEGER DEFAULT 0,views INTEGER DEFAULT 0,status TEXT DEFAULT 'published',is_anonymous INTEGER DEFAULT 0,tags TEXT DEFAULT '[]',category TEXT DEFAULT 'confession',created_at TEXT DEFAULT (datetime('now')),updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY,post_id TEXT NOT NULL,user_id TEXT NOT NULL,content TEXT NOT NULL,likes INTEGER DEFAULT 0,status TEXT DEFAULT 'published',created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS likes (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,target_id TEXT NOT NULL,target_type TEXT NOT NULL,created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY,sender_id TEXT NOT NULL,receiver_id TEXT NOT NULL,content TEXT NOT NULL,type TEXT DEFAULT 'text',is_read INTEGER DEFAULT 0,conversation_id TEXT,created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY,user1_id TEXT NOT NULL,user2_id TEXT NOT NULL,last_message TEXT,last_message_at TEXT,created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY,reporter_id TEXT NOT NULL,target_id TEXT NOT NULL,target_type TEXT NOT NULL,reason TEXT NOT NULL,status TEXT DEFAULT 'pending',created_at TEXT DEFAULT (datetime('now')),resolved_at TEXT);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,type TEXT DEFAULT 'info',is_pinned INTEGER DEFAULT 0,show_popup INTEGER DEFAULT 0,status TEXT DEFAULT 'published',created_at TEXT DEFAULT (datetime('now')),updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS bookmarks (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,post_id TEXT NOT NULL,created_at TEXT DEFAULT (datetime('now')),UNIQUE(user_id,post_id));
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,type TEXT NOT NULL,content TEXT,from_user_id TEXT,post_id TEXT,is_read INTEGER DEFAULT 0,created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS reactions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,target_id TEXT NOT NULL,target_type TEXT NOT NULL,emoji TEXT NOT NULL,created_at TEXT DEFAULT (datetime('now')),UNIQUE(user_id,target_id,target_type,emoji));
    CREATE TABLE IF NOT EXISTS banned_ips (id TEXT PRIMARY KEY,ip TEXT NOT NULL UNIQUE,reason TEXT,banned_by TEXT,created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS visit_stats (id INTEGER PRIMARY KEY AUTOINCREMENT,date TEXT NOT NULL UNIQUE,page_views INTEGER DEFAULT 0,unique_visitors INTEGER DEFAULT 0,posts_created INTEGER DEFAULT 0,comments_created INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT,content TEXT,tags TEXT,category TEXT DEFAULT 'confession',is_anonymous INTEGER DEFAULT 0,created_at TEXT DEFAULT (datetime('now')),updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS sensitive_words (id TEXT PRIMARY KEY,word TEXT NOT NULL UNIQUE,replacement TEXT DEFAULT '***',created_at TEXT DEFAULT (datetime('now')));
  `);

  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'super_admin'").get();
  if (!adminExists) {
    db.prepare("INSERT INTO users (id,username,password,nickname,role,status) VALUES (?,?,?,?,?,?)").run(uuidv4(),'admin',bcrypt.hashSync('admin123',10),'超级管理员','super_admin','active');
    console.log('默认管理员: admin / admin123');
  }

  const defaults = {siteName:'樱花表白墙',siteDescription:'勇敢说出你的故事',maintenanceMode:'false',maintenanceTitle:'网站维护中',maintenanceMessage:'我们正在进行系统升级，预计很快恢复。',maintenanceBgColor:'#ffdee9',maintenanceIcon:'🌸',maintenanceCountdown:'',maintenanceContact:'',maintenanceCustomCss:'',maintenanceCustomHtml:'',allowRegister:'true',allowAnonymous:'true',postReview:'false',maxImagesPerPost:'9',splashEnabled:'false',splashIcon:'🌸',splashTitle:'樱花表白墙',splashDesc:'勇敢说出你的故事',splashBg:'linear-gradient(135deg,#ffdee9,#b5fffc)',siteLogo:'/img/loge.png',enableReactions:'true',enableBookmarks:'true',enableNotifications:'true',sensitiveWords:'色情,赌博,毒品,暴力,诈骗',replaceSensitiveWords:'true'};
  for (const [k,v] of Object.entries(defaults)) {
    if (!db.prepare("SELECT key FROM settings WHERE key=?").get(k)) db.prepare("INSERT INTO settings (key,value) VALUES (?,?)").run(k,v);
  }
  saveDb();
  console.log('数据库就绪');
  return db;
}

function getDb() { return db; }
module.exports = { initDatabase, getDb, saveDb };
