const express=require('express'),bcrypt=require('bcryptjs'),{v4:uuidv4}=require('uuid'),{getDb}=require('../database'),{authenticate,requireAdmin,requireSuperAdmin}=require('../middleware/auth'),{loadSettings,setSettings}=require('../settings');
const r=express.Router();r.use(authenticate,requireAdmin);
r.get('/stats',(req,res)=>{try{const db=getDb();res.json({stats:{totalUsers:db.prepare('SELECT COUNT(*) as c FROM users').get().c,totalPosts:db.prepare("SELECT COUNT(*) as c FROM posts WHERE status!='deleted'").get().c,totalComments:db.prepare("SELECT COUNT(*) as c FROM comments WHERE status!='deleted'").get().c,todayPosts:db.prepare("SELECT COUNT(*) as c FROM posts WHERE date(created_at)=date('now')").get().c,todayUsers:db.prepare("SELECT COUNT(*) as c FROM users WHERE date(created_at)=date('now')").get().c,pendingReview:db.prepare("SELECT COUNT(*) as c FROM posts WHERE status='pending'").get().c,pendingReports:db.prepare("SELECT COUNT(*) as c FROM reports WHERE status='pending'").get().c},recentPosts:db.prepare("SELECT p.id,p.title,p.created_at,p.status,u.nickname FROM posts p LEFT JOIN users u ON p.user_id=u.id ORDER BY p.created_at DESC LIMIT 10").all()});}catch(e){res.status(500).json({error:'获取失败'});}});
r.get('/users',(req,res)=>{try{const db=getDb(),page=parseInt(req.query.page)||1,limit=Math.min(parseInt(req.query.limit)||20,100),offset=(page-1)*limit,search=req.query.search,role=req.query.role,status=req.query.status;let w='WHERE 1=1',p=[];if(search){w+=' AND (username LIKE ? OR nickname LIKE ?)';p.push(`%${search}%`,`%${search}%`);}if(role){w+=' AND role=?';p.push(role);}if(status){w+=' AND status=?';p.push(status);}const total=db.prepare(`SELECT COUNT(*) as c FROM users ${w}`).get(...p).c;res.json({users:db.prepare(`SELECT id,username,nickname,avatar,role,status,created_at,last_login FROM users ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...p,limit,offset),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});}catch(e){res.status(500).json({error:'获取失败'});}});
r.post('/users/admin',requireSuperAdmin,(req,res)=>{try{const db=getDb(),{username,password,nickname}=req.body;if(!username||!password||!nickname)return res.status(400).json({error:'请填写完整'});if(db.prepare('SELECT id FROM users WHERE username=?').get(username))return res.status(400).json({error:'用户名已存在'});const id=uuidv4();db.prepare("INSERT INTO users (id,username,password,nickname,role,status) VALUES (?,?,?,?,'admin','active')").run(id,username,bcrypt.hashSync(password,10),nickname);res.json({message:'管理员已添加',user:{id,username,nickname,role:'admin'}});}catch(e){res.status(500).json({error:'添加失败'});}});
r.put('/users/:id/role',requireSuperAdmin,(req,res)=>{try{const{role}=req.body;if(!['user','admin','super_admin'].includes(role))return res.status(400).json({error:'无效角色'});if(req.params.id===req.user.id)return res.status(400).json({error:'不能改自己'});getDb().prepare('UPDATE users SET role=? WHERE id=?').run(role,req.params.id);res.json({message:'已更新'});}catch(e){res.status(500).json({error:'失败'});}});
r.put('/users/:id/status',(req,res)=>{try{const db=getDb(),{status}=req.body;if(!['active','banned'].includes(status))return res.status(400).json({error:'无效状态'});if(req.params.id===req.user.id)return res.status(400).json({error:'不能封禁自己'});const t=db.prepare('SELECT role FROM users WHERE id=?').get(req.params.id);if(t?.role==='super_admin'&&req.user.role!=='super_admin')return res.status(403).json({error:'无权操作'});db.prepare('UPDATE users SET status=? WHERE id=?').run(status,req.params.id);res.json({message:status==='banned'?'已封禁':'已解封'});}catch(e){res.status(500).json({error:'失败'});}});
r.delete('/users/:id',requireSuperAdmin,(req,res)=>{try{const db=getDb();if(req.params.id===req.user.id)return res.status(400).json({error:'不能删自己'});const t=db.prepare('SELECT role FROM users WHERE id=?').get(req.params.id);if(t?.role==='super_admin')return res.status(400).json({error:'不能删超管'});db.prepare("UPDATE posts SET status='deleted' WHERE user_id=?").run(req.params.id);db.prepare("UPDATE comments SET status='deleted' WHERE user_id=?").run(req.params.id);db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);res.json({message:'已删除'});}catch(e){res.status(500).json({error:'失败'});}});
r.get('/posts',(req,res)=>{try{const db=getDb(),page=parseInt(req.query.page)||1,limit=Math.min(parseInt(req.query.limit)||20,100),offset=(page-1)*limit,status=req.query.status,search=req.query.search;let w="WHERE p.status!='deleted'",p=[];if(status){w+=' AND p.status=?';p.push(status);}if(search){w+=' AND (p.title LIKE ? OR p.content LIKE ?)';p.push(`%${search}%`,`%${search}%`);}const total=db.prepare(`SELECT COUNT(*) as c FROM posts p ${w}`).get(...p).c;res.json({posts:db.prepare(`SELECT p.*,u.nickname as author_name,u.username as author_username FROM posts p LEFT JOIN users u ON p.user_id=u.id ${w} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(...p,limit,offset),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});}catch(e){res.status(500).json({error:'失败'});}});
r.put('/posts/:id/status',(req,res)=>{try{const{status}=req.body;if(!['published','hidden','pending','deleted'].includes(status))return res.status(400).json({error:'无效'});getDb().prepare('UPDATE posts SET status=? WHERE id=?').run(status,req.params.id);res.json({message:'已更新'});}catch(e){res.status(500).json({error:'失败'});}});
r.delete('/posts/:id',(req,res)=>{try{getDb().prepare("UPDATE posts SET status='deleted' WHERE id=?").run(req.params.id);res.json({message:'已删除'});}catch(e){res.status(500).json({error:'失败'});}});
r.get('/comments',(req,res)=>{try{const db=getDb(),page=parseInt(req.query.page)||1,limit=Math.min(parseInt(req.query.limit)||20,100),offset=(page-1)*limit;const total=db.prepare("SELECT COUNT(*) as c FROM comments WHERE status!='deleted'").get().c;res.json({comments:db.prepare("SELECT c.*,u.nickname as author_name,p.title as post_title FROM comments c LEFT JOIN users u ON c.user_id=u.id LEFT JOIN posts p ON c.post_id=p.id WHERE c.status!='deleted' ORDER BY c.created_at DESC LIMIT ? OFFSET ?").all(limit,offset),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});}catch(e){res.status(500).json({error:'失败'});}});
r.delete('/comments/:id',(req,res)=>{try{const db=getDb();db.prepare("UPDATE comments SET status='deleted' WHERE id=?").run(req.params.id);db.prepare('UPDATE posts SET comments_count=MAX(0,comments_count-1) WHERE id=(SELECT post_id FROM comments WHERE id=?)').run(req.params.id);res.json({message:'已删除'});}catch(e){res.status(500).json({error:'失败'});}});
r.get('/reports',(req,res)=>{try{const db=getDb(),page=parseInt(req.query.page)||1,limit=parseInt(req.query.limit)||20,offset=(page-1)*limit;const total=db.prepare("SELECT COUNT(*) as c FROM reports WHERE status='pending'").get().c;res.json({reports:db.prepare("SELECT r.*,u.nickname as reporter_name FROM reports r LEFT JOIN users u ON r.reporter_id=u.id WHERE r.status='pending' ORDER BY r.created_at DESC LIMIT ? OFFSET ?").all(limit,offset),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});}catch(e){res.status(500).json({error:'失败'});}});
r.put('/reports/:id',(req,res)=>{try{const{status}=req.body;if(!['resolved','dismissed'].includes(status))return res.status(400).json({error:'无效'});getDb().prepare("UPDATE reports SET status=?,resolved_at=datetime('now') WHERE id=?").run(status,req.params.id);res.json({message:'已处理'});}catch(e){res.status(500).json({error:'失败'});}});
r.get('/settings',(req,res)=>{try{res.json({settings:loadSettings()});}catch(e){res.status(500).json({error:'失败'});}});
r.put('/settings',(req,res)=>{try{const allowed=['siteName','siteDescription','allowRegister','allowAnonymous','postReview','maxImagesPerPost','splashEnabled','splashIcon','splashTitle','splashDesc','splashBg','siteLogo','enableReactions','enableBookmarks','enableNotifications','sensitiveWords','replaceSensitiveWords'];const f={};for(const[k,v] of Object.entries(req.body))if(allowed.includes(k))f[k]=v;if(Object.keys(f).length)setSettings(f);res.json({message:'已保存'});}catch(e){res.status(500).json({error:'失败'});}});

// === 帖子置顶 ===
r.put('/posts/:id/pin',requireSuperAdmin,(req,res)=>{try{const db=getDb();const{pinned}=req.body;db.prepare('UPDATE posts SET is_pinned=? WHERE id=?').run(pinned?1:0,req.params.id);res.json({message:pinned?'已置顶':'已取消置顶'});}catch(e){res.status(500).json({error:'失败'});}});

// === 数据导出 ===
r.get('/export/posts',requireAdmin,(req,res)=>{try{const db=getDb();const posts=db.prepare("SELECT p.id,p.title,p.content,p.likes,p.comments_count,p.views,p.status,p.created_at,u.nickname as author FROM posts p LEFT JOIN users u ON p.user_id=u.id WHERE p.status!='deleted' ORDER BY p.created_at DESC").all();let csv='ID,标题,内容,作者,点赞,评论,浏览,状态,时间\n';posts.forEach(p=>{csv+=`"${p.id}","${(p.title||'').replace(/"/g,'""')}","${(p.content||'').replace(/"/g,'""').substring(0,200)}","${p.author}",${p.likes},${p.comments_count},${p.views},"${p.status}","${p.created_at}"\n`;});res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=posts_export.csv');res.send('\uFEFF'+csv);}catch(e){res.status(500).json({error:'导出失败'});}});

r.get('/export/users',requireSuperAdmin,(req,res)=>{try{const db=getDb();const users=db.prepare('SELECT id,username,nickname,role,status,created_at,last_login FROM users ORDER BY created_at DESC').all();let csv='ID,用户名,昵称,角色,状态,注册时间,最后登录\n';users.forEach(u=>{csv+=`"${u.id}","${u.username}","${u.nickname}","${u.role}","${u.status}","${u.created_at}","${u.last_login||''}"\n`;});res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=users_export.csv');res.send('\uFEFF'+csv);}catch(e){res.status(500).json({error:'导出失败'});}});

// === IP封禁 ===
r.get('/banned-ips',requireAdmin,(req,res)=>{try{const db=getDb();const ips=db.prepare('SELECT * FROM banned_ips ORDER BY created_at DESC').all();res.json({ips});}catch(e){res.status(500).json({error:'失败'});}});
r.post('/banned-ips',requireAdmin,(req,res)=>{try{const db=getDb();const{ip,reason}=req.body;if(!ip)return res.status(400).json({error:'请输入IP'});if(db.prepare('SELECT id FROM banned_ips WHERE ip=?').get(ip))return res.status(400).json({error:'已在封禁列表'});db.prepare('INSERT INTO banned_ips (id,ip,reason,banned_by) VALUES (?,?,?,?)').run(uuidv4(),ip,reason||'',req.user.id);res.json({message:'已封禁'});}catch(e){res.status(500).json({error:'失败'});}});
r.delete('/banned-ips/:id',requireAdmin,(req,res)=>{try{getDb().prepare('DELETE FROM banned_ips WHERE id=?').run(req.params.id);res.json({message:'已解封'});}catch(e){res.status(500).json({error:'失败'});}});

// === 敏感词管理 ===
r.get('/sensitive-words',requireAdmin,(req,res)=>{try{const db=getDb();const words=db.prepare('SELECT * FROM sensitive_words ORDER BY created_at DESC').all();res.json({words});}catch(e){res.status(500).json({error:'失败'});}});
r.post('/sensitive-words',requireAdmin,(req,res)=>{try{const db=getDb();const{word,replacement}=req.body;if(!word)return res.status(400).json({error:'请输入敏感词'});if(db.prepare('SELECT id FROM sensitive_words WHERE word=?').get(word))return res.status(400).json({error:'已存在'});db.prepare('INSERT INTO sensitive_words (id,word,replacement) VALUES (?,?,?)').run(uuidv4(),word,replacement||'***');res.json({message:'已添加'});}catch(e){res.status(500).json({error:'失败'});}});
r.delete('/sensitive-words/:id',requireAdmin,(req,res)=>{try{getDb().prepare('DELETE FROM sensitive_words WHERE id=?').run(req.params.id);res.json({message:'已删除'});}catch(e){res.status(500).json({error:'失败'});}});

// === 访问统计 ===
r.get('/visit-stats',requireAdmin,(req,res)=>{try{const db=getDb();const days=parseInt(req.query.days)||30;const stats=db.prepare('SELECT * FROM visit_stats ORDER BY date DESC LIMIT ?').all(days);const today=new Date().toISOString().split('T')[0];const todayStat=db.prepare('SELECT * FROM visit_stats WHERE date=?').get(today)||{page_views:0,unique_visitors:0,posts_created:0,comments_created:0};res.json({stats:stats.reverse(),today:todayStat});}catch(e){res.status(500).json({error:'失败'});}});


// === 高级用户管理 ===

// 重置用户密码（超管）
r.put('/users/:id/reset-password', requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '密码至少6位' });
    const bcrypt = require('bcryptjs');
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.params.id);
    logAdmin(db, req.user.id, 'reset_password', req.params.id, '重置密码');
    res.json({ message: '密码已重置' });
  } catch (e) { res.status(500).json({ error: '重置失败' }); }
});

// 编辑用户资料（超管）
r.put('/users/:id/profile', requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const { nickname, bio, avatar } = req.body;
    const fields = [], values = [];
    if (nickname) { fields.push('nickname = ?'); values.push(nickname); }
    if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }
    if (avatar) { fields.push('avatar = ?'); values.push(avatar); }
    if (!fields.length) return res.status(400).json({ error: '无更新内容' });
    values.push(req.params.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    logAdmin(db, req.user.id, 'edit_user', req.params.id, '编辑用户资料');
    res.json({ message: '已更新' });
  } catch (e) { res.status(500).json({ error: '更新失败' }); }
});

