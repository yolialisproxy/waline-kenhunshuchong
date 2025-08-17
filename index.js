const express = require('express');
const { createApp } = require('@waline/server');

const app = express();
app.use(express.json({ limit: '1mb' })); // 解析JSON请求，设置1MB限制
app.use((req, res, next) => {
  console.log('Request Body:', req.body); // 调试：打印请求Body
  next();
});

const waline = createApp({
  storage: 'github',
  github: {
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    token: process.env.GITHUB_TOKEN
  },
  secureDomains: process.env.SECURE_DOMAINS?.split(',') || ['myblog.example.com']
});

app.use(waline);

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Server Error', details: err.message });
});

module.exports = app; // Vercel Serverless
