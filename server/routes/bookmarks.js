const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const r = express.Router();

// 获取收藏列表
r.get('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const total = db.prepare("SELECT COUNT(*) as c FROM bookmarks WHERE user_id = ?").get(req.user.id).c;
    const bookmarks = db.prepare(`
      SELECT b.*, p.title, p.content, p.likes, p.comments_count, p.views, p.created_at as post_created_at,
        u.nickname as author_name, u.avatar as author_avatar
      FROM bookmarks b
      JOIN posts p ON b.post_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE b.user_id = ? AND p.status = 'published'
      ORDER BY b.created_at DESC LIMIT ? OFFSET ?
    `).all(req.user.id, limit, offset);

    res.json({ bookmarks, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    console.error('Get bookmarks error:', e);
    res.status(500).json({ error: '获取收藏失败' });
  }
});

// 添加收藏
r.post('/:postId', authenticate, (req, res) => {
  try {
    const db = getDb();
    const post = db.prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'").get(req.params.postId);
    if (!post) return res.status(404).json({ error: '帖子不存在' });

    const existing = db.prepare("SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?").get(req.user.id, req.params.postId);
    if (existing) return res.status(400).json({ error: '已收藏过' });

    db.prepare("INSERT INTO bookmarks (id, user_id, post_id) VALUES (?, ?, ?)").run(uuidv4(), req.user.id, req.params.postId);
    res.json({ message: '收藏成功', bookmarked: true });
  } catch (e) {
    res.status(500).json({ error: '收藏失败' });
  }
});

// 取消收藏
r.delete('/:postId', authenticate, (req, res) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?").run(req.user.id, req.params.postId);
    res.json({ message: '已取消收藏', bookmarked: false });
  } catch (e) {
    res.status(500).json({ error: '取消收藏失败' });
  }
});

// 检查是否已收藏
r.get('/check/:postId', authenticate, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?").get(req.user.id, req.params.postId);
    res.json({ bookmarked: !!existing });
  } catch (e) {
    res.json({ bookmarked: false });
  }
});

module.exports = r;
