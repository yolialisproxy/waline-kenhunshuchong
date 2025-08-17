const express = require('express');
const Database = require('better-sqlite3');
const { put, get } = require('@vercel/blob');
const fs = require('fs').promises;
const sanitizeHtml = require('sanitize-html');

const app = express();
app.use(express.json({ limit: '1mb' }));

// 调试请求
app.use((req, res, next) => {
  console.log('Request:', req.method, req.url, req.body);
  next();
});

// 测试路由
app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'Custom Comment System is working' });
});

// 初始化数据库
async function initDb() {
  const dbPath = '/tmp/comments.db';
  try {
    const { blob } = await get('comments.db', { access: 'public' });
    if (blob) {
      await fs.writeFile(dbPath, Buffer.from(await blob.arrayBuffer()));
      console.log('Restored DB from Vercel Blob');
    } else {
      console.log('No existing DB, creating new one');
      await fs.writeFile(dbPath, Buffer.alloc(0));
    }
  } catch (e) {
    console.error('Init DB error:', e.message);
    await fs.writeFile(dbPath, Buffer.alloc(0));
  }
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nick TEXT NOT NULL,
      email TEXT NOT NULL,
      content TEXT NOT NULL,
      path TEXT NOT NULL,
      url TEXT NOT NULL,
      parent_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  return db;
}

// 同步数据库到 Blob
async function syncDb() {
  const dbPath = '/tmp/comments.db';
  try {
    if (await fs.access(dbPath).then(() => true).catch(() => false)) {
      const data = await fs.readFile(dbPath);
      await put('comments.db', data, { access: 'public' });
      console.log('Synced DB to Vercel Blob');
    }
  } catch (e) {
    console.error('Sync DB error:', e.message);
  }
}

// 验证域名
function validateDomain(url) {
  const allowedDomains = process.env.SECURE_DOMAINS?.split(',') || ['myblog.example.com'];
  try {
    const { hostname } = new URL(url);
    return allowedDomains.includes(hostname);
  } catch {
    return false;
  }
}

// 初始化
let db;
async function startServer() {
  db = await initDb();
  console.log('Database initialized successfully');
}

startServer().catch(err => {
  console.error('Server startup failed:', err.message);
  app.use((req, res) => res.status(500).json({ error: 'Server startup failed', details: err.message }));
});

// 提交评论
app.post('/comment', async (req, res) => {
  const { nick, email, comment, path, url, parent_id } = req.body;
  if (!nick || !email || !comment || !path || !url) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!validateDomain(url)) {
    return res.status(403).json({ error: 'Invalid domain' });
  }
  const cleanComment = sanitizeHtml(comment, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a'],
    allowedAttributes: { a: ['href'] }
  });
  try {
    const stmt = db.prepare(`
      INSERT INTO comments (nick, email, content, path, url, parent_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(nick, email, cleanComment, path, url, parent_id || null);
    await syncDb();
    res.json({ errno: 0, data: { id: result.lastInsertRowid } });
  } catch (err) {
    console.error('Insert comment error:', err.message);
    res.status(500).json({ error: 'Failed to save comment', details: err.message });
  }
});

// 获取评论
app.get('/comments', async (req, res) => {
  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path' });
  }
  try {
    const stmt = db.prepare(`
      SELECT id, nick, email, content, path, url, parent_id, created_at
      FROM comments
      WHERE path = ?
      ORDER BY created_at DESC
    `);
    const comments = stmt.all(path);
    res.json({ errno: 0, data: comments });
  } catch (err) {
    console.error('Fetch comments error:', err.message);
    res.status(500).json({ error: 'Failed to fetch comments', details: err.message });
  }
});

// 删除评论（管理权限）
app.delete('/comment/:id', async (req, res) => {
  const { id } = req.params;
  // TODO: 添加管理员验证（如 token）
  try {
    const stmt = db.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?');
    const result = stmt.run(id, id);
    await syncDb();
    res.json({ errno: 0, data: { changes: result.changes } });
  } catch (err) {
    console.error('Delete comment error:', err.message);
    res.status(500).json({ error: 'Failed to delete comment', details: err.message });
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Server Error', details: err.message });
});

module.exports = app;
