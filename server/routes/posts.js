const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { getSetting } = require('../settings');
const { createNotification } = require('./notifications');

const r = express.Router();

// 敏感词过滤
function filterSensitiveWords(text) {
  try {
    const db = getDb();
    const replaceEnabled = getSetting('replaceSensitiveWords') === 'true';
    if (!replaceEnabled) return text;

    const words = db.prepare("SELECT word, replacement FROM sensitive_words").all();
    let filtered = text;
    for (const w of words) {
      const regex = new RegExp(w.word, 'gi');
      filtered = filtered.replace(regex, w.replacement || '***');
    }
    return filtered;
  } catch (e) {
    return text;
  }
}

// 获取帖子列表
r.get('/', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;
    const sort = req.query.sort || 'latest';
    const cat = req.query.category;
    const search = req.query.search;

    let w = "WHERE p.status = 'published'";
    const params = [];
    if (cat) { w += " AND p.category = ?"; params.push(cat); }
    if (search) { w += " AND (p.title LIKE ? OR p.content LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

    let o = 'ORDER BY p.is_pinned DESC, p.created_at DESC';
    if (sort === 'hot') o = 'ORDER BY p.is_pinned DESC, p.likes DESC';
    if (sort === 'views') o = 'ORDER BY p.is_pinned DESC, p.views DESC';
    if (sort === 'comments') o = 'ORDER BY p.is_pinned DESC, p.comments_count DESC';

    const total = db.prepare(`SELECT COUNT(*) as c FROM posts p ${w}`).get(...params).c;
    const posts = db.prepare(`
      SELECT p.*, u.nickname as author_name, u.avatar as author_avatar, u.id as author_id
      FROM posts p LEFT JOIN users u ON p.user_id = u.id
      ${w} ${o} LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      posts: posts.map(x => {
        let img = [], tag = [];
        try { img = JSON.parse(x.images); } catch (e) {}
        try { tag = JSON.parse(x.tags); } catch (e) {}
        const liked = req.user ? !!db.prepare("SELECT id FROM likes WHERE user_id = ? AND target_id = ? AND target_type = 'post'").get(req.user.id, x.id) : false;
        const bookmarked = req.user ? !!db.prepare("SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?").get(req.user.id, x.id) : false;

        // 获取回应统计
        const reactions = db.prepare(`
          SELECT emoji, COUNT(*) as count FROM reactions
          WHERE target_id = ? AND target_type = 'post' GROUP BY emoji ORDER BY count DESC
        `).all(x.id);

        return {
          ...x, images: img, tags: tag, isLiked: liked, isBookmarked: bookmarked, reactions,
          author_name: x.is_anonymous ? '匿名用户' : x.author_name,
          author_avatar: x.is_anonymous ? '/img/loge.png' : x.author_avatar,
          author_id: x.is_anonymous ? null : x.author_id
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (e) {
    console.error('Get posts error:', e);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取热门标签
r.get('/meta/tags', (req, res) => {
  try {
    const db = getDb();
    const tc = {};
    db.prepare("SELECT tags FROM posts WHERE status = 'published'").all().forEach(x => {
      try { JSON.parse(x.tags).forEach(t => { tc[t] = (tc[t] || 0) + 1; }); } catch (e) {}
    });
    res.json({ tags: Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([n, c]) => ({ name: n, count: c })) });
  } catch (e) { res.json({ tags: [] }); }
});

// 获取单个帖子
r.get('/:id', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const p = db.prepare("SELECT p.*, u.nickname as author_name, u.avatar as author_avatar, u.id as author_id FROM posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.status != 'deleted'").get(req.params.id);
    if (!p) return res.status(404).json({ error: '帖子不存在' });

    // 增加浏览量
    db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(req.params.id);

    let img = [], tag = [];
    try { img = JSON.parse(p.images); } catch (e) {}
    try { tag = JSON.parse(p.tags); } catch (e) {}
    const liked = req.user ? !!db.prepare("SELECT id FROM likes WHERE user_id = ? AND target_id = ? AND target_type = 'post'").get(req.user.id, p.id) : false;
    const bookmarked = req.user ? !!db.prepare("SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?").get(req.user.id, p.id) : false;

    const comments = db.prepare("SELECT c.*, u.nickname as author_name, u.avatar as author_avatar FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.post_id = ? AND c.status = 'published' ORDER BY c.created_at ASC").all(req.params.id);

    // 获取回应
    const reactions = db.prepare(`
      SELECT emoji, COUNT(*) as count, GROUP_CONCAT(u.nickname) as users
      FROM reactions r LEFT JOIN users u ON r.user_id = u.id
      WHERE r.target_id = ? AND r.target_type = 'post' GROUP BY r.emoji ORDER BY count DESC
    `).all(req.params.id);

    const myReactions = req.user ? db.prepare("SELECT emoji FROM reactions WHERE user_id = ? AND target_id = ? AND target_type = 'post'").all(req.user.id, p.id).map(r => r.emoji) : [];

    res.json({
      post: { ...p, images: img, tags: tag, isLiked: liked, isBookmarked: bookmarked, reactions, myReactions,
        author_name: p.is_anonymous ? '匿名用户' : p.author_name,
        author_avatar: p.is_anonymous ? '/img/loge.png' : p.author_avatar,
        author_id: p.is_anonymous ? null : p.author_id
      },
      comments: comments.map(c => ({ ...c, isLiked: req.user ? !!db.prepare("SELECT id FROM likes WHERE user_id = ? AND target_id = ? AND target_type = 'comment'").get(req.user.id, c.id) : false }))
    });
  } catch (e) { console.error('Get post error:', e); res.status(500).json({ error: '获取失败' }); }
});

// 创建帖子
r.post('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    let { title, content, images, isAnonymous, tags, category } = req.body;
    if (!title || !content) return res.status(400).json({ error: '请输入标题和内容' });
    if (title.length > 100) return res.status(400).json({ error: '标题最长100字' });
    if (content.length > 5000) return res.status(400).json({ error: '内容最长5000字' });

    // 敏感词过滤
    title = filterSensitiveWords(title);
    content = filterSensitiveWords(content);

    const mi = parseInt(getSetting('maxImagesPerPost')) || 9;
    const il = Array.isArray(images) ? images.slice(0, mi) : [];
    const st = getSetting('postReview') === 'true' ? 'pending' : 'published';
    const id = uuidv4();

    db.prepare("INSERT INTO posts (id, user_id, title, content, images, is_anonymous, tags, category, status) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id, req.user.id, title, content, JSON.stringify(il), isAnonymous ? 1 : 0, JSON.stringify(tags || []), category || 'confession', st);

    // 更新访问统计
    try {
      const today = new Date().toISOString().split('T')[0];
      db.prepare("INSERT OR IGNORE INTO visit_stats (date) VALUES (?)").run(today);
      db.prepare("UPDATE visit_stats SET posts_created = posts_created + 1 WHERE date = ?").run(today);
    } catch (e) {}

    res.json({ message: st === 'pending' ? '发布成功，等待审核' : '发布成功', post: { id, title, status: st } });
  } catch (e) { console.error('Create post error:', e); res.status(500).json({ error: '发布失败' }); }
});

// 点赞
r.post('/:id/like', authenticate, (req, res) => {
  try {
    const db = getDb();
    const p = db.prepare('SELECT id, likes, user_id, title FROM posts WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: '帖子不存在' });

    const ex = db.prepare("SELECT id FROM likes WHERE user_id = ? AND target_id = ? AND target_type = 'post'").get(req.user.id, req.params.id);
    if (ex) {
      db.prepare('DELETE FROM likes WHERE id = ?').run(ex.id);
      db.prepare('UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ?').run(req.params.id);
      res.json({ liked: false, likes: p.likes - 1 });
    } else {
      db.prepare("INSERT INTO likes (id, user_id, target_id, target_type) VALUES (?, ?, ?, 'post')").run(uuidv4(), req.user.id, req.params.id);
      db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?').run(req.params.id);

      // 发送通知
      createNotification(p.user_id, 'like', `${req.user.nickname} 赞了你的帖子「${p.title}」`, req.user.id, p.id);

      res.json({ liked: true, likes: p.likes + 1 });
    }
  } catch (e) { res.status(500).json({ error: '操作失败' }); }
});

// 评论
r.post('/:id/comments', authenticate, (req, res) => {
  try {
    const db = getDb();
    let { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '请输入评论' });
    if (content.length > 1000) return res.status(400).json({ error: '评论最长1000字' });

    // 敏感词过滤
    content = filterSensitiveWords(content);

    const p = db.prepare("SELECT id, user_id, title FROM posts WHERE id = ? AND status = 'published'").get(req.params.id);
    if (!p) return res.status(404).json({ error: '帖子不存在' });

    const id = uuidv4();
    db.prepare('INSERT INTO comments (id, post_id, user_id, content) VALUES (?, ?, ?, ?)').run(id, req.params.id, req.user.id, content.trim());
    db.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').run(req.params.id);

    // 发送通知
    createNotification(p.user_id, 'comment', `${req.user.nickname} 评论了你的帖子「${p.title}」`, req.user.id, p.id);

    // 更新访问统计
    try {
      const today = new Date().toISOString().split('T')[0];
      db.prepare("INSERT OR IGNORE INTO visit_stats (date) VALUES (?)").run(today);
      db.prepare("UPDATE visit_stats SET comments_created = comments_created + 1 WHERE date = ?").run(today);
    } catch (e) {}

    const c = db.prepare('SELECT c.*, u.nickname as author_name, u.avatar as author_avatar FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(id);
    res.json({ message: '评论成功', comment: c });
  } catch (e) { res.status(500).json({ error: '评论失败' }); }
});

// 评论点赞
r.post('/comments/:id/like', authenticate, (req, res) => {
  try {
    const db = getDb();
    const c = db.prepare('SELECT id, likes FROM comments WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: '评论不存在' });

    const ex = db.prepare("SELECT id FROM likes WHERE user_id = ? AND target_id = ? AND target_type = 'comment'").get(req.user.id, req.params.id);
    if (ex) {
      db.prepare('DELETE FROM likes WHERE id = ?').run(ex.id);
      db.prepare('UPDATE comments SET likes = MAX(0, likes - 1) WHERE id = ?').run(req.params.id);
      res.json({ liked: false, likes: c.likes - 1 });
    } else {
      db.prepare("INSERT INTO likes (id, user_id, target_id, target_type) VALUES (?, ?, ?, 'comment')").run(uuidv4(), req.user.id, req.params.id);
      db.prepare('UPDATE comments SET likes = likes + 1 WHERE id = ?').run(req.params.id);
      res.json({ liked: true, likes: c.likes + 1 });
    }
  } catch (e) { res.status(500).json({ error: '操作失败' }); }
});

// 删除帖子
r.delete('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const p = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: '不存在' });
    if (p.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) return res.status(403).json({ error: '无权删除' });
    db.prepare("UPDATE posts SET status = 'deleted' WHERE id = ?").run(req.params.id);
    res.json({ message: '已删除' });
  } catch (e) { res.status(500).json({ error: '删除失败' }); }
});

// 举报
r.post('/:id/report', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: '请填写原因' });
    if (db.prepare("SELECT id FROM reports WHERE reporter_id = ? AND target_id = ? AND status = 'pending'").get(req.user.id, req.params.id)) return res.status(400).json({ error: '已举报过' });
    db.prepare("INSERT INTO reports (id, reporter_id, target_id, target_type, reason) VALUES (?, ?, ?, 'post', ?)").run(uuidv4(), req.user.id, req.params.id, reason);
    res.json({ message: '举报已提交' });
  } catch (e) { res.status(500).json({ error: '举报失败' }); }
});

module.exports = r;
