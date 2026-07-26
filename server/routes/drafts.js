const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const r = express.Router();

// 获取草稿列表
r.get('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const drafts = db.prepare("SELECT * FROM drafts WHERE user_id = ? ORDER BY updated_at DESC").all(req.user.id);
    res.json({ drafts });
  } catch (e) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 保存草稿
r.post('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { id, title, content, tags, category, isAnonymous } = req.body;

    if (id) {
      // 更新现有草稿
      db.prepare("UPDATE drafts SET title=?, content=?, tags=?, category=?, is_anonymous=?, updated_at=datetime('now') WHERE id=? AND user_id=?")
        .run(title || '', content || '', JSON.stringify(tags || []), category || 'confession', isAnonymous ? 1 : 0, id, req.user.id);
      res.json({ message: '草稿已更新', id });
    } else {
      // 创建新草稿
      const newId = uuidv4();
      db.prepare("INSERT INTO drafts (id, user_id, title, content, tags, category, is_anonymous) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(newId, req.user.id, title || '', content || '', JSON.stringify(tags || []), category || 'confession', isAnonymous ? 1 : 0);
      res.json({ message: '草稿已保存', id: newId });
    }
  } catch (e) {
    res.status(500).json({ error: '保存失败' });
  }
});

// 删除草稿
r.delete('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM drafts WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ message: '已删除' });
  } catch (e) {
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = r;
