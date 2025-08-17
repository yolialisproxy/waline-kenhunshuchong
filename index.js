const Waline = require('@waline/vercel');
module.exports = Waline();

const express = require('express');
const { createApp } = require('@waline/server');
const { put, get } = require('@vercel/blob');
const fs = require('fs').promises;

const app = express();
app.use(express.json({ limit: '1mb' }));

// 调试请求
app.use((req, res, next) => {
  console.log('Request:', req.method, req.url, req.body);
  next();
});

// 测试路由（优先注册）
app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'Express is working' });
});

// 初始化数据库
async function initDb() {
  const dbPath = '/tmp/waline.db';
  try {
    const { blob } = await get('waline.db', { access: 'public' });
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
}

// 同步数据库到 Blob
async function syncDb() {
  const dbPath = '/tmp/waline.db';
  try {
    if (await fs.access(dbPath).then(() => true).catch(() => false)) {
      const data = await fs.readFile(dbPath);
      await put('waline.db', data, { access: 'public' });
      console.log('Synced DB to Vercel Blob');
    }
  } catch (e) {
    console.error('Sync DB error:', e.message);
  }
}

// 初始化 Waline
async function startWaline() {
  await initDb();
  try {
    const waline = createApp({
      storage: 'sqlite',
      sqlite: { databasePath: '/tmp/waline.db' },
      secureDomains: process.env.SECURE_DOMAINS?.split(',') || ['myblog.example.com']
    });
    app.use('/', waline);
    console.log('Waline initialized successfully');
  } catch (err) {
    console.error('Waline init failed:', err.message);
    app.use((req, res) => res.status(500).json({ error: 'Waline not initialized', details: err.message }));
  }
  app.use(async (req, res, next) => {
    await syncDb();
    next();
  });
}

// 启动
startWaline().catch(err => {
  console.error('Waline startup failed:', err.message);
  app.use((req, res) => res.status(500).json({ error: 'Waline startup failed', details: err.message }));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Server Error', details: err.message });
});

module.exports = app;
