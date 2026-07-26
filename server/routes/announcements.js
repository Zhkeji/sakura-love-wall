const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

const r = express.Router();

// 公开获取公告列表
r.get('/', (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const announcements = db.prepare(
      "SELECT id, title, content, type, is_pinned, created_at FROM announcements WHERE status = 'published' ORDER BY is_pinned DESC, created_at DESC LIMIT ?"
    ).all(limit);
    res.json({ announcements });
  } catch (e) {
    res.status(500).json({ error: '获取公告失败' });
  }
});

// 获取单条公告
r.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const ann = db.prepare(
      "SELECT id, title, content, type, is_pinned, created_at FROM announcements WHERE id = ? AND status = 'published'"
    ).get(req.params.id);
    if (!ann) return res.status(404).json({ error: '公告不存在' });
    res.json({ announcement: ann });
  } catch (e) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 以下需要超管权限
r.use(authenticate, requireSuperAdmin);

// 获取所有公告（含草稿）
r.get('/admin/all', (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const total = db.prepare("SELECT COUNT(*) as c FROM announcements").get().c;
    const announcements = db.prepare(
      "SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?"
    ).all(limit, offset);
    res.json({ announcements, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 创建公告
r.post('/', (req, res) => {
  try {
    const db = getDb();
    const { title, content, type = 'info', is_pinned = 0 } = req.body;
    if (!title || !content) return res.status(400).json({ error: '请输入标题和内容' });
    if (title.length > 100) return res.status(400).json({ error: '标题最长100字' });
    if (content.length > 2000) return res.status(400).json({ error: '内容最长2000字' });

    const id = uuidv4();
    db.prepare(
      "INSERT INTO announcements (id, title, content, type, is_pinned, status) VALUES (?, ?, ?, ?, ?, 'published')"
    ).run(id, title, content, type, is_pinned ? 1 : 0);

    res.json({
      message: '公告发布成功',
      announcement: { id, title, content, type, is_pinned: is_pinned ? 1 : 0 }
    });
  } catch (e) {
    res.status(500).json({ error: '发布失败' });
  }
});

// 更新公告
r.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { title, content, type, is_pinned, status } = req.body;
    const ann = db.prepare("SELECT id FROM announcements WHERE id = ?").get(req.params.id);
    if (!ann) return res.status(404).json({ error: '公告不存在' });

    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (is_pinned !== undefined) { updates.push('is_pinned = ?'); values.push(is_pinned ? 1 : 0); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }

    if (updates.length === 0) return res.status(400).json({ error: '无更新内容' });

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id);
    db.prepare(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: '公告已更新' });
  } catch (e) {
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除公告
r.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM announcements WHERE id = ?").run(req.params.id);
    res.json({ message: '公告已删除' });
  } catch (e) {
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = r;
