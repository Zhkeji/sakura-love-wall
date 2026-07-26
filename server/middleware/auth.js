const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const JWT_SECRET = process.env.JWT_SECRET || 'sakura-love-wall-secret-2024';
function generateToken(u) { return jwt.sign({id:u.id,username:u.username,role:u.role},JWT_SECRET,{expiresIn:'7d'}); }
function authenticate(req,res,next) {
  const token = req.headers.authorization?.replace('Bearer ','')||req.cookies?.token;
  if(!token) return res.status(401).json({error:'请先登录'});
  try { const d=jwt.verify(token,JWT_SECRET); const u=getDb().prepare('SELECT id,username,nickname,avatar,role,status FROM users WHERE id=?').get(d.id);
    if(!u) return res.status(401).json({error:'用户不存在'}); if(u.status==='banned') return res.status(403).json({error:'账号已被封禁'}); req.user=u; next();
  } catch(e) { return res.status(401).json({error:'登录已过期'}); }
}
function optionalAuth(req,res,next) {
  const token = req.headers.authorization?.replace('Bearer ','')||req.cookies?.token;
  if(token) try { const d=jwt.verify(token,JWT_SECRET); const u=getDb().prepare('SELECT id,username,nickname,avatar,role,status FROM users WHERE id=?').get(d.id); if(u&&u.status!=='banned') req.user=u; } catch(e) {}
  next();
}
function requireAdmin(req,res,next) { if(!req.user||!['admin','super_admin'].includes(req.user.role)) return res.status(403).json({error:'需要管理员权限'}); next(); }
function requireSuperAdmin(req,res,next) { if(!req.user||req.user.role!=='super_admin') return res.status(403).json({error:'需要超级管理员权限'}); next(); }
module.exports = { generateToken, authenticate, optionalAuth, requireAdmin, requireSuperAdmin, JWT_SECRET };
