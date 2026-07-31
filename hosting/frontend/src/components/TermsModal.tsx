import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
      <Card className="max-w-3xl w-full border-2 border-primary/30 shadow-2xl bg-card overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <CardHeader className="bg-primary/5 border-b pb-4 pt-5 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold tracking-tight text-foreground">
                  Craft-Core Hosting 雲端服務使用條款、安全規範與開發者安全指南
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  歡迎使用本平台。為維護全服運作穩定與防範安全入侵，開啟本網站必須閱讀並同意以下條款
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-primary text-primary-foreground text-[10px] px-2.5 py-0.5 shrink-0">
              強制條款
            </Badge>
          </div>
        </CardHeader>

        {/* Content Body (Scrollable) */}
        <CardContent className="p-6 space-y-6 overflow-y-auto text-xs leading-relaxed font-sans">
          {/* Section 1 */}
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-foreground border-b pb-1 border-primary/20">
              第一條：服務條款之接受與適用範圍
            </h3>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>本服務條款適用於所有使用 Craft-Core Hosting 雲端託管平台（以下簡稱「本平台」）之使用者。</li>
              <li>使用者於開啟、登入或使用本平台所提供之任何服務（包含但不限於應用程式容器、一鍵託管資料庫、萬用 Docker 容器及相關網絡對外通道）時，即代表已完全閱讀、理解並無條件同意遵守本條款之所有規定。</li>
            </ol>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-destructive border-b pb-1 border-destructive/20">
              第二條：嚴格禁止事項與系統安全規範
            </h3>
            <p className="text-muted-foreground font-semibold">使用者於本平台內建立、執行或維護之所有容器與服務，嚴格禁止進行以下行為：</p>

            <div className="space-y-3 pt-1">
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15 space-y-1">
                <span className="font-bold text-foreground block">1. 伺服器入侵、越權與滲透測試防範</span>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground text-[11px]">
                  <li>嚴禁進行任何形式之 Docker 容器逃逸測試、宿主主機檔案系統越權存取、內網 IP 段或 Port 通訊埠掃描。</li>
                  <li>嚴禁利用本平台環境進行權限提升 (Privilege Escalation)、系統漏洞利用 (Exploitation) 或任何針對宿主機及其他使用者容器之攻擊行為。</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15 space-y-1">
                <span className="font-bold text-foreground block">2. 未授權通訊埠、SSH 服務與隧道內網穿透限制</span>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground text-[11px]">
                  <li>容器內部嚴禁開立 SSH 伺服器、VNC 遠端桌面、Remote Desktop 服務。</li>
                  <li>嚴禁架設或執行任何未授權之 Tunnel 隧道代理程式（包含但不限於 FRP、Ngrok、Cloudflare Tunnel、NCM）或 VPN 網絡穿透、Tor 匿名跳板節點。</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15 space-y-1">
                <span className="font-bold text-foreground block">3. 系統資源濫用、加密貨幣挖礦與流量攻擊</span>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground text-[11px]">
                  <li>嚴禁運行任何形式之加密貨幣挖礦程式 (Cryptocurrency Mining)、分散式算力網格或無意義之高佔用 CPU/記憶體無限迴圈。</li>
                  <li>嚴禁發起、參與或轉發任何形式之分散式阻斷服務攻擊 (DDoS/DoS)、UDP/TCP Flood 流量攻擊、SYN 慢速連線攻擊。</li>
                  <li>嚴禁利用本平台發送大量未經許可之垃圾電子郵件 (SPAM) 或進行大規模未授權之網路爬蟲 (Web Scraper)。</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15 space-y-1">
                <span className="font-bold text-foreground block">4. 違法內容、詐騙釣魚與智慧財產權防護</span>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground text-[11px]">
                  <li>嚴禁託管、儲存或傳播任何未經授權之版權侵權檔案、非法軟體、破解檔。</li>
                  <li>嚴禁建立詐騙釣魚網站 (Phishing)、色情暴力內容、惡意程式、木馬後門或任何違反適用法律法規之服務與網站。</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-primary border-b pb-1 border-primary/20">
              第三條：開發者資訊安全與敏感憑證防護指南
            </h3>
            <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/15 space-y-2">
              <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground text-[11px]">
                <li>
                  <strong className="text-foreground font-bold">敏感機密金鑰隔離原則 (Secrets Isolation)</strong>
                  <p className="mt-0.5">嚴禁將 API Key、Discord Bot Token、第三方 OAuth 密鑰、資料庫存取密碼或 Webhook URL 等敏感憑證直接寫死在程式碼或檔案中。所有人機機密資料一律必須透過本平台提供之「環境變數 (Environment Variables)」功能進行安全注入與隔離存取。</p>
                </li>
                <li>
                  <strong className="text-foreground font-bold">版本控制與檔案上傳安全 (Git & Upload Safety)</strong>
                  <p className="mt-0.5">使用者將專案推送到 GitHub / GitLab 儲存庫或上傳 ZIP 部署包前，務必於 <code className="bg-muted px-1 rounded">.gitignore</code> 檔案中加入 `.env` 及所有包含憑證之設定檔，確保機密資訊不會暴露於公開或私有版本庫中。</p>
                </li>
                <li>
                  <strong className="text-foreground font-bold">通訊與連線安全</strong>
                  <p className="mt-0.5">請確保對外服務連線與 API 呼叫均使用加密之 HTTPS / TLS 協定，切勿透過未加密傳輸傳送敏感使用者數據。</p>
                </li>
              </ol>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-foreground border-b pb-1 border-muted-foreground/20">
              第四條：系統稽核、安全監測與違規處置機制
            </h3>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground text-[11px]">
              <li>
                <strong className="text-foreground font-bold">實時安全監測與審計日誌</strong>：本平台配備自動化資源監控系統與管理員實時審計日誌，會針對容器運行狀態、網絡流量異常、Exec 操作及系統呼叫進行安全稽核。
              </li>
              <li>
                <strong className="text-foreground font-bold">違規強制處置權限</strong>：凡經系統自動防護機制觸發或管理員巡檢發現違規行為者，本平台有權無預警發送緊急入侵安全警告、強制停止/刪除容器，並暫停或永久封鎖違規使用者之帳號權限。
              </li>
              <li>
                <strong className="text-foreground font-bold">免責聲明</strong>：因使用者違反本安全條款導致容器被強制切斷、刪除或帳號封鎖所衍生之任何資料遺失或業務中斷損失，本平台概不承擔任何賠償責任。
              </li>
            </ol>
          </div>
        </CardContent>

        {/* Footer Action */}
        <CardFooter className="bg-muted/20 border-t p-4 flex justify-end">
          <Button
            onClick={onAccept}
            className="w-full sm:w-auto px-8 font-bold gap-2 text-sm shadow-md bg-primary hover:bg-primary/90 text-primary-foreground h-11"
          >
            <ShieldCheck className="h-4 w-4" /> 我已詳細閱讀並同意以上條款與安全規範
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
