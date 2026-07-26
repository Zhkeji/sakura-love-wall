const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const r = express.Router();

// 获取目标的回应
r.get('/:targetType/:targetId', (req, res) => {
  try {
    const db = getDb();
    const reactions = db.prepare(`
      SELECT emoji, COUNT(*) as count,
        GROUP_CONCAT(u.nickname) as users
      FROM reactions r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.target_id = ? AND r.target_type = ?
      GROUP BY r.emoji
      ORDER BY count DESC
    `).all(req.params.targetId, req.params.targetType);

    // 检查当前用户的回应
    let myReactions = [];
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, require('../middleware/auth').JWT_SECRET);
        myReactions = db.prepare("SELECT emoji FROM reactions WHERE user_id = ? AND target_id = ? AND target_type = ?")
          .all(decoded.id, req.params.targetId, req.params.targetType)
          .map(r => r.emoji);
      } catch (e) {}
    }

    res.json({ reactions, myReactions });
  } catch (e) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 添加/切换回应
r.post('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { targetType, targetId, emoji } = req.body;
    if (!targetType || !targetId || !emoji) return res.status(400).json({ error: '参数不完整' });

    const validEmojis = ['❤️', '😂', '😮', '😢', '😡', '👍', '👎'];
    if (!validEmojis.includes(emoji)) return res.status(400).json({ error: '无效的表情' });

    const existing = db.prepare("SELECT id FROM reactions WHERE user_id = ? AND target_id = ? AND target_type = ? AND emoji = ?")
      .get(req.user.id, targetId, targetType, emoji);

    if (existing) {
      db.prepare("DELETE FROM reactions WHERE id = ?").run(existing.id);
      res.json({ action: 'removed', emoji });
    } else {
      db.prepare("INSERT INTO reactions (id, user_id, target_id, target_type, emoji) VALUES (?, ?, ?, ?, ?)")
        .run(uuidv4(), req.user.id, targetId, targetType, emoji);
      res.json({ action: 'added', emoji });
    }
  } catch (e) {
    res.status(500).json({ error: '操作失败' });
  }
});

module.exports = r;
