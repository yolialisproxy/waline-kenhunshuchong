const express = require('express');
const { createApp } = require('@waline/server');

const app = express();
app.use(express.json());
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
  console.error(err.stack);
  res.status(500).json({ error: 'Server Error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Waline server running on port ${port}`);
});
