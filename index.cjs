const express = require('express');
const { createApp } = require('@waline/server');

const app = express();

// 解析JSON请求
app.use(express.json({ limit: '1mb' }));

// 调试：打印请求信息
app.use((req, res, next) => {
  console.log('Request:', req.method, req.url, req.body);
  // 强制修复path undefined
  if (req.body && !req.body.path && req.body.url) {
    req.body.path = new URL(req.body.url).pathname || '/default';
  }
  next();
});

// 初始化Waline
const waline = createApp({
  storage: 'github',
  github: {
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    token: process.env.GITHUB_TOKEN
  },
  secureDomains: process.env.SECURE_DOMAINS?.split(',') || ['myblog.example.com']
});

// 挂载Waline路由
app.use('/', waline);

// 测试路由
app.get('/test', (req, res) => res.json({ status: 'ok' }));

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Server Error', details: err.message });
});

module.exports = app;
