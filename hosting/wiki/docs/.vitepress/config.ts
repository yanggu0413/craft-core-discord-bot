import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Craft-Core Hosting Docs',
  description: 'Craft-Core Hosting 官方開發者技術手冊',
  lastUpdated: true,
  cleanUrls: true,
  themeConfig: {
    siteTitle: 'Craft-Core Hosting Docs',
    nav: [
      { text: '首頁', link: '/' },
      { text: '快速上手', link: '/getting-started' },
      { text: '系統架構', link: '/architecture' },
      { text: 'REST API', link: '/api' },
      { text: 'GitHub CI/CD', link: '/github' },
      { text: 'AI MCP', link: '/mcp' },
      { text: '故障排查', link: '/troubleshooting' },
    ],
    sidebar: [
      {
        text: '入門與指南',
        items: [
          { text: '平台概覽', link: '/' },
          { text: '快速上手指南', link: '/getting-started' },
        ],
      },
      {
        text: '系統架構',
        items: [
          { text: '容器隔離與配額機制', link: '/architecture' },
        ],
      },
      {
        text: '開發者 API',
        items: [
          { text: 'REST API 參考手冊', link: '/api' },
          { text: 'GitHub Webhook CI/CD', link: '/github' },
          { text: 'AI MCP 伺服器整合', link: '/mcp' },
        ],
      },
      {
        text: '維運與排錯',
        items: [
          { text: '常見問題與故障診斷', link: '/troubleshooting' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/craft-core' },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Craft-Core Minecraft Ecosystem Documentation',
      copyright: 'Copyright © 2026 Craft-Core Platform',
    },
  },
});