// 带理由封禁
r.put('/users/:id/ban', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { reason, duration } = req.body; // duration: minutes, null = permanent
    if (req.params.id === req.user.id) return res.status(400).json({ error: '不能封禁自己' });
    const target = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
    if (target?.role === 'super_admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: '无权操作' });

    let banUntil = null;
    if (duration) {
      banUntil = new Date(Date.now() + duration * 60000).toISOString().replace('T', ' ').substring(0, 19);
    }
    db.prepare("UPDATE users SET status = 'banned', ban_reason = ?, ban_until = ? WHERE id = ?").run(reason || '', banUntil, req.params.id);
    logAdmin(db, req.user.id, 'ban_user', req.params.id, `封禁: ${reason || '无理由'}, 时长: ${duration ? duration + '分钟' : '永久'}`);
    res.json({ message: '已封禁', banUntil });
  } catch (e) { res.status(500).json({ error: '封禁失败' }); }
});

// 解封
r.put('/users/:id/unban', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare("UPDATE users SET status = 'active', ban_reason = NULL, ban_until = NULL WHERE id = ?").run(req.params.id);
    logAdmin(db, req.user.id, 'unban_user', req.params.id, '解封');
    res.json({ message: '已解封' });
  } catch (e) { res.status(500).json({ error: '解封失败' }); }
});

