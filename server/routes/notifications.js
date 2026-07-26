const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const r = express.Router();

// 获取通知列表
r.get('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    let where = "WHERE n.user_id = ?";
    const params = [req.user.id];
    if (unreadOnly) { where += " AND n.is_read = 0"; }

    const total = db.prepare(`SELECT COUNT(*) as c FROM notifications n ${where}`).get(...params).c;
    const notifications = db.prepare(`
      SELECT n.*, u.nickname as from_name, u.avatar as from_avatar, p.title as post_title
      FROM notifications n
      LEFT JOIN users u ON n.from_user_id = u.id
      LEFT JOIN posts p ON n.post_id = p.id
      ${where}
      ORDER BY n.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const unreadCount = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0").get(req.user.id).c;

    res.json({ notifications, unreadCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    console.error('Get notifications error:', e);
    res.status(500).json({ error: '获取通知失败' });
  }
});

// 获取未读数量
r.get('/unread-count', authenticate, (req, res) => {
  try {
    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0").get(req.user.id).c;
    res.json({ count });
  } catch (e) {
    res.json({ count: 0 });
  }
});

// 标记全部已读
r.post('/read-all', authenticate, (req, res) => {
  try {
    const db = getDb();
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0").run(req.user.id);
    res.json({ message: '已全部标记为已读' });
  } catch (e) {
    res.status(500).json({ error: '操作失败' });
  }
});

// 标记单条已读
r.post('/:id/read', authenticate, (req, res) => {
  try {
    const db = getDb();
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ message: '已标记已读' });
  } catch (e) {
    res.status(500).json({ error: '操作失败' });
  }
});

// 创建通知（内部使用）
function createNotification(userId, type, content, fromUserId = null, postId = null) {
  try {
    const db = getDb();
    if (userId === fromUserId) return; // 不给自己发通知
    db.prepare("INSERT INTO notifications (id, user_id, type, content, from_user_id, post_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(uuidv4(), userId, type, content, fromUserId, postId);
  } catch (e) {
    console.error('Create notification error:', e);
  }
}

module.exports = r;
module.exports.createNotification = createNotification;
