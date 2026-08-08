export interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  depends: string[];
  recommends: string[];
  entrypoint: string;
}

export const SITE_NAME = "Craft-Core";
export const SITE_TAGLINE = "Minecraft Fabric 模組化伺服器生態系統";

export const IS_BETA = true;
export const BETA_LABEL = "公測版 (Beta)";
export const BETA_NOTICE =
  "此為公測版本，可能含有錯誤或不完整功能；如有任何錯誤，作者／開發團隊不承擔任何責任。";
