require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// 名片編輯器
app.get('/card-editor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'card-editor.html'));
});

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '2008927075';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || 'e7e6ec0d47b394f5b24b1795a0d776da';
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://line-login-system.zeabur.app/callback';

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

// 首頁
app.get('/', (req, res) => {
  res.send('<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>浩茂AI - LINE 登入</title><style>* { margin: 0; padding: 0; box-sizing: border-box; }body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #302b63 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; }.container { background: white; padding: 2rem; border-radius: 16px; text-align: center; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }.logo { font-size: 3rem; margin-bottom: 1rem; }h1 { color: #1a1a2e; margin-bottom: 0.5rem; }p { color: #666; margin-bottom: 1.5rem; }.line-btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 1rem; background: #06C755; color: white; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; text-decoration: none; }</style></head><body><div class="container"><div class="logo">👾</div><h1>浩茂AI</h1><p>用 LINE 帳號登入</p><a href="https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=' + LINE_CHANNEL_ID + '&redirect_uri=' + encodeURIComponent(CALLBACK_URL) + '&scope=openid%20profile&state=' + uuidv4() + '" class="line-btn">LINE 登入</a></div></body></html>');
});

// 管理員登入頁面
app.get('/admin-login', (req, res) => {
  res.send('<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>管理員登入</title><style>body { font-family: sans-serif; background: linear-gradient(135deg, #1a1a2e, #302b63); min-height: 100vh; display: flex; justify-content: center; align-items: center; }.box { background: white; padding: 2rem; border-radius: 12px; width: 300px; }input { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 6px; }button { width: 100%; padding: 10px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; }</style></head><body><div class="box"><h2>管理員登入</h2><form><input type="text" id="u" placeholder="帳號"><input type="password" id="p" placeholder="密碼"><button type="button" onclick="login()">登入</button></form></div><script>function login(){if(document.getElementById("u").value==="admin"&&document.getElementById("p").value==="haomao123"){window.location.href="/' + ADMIN_PATH + '";}else{alert("錯誤");}}</script></body></html>');
});

// LINE Callback
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('登入失敗');

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
      user = { id: uuidv4(), lineId: userId, displayName: displayName, pictureUrl: pictureUrl, allowed: false, createdAt: new Date().toISOString() };
      users.push(user);
      saveUsers(users);
    }

    if (!user.allowed) {
      return res.send('<h1>等待審核中</h1><p>請聯繫管理員開通權限</p><a href="/">回首頁</a>');
    }

    const cards = getCards();
    const userCard = cards.find(c => c.lineId === userId);

    if (userCard) {
      // 有名片 → 重新導向名片編輯器，並帶上 userId
      res.send('<html><head><meta charset="UTF-8"><title>登入成功</title><script>window.location.href="/card-editor?userId=' + userId + '";</script></head><body><p>登入成功，跳轉中...</p></body></html>');
    } else {
      // 沒有名片 → 導向名片編輯器讓他建立，並帶上 userId
      res.send('<html><head><meta charset="UTF-8"><title>建立名片</title><script>window.location.href="/card-editor?userId=' + userId + '";</script></head><body><p>即將跳轉到名片編輯器...</p></body></html>');
    }
  } catch (err) {
    res.send('登入失敗');
  }
});

// 簡化的管理員頁面 - 直接用伺服器渲染
app.get('/' + ADMIN_PATH, (req, res) => {
  const users = getUsers();
  const cards = getCards();
  
  let html = '<html><head><meta charset="UTF-8"><title>用戶管理</title><style>';
  html += 'body{font-family:sans-serif;background:#f5f5f5;padding:20px;}';
  html += 'h1{color:#1a1a2e;}';
  html += 'table{width:100%;background:white;border-collapse:collapse;margin-bottom:30px;}';
  html += 'th,td{padding:10px;border:1px solid #ddd;text-align:left;}';
  html += 'th{background:#667eea;color:white;}';
  html += 'a{text-decoration:none;padding:5px 10px;background:#06C755;color:white;border-radius:4px;}';
  html += 'a.dis{background:#ff4757;}';
  html += '</style></head><body>';
  html += '<h1>用戶列表 (' + users.length + ')</h1>';
  html += '<table><tr><th>名稱</th><th>ID</th><th>狀態</th><th>操作</th></tr>';

  for (const u of users) {
    const action = u.allowed 
      ? '<a href="/api/users/toggle?lineId=' + u.lineId + '&allowed=false" class="dis">停用</a>'
      : '<a href="/api/users/toggle?lineId=' + u.lineId + '&allowed=true">開通</a>';
    html += '<tr><td>' + u.displayName + '</td><td>' + u.lineId + '</td><td>' + (u.allowed ? '已開通' : '審核中') + '</td><td>' + action + '</td></tr>';
  }
  html += '</table>';
  
  html += '<h1>名片列表 (' + cards.length + ')</h1>';
  html += '<table><tr><th>名稱</th><th>職稱</th><th>公司</th></tr>';
  
  for (const c of cards) {
    const u = users.find(x => x.lineId === c.lineId);
    html += '<tr><td>' + (u ? u.displayName : '-') + '</td><td>' + (c.title || '-') + '</td><td>' + (c.company || '-') + '</td></tr>';
  }
  html += '</table>';
  
  html += '<p><a href="/">回首頁</a></p>';
  html += '</body></html>';
  
  res.send(html);
});

app.get('/admin', (req, res) => {
  res.redirect('/admin-login');
});

// API
app.get('/api/users', (req, res) => res.json(getUsers()));
app.get('/api/users/toggle', (req, res) => {
  const { lineId, allowed } = req.query;
  const users = getUsers();
  const user = users.find(u => u.lineId === lineId);
  if (user) { user.allowed = (allowed === 'true'); saveUsers(users); }
  res.redirect('/' + ADMIN_PATH);
});
app.post('/api/users/toggle', (req, res) => {
  const { lineId, allowed } = req.body;
  const users = getUsers();
  const user = users.find(u => u.lineId === lineId);
  if (user) { user.allowed = allowed; saveUsers(users); }
  res.json({ success: true });
});
app.post('/api/users/delete', (req, res) => {
  const { lineId } = req.body;
  saveUsers(getUsers().filter(u => u.lineId !== lineId));
  res.json({ success: true });
});

app.get('/api/cards', (req, res) => res.json(getCards()));
app.post('/api/cards', (req, res) => {
  const { lineId, title, company } = req.body;
  const cards = getCards();
  const index = cards.findIndex(c => c.lineId === lineId);
  if (index >= 0) cards[index] = { lineId, title, company };
  else cards.push({ lineId, title, company });
  saveCards(cards);
  res.json({ success: true });
});
app.post('/api/cards/delete', (req, res) => {
  saveCards(getCards().filter(c => c.lineId !== req.body.lineId));
  res.json({ success: true });
});

// 儲存 Flex JSON 名片
app.post('/api/cards/save-flex', (req, res) => {
  const { lineId, flexJson } = req.body;
  
  if (!lineId) {
    res.json({ success: false, error: '缺少用戶 ID' });
    return;
  }
  
  const cards = getCards();
  const index = cards.findIndex(c => c.lineId === lineId);
  
  const card = { 
    lineId: lineId, 
    flexJson: flexJson,
    updatedAt: new Date().toISOString()
  };
  
  if (index >= 0) {
    cards[index] = { ...cards[index], ...card };
  } else {
    cards.push(card);
  }
  
  saveCards(cards);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
