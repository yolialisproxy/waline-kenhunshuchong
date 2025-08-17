const express = require('express');
const { createApp } = require('@waline/server');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

// 调试请求
app.use((req, res, next) => {
  console.log('Request:', req.method, req.url, req.body);
  if (req.body && !req.body.path && req.body.url) {
    req.body.path = new URL(req.body.url).pathname || '/default';
  }
  next();
});

// 初始化Waline，SQLite存储
const waline = createApp({
  storage: 'sqlite',
  sqlite: {
    databasePath: '/tmp/waline.db' // Vercel可写目录
  },
  secureDomains: process.env.SECURE_DOMAINS?.split(',') || ['myblog.example.com']
});

app.use('/', waline);

// 测试路由
app.get('/test', (req, res) => res.json({ status: 'ok' }));

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Server Error', details: err.message });
});

module.exports = app;
