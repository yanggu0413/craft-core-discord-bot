import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Craft-Core",
  description: "Craft-Core 官方玩家指南與指令手冊",
  cleanUrls: false,
  head: [
    ['link', { rel: 'icon', href: '/favicon.png' }]
  ],
  themeConfig: {
    logo: '/favicon.png',
    nav: [
      { text: '首頁', link: '/' },
      { text: '玩家指南', link: '/README.html' }
    ],
    sidebar: [
      {
        text: '系統介紹',
        items: [
          { text: '關於 Craft-Core 伺服器', link: '/README.html' }
        ]
      },
      {
        text: '遊戲玩法與指南',
        items: [
          { text: '/menu 選單大廳指南', link: '/Mc-Menu-System.html' },
          { text: '箱子商店與全服市場', link: '/Mc-Shop-System.html' },
          { text: '實體銀行支票系統', link: '/Mc-Cheque-System.html' },
          { text: '虛擬快遞箱系統', link: '/Mc-Virtual-Express.html' },
          { text: '箱子密碼鎖保險箱', link: '/Mc-Lockbox-Gui.html' },
          { text: '領地保護與極致防爆', link: '/Mc-Claim-Entity-Protection.html' },
          { text: 'PvP 和平與戰鬥模式', link: '/Mc-Pvp-System.html' },
          { text: '野外定向尋寶雷達', link: '/Mc-Treasure-Hunt.html' },
          { text: '玩家轉帳與傳送指令', link: '/Mc-Teleport-Commands.html' },
          { text: '每日簽到與轉盤抽獎', link: '/Mc-Hourly-Lottery.html' },
          { text: '每日任務與全服懸賞', link: '/Mc-Task-System.html' },
          { text: '機器認證與免領地費', link: '/Mc-Machine-Certification.html' },
          { text: '假人助手與背包看管', link: '/Mc-Fake-Player.html' },
          { text: '/invsee 背包查看管理', link: '/Mc-InvSee-System.html' },
          { text: '頭頂炫彩稱號系統', link: '/Mc-Custom-Titles.html' },
          { text: '迎賓小提示列表', link: '/Mc-Welcome-Tips.html' },
          { text: '管理員權限與維護', link: '/Mc-Admin-Management.html' }
        ]
      },
      {
        text: '社群連動',
        items: [
          { text: 'Discord 帳號綁定教學', link: '/Discord-Integration.html' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'discord', link: 'https://discord.gg/XJZZwG7jR4' }
    ]
  }
})
