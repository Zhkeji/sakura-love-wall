// === 夜间模式 ===
function toggleDarkMode(){
  document.body.classList.toggle('dark-mode');
  const isDark=document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode',isDark?'true':'false');
  document.getElementById('darkModeBtn').textContent=isDark?'☀️':'🌙';
}
if(localStorage.getItem('darkMode')==='true'){
  document.body.classList.add('dark-mode');
}

// === 通知 ===
async function checkNotifications(){
  try{const d=await fetchAPI('/api/notifications/unread-count');
    const b=document.getElementById('notifBadge');
    if(d.count>0){b.textContent=d.count>99?'99+':d.count;b.style.display='inline';}
    else b.style.display='none';
  }catch(e){}
}

async function showNotifications(){
  showModal('notifModal');
  try{const d=await fetchAPI('/api/notifications');
    const list=document.getElementById('notifList');
    if(!d.notifications.length){list.innerHTML='<p style="color:#aaa;text-align:center;padding:20px">暂无通知</p>';return;}
    const icons={like:'❤️',comment:'💬',follow:'👤',system:'🔔'};
    list.innerHTML=d.notifications.map(n=>{
      const bg=n.is_read?'':'background:#fff5f7';
      return `<div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid #f5f0ee;${bg}">
        <div style="font-size:20px">${icons[n.type]||'🔔'}</div>
        <div style="flex:1"><div style="font-size:14px;color:#333">${esc(n.content)}</div>
        <div style="font-size:12px;color:#aaa;margin-top:4px">${getTimeAgo(n.created_at)}</div></div></div>`;
    }).join('');
  }catch(e){showToast('加载失败','error');}
}

async function markAllNotifRead(){
  try{await fetchAPI('/api/notifications/read-all','POST');showToast('已全部标为已读');checkNotifications();showNotifications();}
  catch(e){showToast('操作失败','error');}
}

// === 收藏 ===
async function toggleBookmark(postId,btn){
  try{
    const isBookmarked=btn.classList.contains('liked');
    if(isBookmarked){
      await fetchAPI('/api/bookmarks/'+postId,'DELETE');
      btn.classList.remove('liked');
      btn.innerHTML='<i class="fa-regular fa-bookmark"></i>';
      showToast('已取消收藏');
    }else{
      await fetchAPI('/api/bookmarks/'+postId,'POST');
      btn.classList.add('liked');
      btn.innerHTML='<i class="fa-solid fa-bookmark"></i>';
      showToast('收藏成功 🔖');
    }
  }catch(e){showToast(e.message,'error');}
}

async function showBookmarks(){
  showModal('bookmarkModal');
  try{const d=await fetchAPI('/api/bookmarks');
    const list=document.getElementById('bookmarkList');
    if(!d.bookmarks.length){list.innerHTML='<p style="color:#aaa;text-align:center;padding:20px">暂无收藏</p>';return;}
    list.innerHTML=d.bookmarks.map(b=>
      `<div style="padding:12px 0;border-bottom:1px solid #f5f0ee;cursor:pointer" onclick="hideModal('bookmarkModal');openDetail('${b.post_id}')">
        <div style="font-weight:600;font-size:15px;margin-bottom:4px">${esc(b.title)}</div>
        <div style="font-size:13px;color:#aaa">${esc(b.author_name)} · ${getTimeAgo(b.post_created_at)}</div>
      </div>`
    ).join('');
  }catch(e){showToast('加载失败','error');}
}

// === 表情回应 ===
async function toggleReaction(postId,emoji,btn){
  try{await fetchAPI('/api/reactions','POST',{targetType:'post',targetId:postId,emoji});
    loadPosts(true);
  }catch(e){showToast(e.message,'error');}
}

