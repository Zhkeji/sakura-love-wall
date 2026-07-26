const express=require('express'),{v4:uuidv4}=require('uuid'),{getDb}=require('../database'),{authenticate}=require('../middleware/auth');
const r=express.Router();

r.get('/conversations',authenticate,(req,res)=>{
  try{
    const db=getDb();
    const sql=`SELECT c.*,
      CASE WHEN c.user1_id=? THEN u2.nickname ELSE u1.nickname END as other_name,
      CASE WHEN c.user1_id=? THEN u2.avatar ELSE u1.avatar END as other_avatar,
      CASE WHEN c.user1_id=? THEN u2.id ELSE u1.id END as other_id,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.receiver_id=? AND m.is_read=0) as unread_count
      FROM conversations c LEFT JOIN users u1 ON c.user1_id=u1.id LEFT JOIN users u2 ON c.user2_id=u2.id
      WHERE c.user1_id=? OR c.user2_id=? ORDER BY c.last_message_at DESC`;
    res.json({conversations:db.prepare(sql).all(req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,req.user.id)});
  }catch(e){res.status(500).json({error:'失败'});}
});

r.post('/conversations',authenticate,(req,res)=>{
  try{
    const db=getDb(),{userId}=req.body;
    if(!userId)return res.status(400).json({error:'请指定用户'});
    if(userId===req.user.id)return res.status(400).json({error:'不能和自己聊天'});
    const o=db.prepare('SELECT id,nickname,avatar FROM users WHERE id=?').get(userId);
    if(!o)return res.status(404).json({error:'用户不存在'});
    let c=db.prepare('SELECT * FROM conversations WHERE (user1_id=? AND user2_id=?) OR (user1_id=? AND user2_id=?)').get(req.user.id,userId,userId,req.user.id);
    if(!c){const id=uuidv4();db.prepare('INSERT INTO conversations (id,user1_id,user2_id) VALUES (?,?,?)').run(id,req.user.id,userId);c=db.prepare('SELECT * FROM conversations WHERE id=?').get(id);}
    res.json({conversation:{...c,other_name:o.nickname,other_avatar:o.avatar,other_id:o.id}});
  }catch(e){res.status(500).json({error:'失败'});}
});

r.get('/conversations/:id/messages',authenticate,(req,res)=>{
  try{
    const db=getDb(),c=db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.id);
    if(!c)return res.status(404).json({error:'不存在'});
    if(c.user1_id!==req.user.id&&c.user2_id!==req.user.id)return res.status(403).json({error:'无权'});
    const page=parseInt(req.query.page)||1,limit=Math.min(parseInt(req.query.limit)||50,100),offset=(page-1)*limit;
    const total=db.prepare('SELECT COUNT(*) as c FROM messages WHERE conversation_id=?').get(req.params.id).c;
    db.prepare('UPDATE messages SET is_read=1 WHERE conversation_id=? AND receiver_id=? AND is_read=0').run(req.params.id,req.user.id);
    const msgs=db.prepare('SELECT m.*,u.nickname as sender_name,u.avatar as sender_avatar FROM messages m LEFT JOIN users u ON m.sender_id=u.id WHERE m.conversation_id=? ORDER BY m.created_at DESC LIMIT ? OFFSET ?').all(req.params.id,limit,offset).reverse();
    res.json({messages:msgs,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
  }catch(e){res.status(500).json({error:'失败'});}
});

r.post('/conversations/:id/messages',authenticate,(req,res)=>{
  try{
    const db=getDb(),{content,type='text'}=req.body;
    if(!content)return res.status(400).json({error:'请输入内容'});
    const c=db.prepare('SELECT * FROM conversations WHERE id=?').get(req.params.id);
    if(!c)return res.status(404).json({error:'不存在'});
    if(c.user1_id!==req.user.id&&c.user2_id!==req.user.id)return res.status(403).json({error:'无权'});
    const rid=c.user1_id===req.user.id?c.user2_id:c.user1_id,id=uuidv4();
    db.prepare('INSERT INTO messages (id,sender_id,receiver_id,content,type,conversation_id) VALUES (?,?,?,?,?,?)').run(id,req.user.id,rid,content,type,req.params.id);
    db.prepare("UPDATE conversations SET last_message=?,last_message_at=datetime('now') WHERE id=?").run(content.substring(0,100),req.params.id);
    const msg=db.prepare('SELECT m.*,u.nickname as sender_name,u.avatar as sender_avatar FROM messages m LEFT JOIN users u ON m.sender_id=u.id WHERE m.id=?').get(id);
    const io=req.app.get('io');
    if(io)io.to(`user_${rid}`).emit('new_message',{...msg,conversation_id:req.params.id});
    res.json({message:msg});
  }catch(e){res.status(500).json({error:'失败'});}
});

r.get('/unread',authenticate,(req,res)=>{
  try{res.json({count:getDb().prepare('SELECT COUNT(*) as c FROM messages WHERE receiver_id=? AND is_read=0').get(req.user.id).c});}
  catch(e){res.json({count:0});}
});

module.exports=r;