// 获取用户详情（含帖子统计）
r.get('/users/:id/detail', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, username, nickname, avatar, bio, role, status, ban_reason, ban_until, email, email_verified, created_at, last_login FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const postCount = db.prepare("SELECT COUNT(*) as c FROM posts WHERE user_id = ?").get(req.params.id).c;
    const commentCount = db.prepare("SELECT COUNT(*) as c FROM comments WHERE user_id = ?").get(req.params.id).c;
    const likeCount = db.prepare("SELECT COUNT(*) as c FROM likes WHERE user_id = ?").get(req.params.id).c;
    res.json({ user, stats: { postCount, commentCount, likeCount } });
  } catch (e) { res.status(500).json({ error: '获取失败' }); }
});

// 发送系统通知给用户
r.post('/users/:id/notify', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: '请输入通知内容' });
    const { v4: uuidv4 } = require('uuid');
    db.prepare("INSERT INTO notifications (id, user_id, type, content, from_user_id) VALUES (?, ?, 'system', ?, ?)").run(uuidv4(), req.params.id, content, req.user.id);
    logAdmin(db, req.user.id, 'send_notify', req.params.id, content.substring(0, 100));
    res.json({ message: '通知已发送' });
  } catch (e) { res.status(500).json({ error: '发送失败' }); }
});

