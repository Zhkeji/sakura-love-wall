const express=require('express'),multer=require('multer'),path=require('path'),{v4:uuidv4}=require('uuid'),{authenticate}=require('../middleware/auth');
const r=express.Router();
const storage=multer.diskStorage({destination:(req,file,cb)=>cb(null,path.join(__dirname,'../../public/uploads')),filename:(req,file,cb)=>cb(null,`${uuidv4()}${path.extname(file.originalname)}`)});
const upload=multer({storage,fileFilter:(req,file,cb)=>{if(['image/jpeg','image/png','image/gif','image/webp'].includes(file.mimetype))cb(null,true);else cb(new Error('只支持图片'),false);},limits:{fileSize:10*1024*1024}});
r.post('/image',authenticate,upload.single('image'),(req,res)=>{if(!req.file)return res.status(400).json({error:'请选择图片'});res.json({url:`/uploads/${req.file.filename}`});});
r.post('/images',authenticate,upload.array('images',9),(req,res)=>{if(!req.files?.length)return res.status(400).json({error:'请选择图片'});res.json({urls:req.files.map(f=>`/uploads/${f.filename}`)});});
module.exports=r;