// === 分享 ===
let shareUrl='';
function showShare(postId,title){
  shareUrl=location.origin+'/?post='+postId;
  document.getElementById('shareContent').innerHTML=
    `<p style="font-size:14px;color:#555;margin-bottom:12px">${esc(title)}</p>
     <input class="form-input" value="${shareUrl}" readonly style="text-align:center;font-size:13px" onclick="this.select()">`;
  showModal('shareModal');
}
function copyShareLink(){
  navigator.clipboard.writeText(shareUrl)
    .then(()=>showToast('链接已复制'))
    .catch(()=>showToast('复制失败','error'));
}

// === 用户主页 ===
async function showUserProfile(userId){
  if(!userId)return;
  try{const d=await fetchAPI('/api/auth/user/'+userId);
    const u=d.user;
    document.getElementById('userProfileContent').innerHTML=
      `<div style="text-align:center;margin-bottom:16px">
        <img src="${u.avatar||'/img/loge.png'}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #fce4ec">
        <h3 style="font-size:18px;font-weight:700;margin-top:10px">${esc(u.nickname)}</h3>
        <p style="font-size:13px;color:#aaa">${esc(u.bio||'这个人很懒')}</p>
        <p style="font-size:13px;color:#e74c6f;margin-top:4px">${u.postCount||0} 条表白</p>
      </div>`;
    showModal('userProfileModal');
  }catch(e){showToast('加载失败','error');}
}

// === 热门标签 ===
async function loadHotTags(){
  try{const d=await fetchAPI('/api/posts/meta/tags');
    const c=document.getElementById('hotTags');
    if(!d.tags.length){c.innerHTML='<p style="color:#aaa;font-size:13px">暂无标签</p>';return;}
    c.innerHTML=d.tags.map(t=>
      `<span style="font-size:12px;padding:4px 10px;background:#fff0f3;color:#e74c6f;border-radius:8px;cursor:pointer" onclick="searchByTag('${esc(t.name)}')">#${esc(t.name)} (${t.count})</span>`
    ).join('');
  }catch(e){}
}

function searchByTag(tag){
  document.getElementById('inlineSearchInput').value=tag;
  searchKeyword=tag;
  loadPosts(true);
}

// === 邮箱绑定 ===
async function bindEmail() {
  const email = document.getElementById('editEmail').value.trim();
  if (!email) return showToast('请输入邮箱', 'error');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return showToast('邮箱格式不正确', 'error');

  try {
    const d = await fetchAPI('/api/auth/bind-email', 'POST', { email });
    showToast('绑定成功！请查收验证邮件', 'success');
    const statusEl = document.getElementById('emailStatus');
    if (statusEl) {
      statusEl.innerHTML = '📧 验证邮件已发送，请查收';
      statusEl.style.color = '#e74c6f';
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// 更新 showProfileCard 填充邮箱
const _originalShowProfileCard = typeof showProfileCard === 'function' ? showProfileCard : null;
function showProfileCard() {
  if (!currentUser) return;
  const avatarEl = document.getElementById('profileAvatar');
  const nameEl = document.getElementById('profileName');
  const bioEl = document.getElementById('profileBio');
  const nickEl = document.getElementById('editNick');
  const bioEditEl = document.getElementById('editBio');
  const emailEl = document.getElementById('editEmail');
  const emailStatusEl = document.getElementById('emailStatus');

  if (avatarEl) avatarEl.src = currentUser.avatar || '/img/loge.png';
  if (nameEl) nameEl.textContent = currentUser.nickname;
  if (bioEl) bioEl.textContent = currentUser.bio || '';
  if (nickEl) nickEl.value = currentUser.nickname || '';
  if (bioEditEl) bioEditEl.value = currentUser.bio || '';
  if (emailEl) emailEl.value = currentUser.email || '';

  if (emailStatusEl && currentUser.email) {
    if (currentUser.emailVerified) {
      emailStatusEl.innerHTML = '✅ 已验证';
      emailStatusEl.style.color = '#27ae60';
    } else {
      emailStatusEl.innerHTML = '⚠️ 未验证 <a href="#" onclick="bindEmail();return false" style="color:#e74c6f">重新发送</a>';
      emailStatusEl.style.color = '#ff9500';
    }
  }

  showModal('profileModal');
}
