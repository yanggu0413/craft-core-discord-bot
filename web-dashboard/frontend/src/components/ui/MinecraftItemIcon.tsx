import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface MinecraftItemIconProps {
  itemId: string;
  className?: string;
}

export default function MinecraftItemIcon({ itemId, className }: MinecraftItemIconProps) {
  const cleanId = itemId.replace('minecraft:', '').toLowerCase();
  
  // 多層級圖示來源設計：
  // 1. Owen1212055/mc-assets 提供遊戲內原生 256x256 渲染圖（與遊戲內物品欄 100% 一模一樣，包含 3D 方塊與立體壓力板）
  // 2. api.minecraftitems.xyz 輔助 3D 渲染圖
  // 3. mcasset.cloud/textures/item 2D 物品平鋪圖
  // 4. mcasset.cloud/textures/block 2D 方塊紋理圖
  const owenUrl = `https://raw.githubusercontent.com/Owen1212055/mc-assets/main/item-assets/${cleanId.toUpperCase()}.png`;
  const xyzUrl = `https://api.minecraftitems.xyz/api/item/${cleanId}`;
  const itemUrl = `https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/item/${cleanId}.png`;
  const blockUrl = `https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/block/${cleanId}.png`;
  
  const [src, setSrc] = useState(owenUrl);
  const [fallbackCount, setFallbackCount] = useState(0);

  // 當物品 ID 變更時重設狀態
  useEffect(() => {
    setSrc(owenUrl);
    setFallbackCount(0);
  }, [itemId]);

  const handleError = () => {
    if (fallbackCount === 0) {
      setSrc(xyzUrl);
      setFallbackCount(1);
    } else if (fallbackCount === 1) {
      setSrc(itemUrl);
      setFallbackCount(2);
    } else if (fallbackCount === 2) {
      setSrc(blockUrl);
      setFallbackCount(3);
    } else {
      setSrc('');
      setFallbackCount(4);
    }
  };

  if (fallbackCount === 4 || !src) {
    const displayName = cleanId.substring(0, 2).toUpperCase();
    return (
      <div className={cn("w-6 h-6 flex items-center justify-center bg-muted/60 border border-border text-[9px] font-bold text-muted-foreground font-mono rounded-[2px] shrink-0", className)}>
        {displayName}
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={cleanId} 
      onError={handleError}
      className={cn("w-6 h-6 object-contain select-none shrink-0", className)}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
