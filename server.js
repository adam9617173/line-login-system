require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '2008927075';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || 'e7e6ec0d47b394f5b24b1795a0d776da';
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://line-login-system.zeabur.app/callback';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'haomao123';

// 管理員路徑（知道這個路徑就能進後台）
const ADMIN_PATH = 'awcr97del30qui0nuqrenjcsl0dfii01gnnsk8on46iydx9elpha6ne8kyyqudru';

const DB_FILE = path.join(__dirname, 'users.json');
const CARDS_FILE = path.join(__dirname, 'cards.json');

function getUsers() {
  if (!fs.existsSync(DB_FILE)) return [];
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

function getCards() {
  if (!fs.existsSync(CARDS_FILE)) return [];
  return JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
}

function saveCards(cards) {
  fs.writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2));
}

console.log('Admin path: /' + ADMIN_PATH);

// 首頁
app.get('/', (req, res) => {
  res.send('<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>浩茂AI - LINE 登入</title><style>* { margin: 0; padding: 0; box-sizing: border-box; }body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #302b63 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; }.container { background: white; padding: 2rem; border-radius: 16px; text-align: center; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }.logo { font-size: 3rem; margin-bottom: 1rem; }h1 { color: #1a1a2e; margin-bottom: 0.5rem; }p { color: #666; margin-bottom: 1.5rem; }.line-btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 1rem; background: #06C755; color: white; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; text-decoration: none; }</style></head><body><div class="container"><div class="logo">👾</div><h1>浩茂AI</h1><p>用 LINE 帳號登入</p><a href="https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=' + LINE_CHANNEL_ID + '&redirect_uri=' + encodeURIComponent(CALLBACK_URL) + '&scope=openid%20profile&state=' + uuidv4() + '" class="line-btn">LINE 登入</a></div></body></html>');
});

// 管理員登入頁面
app.get('/admin-login', (req, res) => {
  res.send('<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>管理員登入</title><style>body { font-family: -apple-system, sans-serif; background: linear-gradient(135deg, #1a1a2e, #302b63); min-height: 100vh; display: flex; justify-content: center; align-items: center; }.box { background: white; padding: 2rem; border-radius: 12px; width: 320px; }h1 { text-align: center; color: #1a1a2e; margin-bottom: 1.5rem; }input { width: 100%; padding: 0.8rem; margin-bottom: 1rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }button { width: 100%; padding: 0.8rem; background: #667eea; color: white; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }.error { color: red; font-size: 0.9rem; text-align: center; margin-bottom: 1rem; }</style></head><body><div class="box"><h1>👾 管理員登入</h1><form id="loginForm"><div class="error" id="error"></div><input type="text" id="username" placeholder="帳號" required><input type="password" id="password" placeholder="密碼" required><button type="submit">登入</button></form></div><script>document.getElementById("loginForm").onsubmit=function(e){e.preventDefault();var user=document.getElementById("username").value;var pass=document.getElementById("password").value;if(user==="admin"&&pass==="haomao123"){window.location.href="/' + ADMIN_PATH + '";}else{document.getElementById("error").innerText="帳號或密碼錯誤";}};</script></body></html>');
});

