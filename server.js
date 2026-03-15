require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// 設定
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '2008927075';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || 'e7e6ec0d47b394f5b24b1795a0d776da';
const LIFF_ID = process.env.LIFF_ID || '2008927075-RmILZFtb';
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://your-app.zeabur.app/callback';

// 簡單的資料庫（用 JSON 檔案）
const DB_FILE = path.join(__dirname, 'users.json');

// 讀取/初始化資料庫
function getUsers() {
  if (!fs.existsSync(DB_FILE)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// 首頁
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>浩茂AI - LINE 登入</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #302b63 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 16px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    }
    .logo {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h1 {
      color: #1a1a2e;
      margin-bottom: 0.5rem;
    }
    p {
      color: #666;
      margin-bottom: 1.5rem;
    }
    .line-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 1rem;
      background: #06C755;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: bold;
      cursor: pointer;
      text-decoration: none;
      transition: transform 0.2s;
    }
    .line-btn:hover {
      transform: scale(1.02);
    }
    .admin-link {
      display: block;
      margin-top: 1rem;
      color: #999;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">👾</div>
    <h1>浩茂AI</h1>
    <p>用 LINE 帳號登入</p>
    <a href="https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_CHANNEL_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=openid%20profile&state=${uuidv4()}" class="line-btn">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-6h-2v6zm0-8h2V7h-2v2z"/></svg>
      LINE 登入
    </a>
    <a href="/admin" class="admin-link">管理員登入</a>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@line/liff@2.1.1/dist/liff.min.js"></script>
  <script>
    // 可以加入 LIFF 初始化
  </script>
</body>
</html>
  `);
});

// LINE Callback
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.send('登入失敗：' + error);
  }

  try {
    // 兌換 access token
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

    const { access_token } = tokenResponse.data;

    // 取得用戶資料
    const profileResponse = await axios.get('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { userId, displayName, pictureUrl } = profileResponse.data;

    // 檢查用戶是否存在
    const users = getUsers();
    let user = users.find(u => u.lineId === userId);

    if (!user) {
      // 新用戶
      user = {
        id: uuidv4(),
        lineId: userId,
        displayName: displayName,
        pictureUrl: pictureUrl || '',
        allowed: false,  // 預設需要審核
        createdAt: new Date().toISOString()
      };
      users.push(user);
      saveUsers(users);
    }

    // 檢查是否允許登入
    if (!user.allowed) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>等待審核</title>
          <style>
            body { font-family: sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; height: 100vh; }
            .box { background: white; padding: 2rem; border-radius: 12px; text-align: center; }
            h1 { color: #667eea; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>⏳ 等待審核中</h1>
            <p>您的帳號正在審核中，請聯繫管理員開通權限。</p>
            <a href="/">回首頁</a>
          </div>
        </body>
        </html>
      `);
    }

    // 登入成功
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>登入成功</title>
        <style>
          body { font-family: sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; height: 100vh; }
          .box { background: white; padding: 2rem; border-radius: 12px; text-align: center; }
          h1 { color: #06C755; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>✅ 登入成功</h1>
          <p>歡迎回來，${displayName}！</p>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error(err);
    res.send('登入失敗，請重試');
  }
});

// 管理員頁面
app.get('/admin', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>用戶管理 - 浩茂AI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #1a1a2e, #302b63); color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .container { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
    .card { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
    .btn-allow { background: #06C755; color: white; }
    .btn-disallow { background: #ff4757; color: white; }
    .btn-delete { background: #666; color: white; }
    .status-allowed { color: #06C755; font-weight: bold; }
    .status-pending { color: #ffa502; font-weight: bold; }
    img { width: 40px; height: 40px; border-radius: 50%; }
    .empty { text-align: center; padding: 2rem; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <h1>👾 用戶管理</h1>
    <span>浩茂AI 後台</span>
  </div>
  <div class="container">
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>頭像</th>
            <th>名稱</th>
            <th>LINE ID</th>
            <th>狀態</th>
            <th>註冊時間</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="userList">
          <tr><td colspan="6" class="empty">載入中...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <script>
    async function loadUsers() {
      const res = await fetch('/api/users');
      const users = await res.json();
      const tbody = document.getElementById('userList');
      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">尚有用戶</td></tr>';
        return;
      }
      tbody.innerHTML = users.map(u => \`
        <tr>
          <td>\${u.pictureUrl ? '<img src="' + u.pictureUrl + '">' : '👤'}</td>
          <td>\${u.displayName}</td>
          <td><code>\${u.lineId}</code></td>
          <td class="\${u.allowed ? 'status-allowed' : 'status-pending'}">\${u.allowed ? '✅ 已開通' : '⏳ 審核中'}</td>
          <td>\${new Date(u.createdAt).toLocaleString()}</td>
          <td>
            \${u.allowed 
              ? '<button class="btn btn-disallow" onclick="toggleUser(\\'' + u.lineId + '\\', false)">停用</button>' 
              : '<button class="btn btn-allow" onclick="toggleUser(\\'' + u.lineId + '\\', true)">開通</button>'}
            <button class="btn btn-delete" onclick="deleteUser(\\'' + u.lineId + '\\')">刪除</button>
          </td>
        </tr>
      \`).join('');
    }
    
    async function toggleUser(lineId, allowed) {
      await fetch('/api/users/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId, allowed })
      });
      loadUsers();
    }
    
    async function deleteUser(lineId) {
      if (!confirm('確定要刪除此用戶嗎？')) return;
      await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId })
      });
      loadUsers();
    }
    
    loadUsers();
  </script>
</body>
</html>
  `);
});

// API: 取得用戶列表
app.get('/api/users', (req, res) => {
  res.json(getUsers());
});

// API: 切換用戶權限
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

// API: 刪除用戶
app.post('/api/users/delete', (req, res) => {
  const { lineId } = req.body;
  const users = getUsers().filter(u => u.lineId !== lineId);
  saveUsers(users);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
});
