const express = require('express');
const { createApp } = require('@waline/server');
const { put, get } = require('@vercel/blob');
const fs = require('fs').promises;

const app = express();
app.use(express.json({ limit: '1mb' }));

// 初始化数据库
async function initDb() {
  const dbPath = '/tmp/waline.db';
  try {
    const { blob } = await get('waline.db');
    if (blob) {
      await fs.writeFile(dbPath, Buffer.from(await blob.arrayBuffer()));
      console.log('Restored DB from Vercel Blob');
    }
  } catch (e) {
    console.log('No existing DB, creating new one');
  }
}

// 同步数据库到Blob
async function syncDb() {
  const dbPath = '/tmp/waline.db';
  try {
    if (await fs.access(dbPath).then(() => true).catch(() => false)) {
      const data = await fs.readFile(dbPath);
      await put('waline.db', data, { access: 'public' });
      console.log('Synced DB to Vercel Blob');
    }
  } catch (e) {
    console.error('Sync DB error:', e);
  }
}

// 初始化
initDb().then(() => {
  const waline = createApp({
    storage: 'sqlite',
    sqlite: { databasePath: '/tmp/waline.db' },
    secureDomains: process.env.SECURE_DOMAINS?.split(',') || ['myblog.example.com']
  });

  app.use((req, res, next) => {
    console.log('Request:', req.method, req.url, req.body);
    if (req.body && !req.body.path && req.body.url) {
      req.body.path = new URL(req.body.url).pathname || '/default';
    }
    next();
  });

  app.use('/', waline);

  // 每次请求后同步DB
  app.use(async (req, res, next) => {
    await syncDb();
    next();
  });

  app.get('/test', (req, res) => res.json({ status: 'ok' }));

  app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ error: 'Server Error', details: err.message });
  });

  module.exports = app;
});