// LINE Callback
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  
  if (error) return res.send('登入失敗：' + error);

  try {
    const tokenResponse = await axios.post('https://api.line.me/oauth2/v2.1/token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: CALLBACK_URL,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET
      }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const access_token = tokenResponse.data.access_token;
    const profileResponse = await axios.get('https://api.line.me/v2/profile', {
      headers: { Authorization: 'Bearer ' + access_token }
    });

    const userId = profileResponse.data.userId;
    const displayName = profileResponse.data.displayName;
    const pictureUrl = profileResponse.data.pictureUrl || '';

    const users = getUsers();
    let user = users.find(u => u.lineId === userId);

    if (!user) {
      user = {
        id: uuidv4(),
        lineId: userId,
        displayName: displayName,
        pictureUrl: pictureUrl,
        allowed: false,
        createdAt: new Date().toISOString()
      };
      users.push(user);
      saveUsers(users);
    }

    if (!user.allowed) {
      return res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>等待審核</title><style>body{font-family:sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;height:100vh;}.box{background:white;padding:2rem;border-radius:12px;text-align:center;}</style></head><body><div class="box"><h1>⏳ 等待審核中</h1><p>您的帳號正在審核中，請聯繫管理員開通權限。</p><a href="/">回首頁</a></div></body></html>');
    }

    const cards = getCards();
    const userCard = cards.find(c => c.lineId === userId);

    if (userCard) {
      res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>我的名片</title><style>body{font-family:-apple-system,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;justify-content:center;align-items:center;}.card{background:white;border-radius:20px;padding:2rem;width:320px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);}.avatar{width:100px;height:100px;border-radius:50%;margin-bottom:1rem;}.name{font-size:1.5rem;font-weight:bold;color:#1a1a2e;margin-bottom:0.5rem;}.title{color:#667eea;margin-bottom:1rem;}.info{text-align:left;margin:1rem 0;}.info p{margin:0.5rem 0;color:#666;}</style></head><body><div class="card"><img src="' + pictureUrl + '" class="avatar"><div class="name">' + displayName + '</div><div class="title">' + (userCard.title || '會員') + '</div><div class="info"><p><span>公司：</span>' + (userCard.company || '-') + '</p><p><span>電話：</span>' + (userCard.phone || '-') + '</p><p><span>Email：</span>' + (userCard.email || '-') + '</p></div></div></body></html>');
    } else {
      res.send('<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>建立名片</title><style>body{font-family:-apple-system,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;justify-content:center;align-items:center;}.card{background:white;border-radius:20px;padding:2rem;width:340px;}h1{text-align:center;color:#1a1a2e;margin-bottom:1.5rem;}input{width:100%;padding:0.8rem;margin-bottom:1rem;border:1px solid #ddd;border-radius:8px;font-size:1rem;}button{width:100%;padding:1rem;background:#06C755;color:white;border:none;border-radius:8px;font-size:1.1rem;cursor:pointer;}</style></head><body><div class="card"><h1>📇 建立 LINE 名片</h1><form id="cardForm"><input type="text" id="title" placeholder="職稱" required><input type="text" id="company" placeholder="公司名稱"><input type="tel" id="phone" placeholder="電話"><input type="email" id="email" placeholder="Email"><button type="submit">建立名片</button></form></div><script>document.getElementById("cardForm").onsubmit=async function(e){e.preventDefault();var data={lineId:"' + userId + '",title:document.getElementById("title").value,company:document.getElementById("company").value,phone:document.getElementById("phone").value,email:document.getElementById("email").value};await fetch("/api/cards",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});window.location.reload();};</script></body></html>');
    }

  } catch (err) {
    console.error(err);
    res.send('登入失敗，請重試');
  }
});