// 获取用户帖子列表
r.get('/users/:id/posts', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;
    const total = db.prepare("SELECT COUNT(*) as c FROM posts WHERE user_id = ? AND status != 'deleted'").get(req.params.id).c;
    const posts = db.prepare("SELECT id, title, status, likes, comments_count, views, created_at FROM posts WHERE user_id = ? AND status != 'deleted' ORDER BY created_at DESC LIMIT ? OFFSET ?").all(req.params.id, limit, offset);
    res.json({ posts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { res.status(500).json({ error: '获取失败' }); }
});

// === 管理员高级操作 ===

// 设置管理员权限
r.put('/admins/:id/permissions', requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const { permissions } = req.body; // JSON string like '["posts","comments","reports"]'
    db.prepare('UPDATE users SET admin_permissions = ? WHERE id = ? AND role = ?').run(JSON.stringify(permissions), req.params.id, 'admin');
    logAdmin(db, req.user.id, 'set_permissions', req.params.id, JSON.stringify(permissions));
    res.json({ message: '权限已更新' });
  } catch (e) { res.status(500).json({ error: '更新失败' }); }
});

// 重置管理员密码
r.put('/admins/:id/reset-password', requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '密码至少6位' });
    const bcrypt = require('bcryptjs');
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.params.id);
    logAdmin(db, req.user.id, 'reset_admin_pwd', req.params.id, '重置管理员密码');
    res.json({ message: '密码已重置' });
  } catch (e) { res.status(500).json({ error: '重置失败' }); }
});

// 获取管理员操作日志
r.get('/admin-logs', requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;
    const total = db.prepare('SELECT COUNT(*) as c FROM admin_logs').get().c;
    const logs = db.prepare(`
      SELECT l.*, u.nickname as admin_name
      FROM admin_logs l LEFT JOIN users u ON l.admin_id = u.id
      ORDER BY l.created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
    res.json({ logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { res.status(500).json({ error: '获取失败' }); }
});

// 获取管理员列表（含权限）
r.get('/admins', requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const admins = db.prepare("SELECT id, username, nickname, avatar, admin_permissions, created_at, last_login FROM users WHERE role IN ('admin', 'super_admin') ORDER BY created_at DESC").all();
    res.json({ admins });
  } catch (e) { res.status(500).json({ error: '获取失败' }); }
});

// 记录管理员操作
function logAdmin(db, adminId, action, targetId, details) {
  try {
    db.prepare('INSERT INTO admin_logs (id, admin_id, action, target_id, details) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), adminId, action, targetId, details || '');
  } catch (e) {}
}

module.exports=r;