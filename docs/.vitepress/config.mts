import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "CraftCoreShop",
  description: "CraftCoreShop 官方說明文件",
  themeConfig: {
    nav: [
      { text: '首頁', link: '/' },
      { text: '指南', link: '/README' }
    ],
    sidebar: [
      {
        text: '📖 系統介紹',
        items: [
          { text: 'CraftCoreShop 介紹', link: '/README' }
        ]
      },
      {
        text: '📦 箱子商店系統',
        items: [
          { text: '第一篇：商店建立與設定', link: '/Shop-Creation' },
          { text: '第二篇：買家交易與預約', link: '/Shop-Transaction' },
          { text: '第三篇：賣家管理與更名', link: '/Shop-Management' }
        ]
      },
      {
        text: '🛡️ 領地防護與密碼箱',
        items: [
          { text: '安全系統：領地與密碼鎖', link: '/Claims-Lockboxes' }
        ]
      },
      {
        text: '⚖️ 自由市場與回收機制',
        items: [
          { text: '第四篇：回收與限額機制', link: '/Economy-Recycle' },
          { text: '第五篇：市場均價與趨勢', link: '/Market-Analytics' },
          { text: '網頁版：網頁儀表板使用與管理', link: '/Web-Dashboard' }
        ]
      },
      {
        text: '🛠️ 管理員與連動指南',
        items: [
          { text: '第六篇：管理員與指令手冊', link: '/Admin-Manual' },
          { text: '機器人：Discord 機器人連動', link: '/Discord-Integration' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'discord', link: 'https://discord.gg/' }
    ]
  }
})