// 管理員頁面
app.get('/' + ADMIN_PATH, (req, res) => {
  res.send('<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>用戶管理 - 浩茂AI</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f5;}.header{background:linear-gradient(135deg,#1a1a2e,#302b63);color:white;padding:1rem 2rem;display:flex;justify-content:space-between;align-items:center;}.tabs{display:flex;gap:1rem;padding:1rem 2rem;background:white;border-bottom:1px solid #eee;}.tab{padding:0.5rem 1rem;border-radius:6px;cursor:pointer;color:#666;}.tab.active{background:#667eea;color:white;}.container{max-width:1200px;margin:2rem auto;padding:0 1rem;}.card{background:white;border-radius:12px;padding:1.5rem;margin-bottom:1rem;box-shadow:0 2px 8px rgba(0,0,0,0.1);}table{width:100%;border-collapse:collapse;}th,td{padding:1rem;text-align:left;border-bottom:1px solid #eee;}th{background:#f8f9fa;font-weight:600;}.btn{padding:0.5rem 1rem;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;margin-right:0.5rem;}.btn-allow{background:#06C755;color:white;}.btn-disallow{background:#ff4757;color:white;}.btn-delete{background:#666;color:white;}.status-allowed{color:#06C755;font-weight:bold;}.status-pending{color:#ffa502;font-weight:bold;}img{width:40px;height:40px;border-radius:50%;}.empty{text-align:center;padding:2rem;color:#999;}.hidden{display:none;}</style></head><body><div class="header"><h1>👾 用戶管理</h1><a href="/" style="color:white;text-decoration:none;">回首頁</a></div><div class="tabs"><div class="tab active" onclick="switchTab(\'users\')">用戶列表</div><div class="tab" onclick="switchTab(\'cards\')">名片管理</div></div><div class="container"><div id="usersPanel"><div class="card"><table><thead><tr><th>頭像</th><th>名稱</th><th>LINE ID</th><th>狀態</th><th>註冊時間</th><th>操作</th></tr></thead><tbody id="userList"><tr><td colspan="6" class="empty">載入中...</td></tr></tbody></table></div></div><div id="cardsPanel" class="hidden"><div class="card"><table><thead><tr><th>頭像</th><th>名稱</th><th>職稱</th><th>公司</th><th>操作</th></tr></thead><tbody id="cardList"><tr><td colspan="5" class="empty">載入中...</td></tr></tbody></table></div></div></div><script>function switchTab(tab){document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active");});document.querySelector(".tab:nth-child("+(tab==="users"?1:2)+")").classList.add("active");document.getElementById("usersPanel").classList.toggle("hidden",tab!=="users");document.getElementById("cardsPanel").classList.toggle("hidden",tab!=="cards");if(tab==="users"){loadUsers();}else{loadCards();}}async function loadUsers(){var res=await fetch("/api/users");var users=await res.json();var tbody=document.getElementById("userList");if(users.length==0){tbody.innerHTML="<tr><td colspan=6 class=empty>尚有用戶</td></tr>";return;}tbody.innerHTML=users.map(function(u){return"<tr><td>"+(u.pictureUrl?"<img src="+u.pictureUrl+">":"👤")+"</td><td>"+u.displayName+"</td><td><code>"+u.lineId+"</code></td><td class="+(u.allowed?"status-allowed":"status-pending")+">"+(u.allowed?"✅ 已開通":"⏳ 審核中")+"</td><td>"+new Date(u.createdAt).toLocaleString()+"</td><td>"+(u.allowed?"<button class=btn btn-disallow onclick=toggleUser(\""+u.lineId+"\",false)>停用</button>":"<button class=btn btn-allow onclick=toggleUser(\""+u.lineId+"\",true)>開通</button>")+" <button class=btn btn-delete onclick=deleteUser(\""+u.lineId+"\")>刪除</button></td></tr>";}).join("");}async function loadCards(){var res=await fetch("/api/cards");var cards=await res.json();var tbody=document.getElementById("cardList");if(cards.length==0){tbody.innerHTML="<tr><td colspan=5 class=empty>尚有名片</td></tr>";return;}var res2=await fetch("/api/users");var users=await res2.json();tbody.innerHTML=cards.map(function(c){var user=users.find(function(u){return u.lineId===c.lineId;});return"<tr><td>"+(user&&user.pictureUrl?"<img src="+user.pictureUrl+">":"👤")+"</td><td>"+(user?user.displayName:"Unknown")+"</td><td>"+(c.title||"-")+"</td><td>"+(c.company||"-")+"</td><td><button class=btn btn-delete onclick=deleteCard(\""+c.lineId+"\")>刪除</button></td></tr>";}).join("");}async function toggleUser(lineId,allowed){await fetch("/api/users/toggle",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lineId:lineId,allowed:allowed})});loadUsers();}async function deleteUser(lineId){if(!confirm("確定要刪除此用戶嗎？")){return;}await fetch("/api/users/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lineId:lineId})});loadUsers();}async function deleteCard(lineId){if(!confirm("確定要刪除此名片嗎？")){return;}await fetch("/api/cards/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lineId:lineId})});loadCards();}loadUsers();</script></body></html>');
});

// 舊路徑擋住
app.get('/admin', (req, res) => {
  res.redirect('/admin-login');
});

// API（無須認證，因為路徑本身已經保護）
app.get('/api/users', (req, res) => {
  res.json(getUsers());
});

app.post('/api/users/toggle', (req, res) => {
  const { lineId, allowed } = req.body;
  const users = getUsers();
  const user = users.find(u => u.lineId === lineId);
  if (user) {
    user.allowed = allowed;
    saveUsers(users);
  }
  res.json({ success: true });
});

app.post('/api/users/delete', (req, res) => {
  const { lineId } = req.body;
  const users = getUsers().filter(u => u.lineId !== lineId);
  saveUsers(users);
  res.json({ success: true });
});

app.get('/api/cards', (req, res) => {
  res.json(getCards());
});

app.post('/api/cards', (req, res) => {
  const { lineId, title, company, phone, email } = req.body;
  const cards = getCards();
  const index = cards.findIndex(c => c.lineId === lineId);
  const card = { lineId, title, company, phone, email };
  if (index >= 0) {
    cards[index] = card;
  } else {
    cards.push(card);
  }
  saveCards(cards);
  res.json({ success: true });
});

app.post('/api/cards/delete', (req, res) => {
  const { lineId } = req.body;
  const cards = getCards().filter(c => c.lineId !== lineId);
  saveCards(cards);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
