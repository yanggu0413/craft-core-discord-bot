import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface MinecraftItemIconProps {
  itemId: string;
  className?: string;
}

export default function MinecraftItemIcon({ itemId, className }: MinecraftItemIconProps) {
  const cleanId = itemId.replace('minecraft:', '').toLowerCase();
  
  const itemUrl = `https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/item/${cleanId}.png`;
  const blockUrl = `https://assets.mcasset.cloud/1.21.1/assets/minecraft/textures/block/${cleanId}.png`;
  
  const [src, setSrc] = useState(itemUrl);
  const [fallbackCount, setFallbackCount] = useState(0);

  // Reset state if itemId changes
  useEffect(() => {
    setSrc(itemUrl);
    setFallbackCount(0);
  }, [itemId]);

  const handleError = () => {
    if (fallbackCount === 0) {
      setSrc(blockUrl);
      setFallbackCount(1);
    } else {
      setSrc('');
      setFallbackCount(2);
    }
  };

  if (fallbackCount === 2 || !src) {
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
