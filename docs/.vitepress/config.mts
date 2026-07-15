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
          { text: '關於 CraftCore', link: '/README' }
        ]
      },
      {
        text: '🖥️ 網頁端儀表板',
        items: [
          { text: '網頁版首頁簡介', link: '/Web-Dashboard' },
          { text: '商店瀏覽與導航', link: '/Web-Shop-Navigation' },
          { text: '全服市場行情', link: '/Web-Market-Analytics' },
          { text: '店主遠端遙控', link: '/Web-Owner-Remote' },
          { text: '領地保護設定', link: '/Web-Claims-Management' },
          { text: '密碼箱白名單管理', link: '/Web-Password-Lock' },
          { text: '每日簽到與抽獎', link: '/Web-Welfare' },
          { text: '郵局快遞與個人背包', link: '/Web-Postal-Inventory' }
        ]
      },
      {
        text: '🎮 Minecraft 遊戲指南',
        items: [
          { text: '每日任務系統', link: '/Mc-Task-System' },
          { text: '商店系統概覽', link: '/Mc-Shop-System' },
          { text: '如何新增商店', link: '/Mc-Create-Shop' },
          { text: '如何刪除商店', link: '/Mc-Delete-Shop' },
          { text: '遊戲內傳送與 TP 指令', link: '/Mc-Teleport-Commands' },
          { text: '管理員指令與權限', link: '/Mc-Admin-Management' }
        ]
      },
      {
        text: '🤖 Discord 機器人',
        items: [
          { text: 'Discord 連動綁定', link: '/Discord-Integration' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'discord', link: 'https://discord.gg/' }
    ]
  }
})
