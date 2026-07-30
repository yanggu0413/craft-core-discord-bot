import React from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  const handleOpenWiki = () => {
    window.open('https://wiki.hosting.craft-core.xyz', '_blank');
  };

  return (
    <footer className="border-t bg-card text-card-foreground py-3 px-6 shrink-0">
      <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
        <div>© {new Date().getFullYear()} Craft-Core Hosting. All rights reserved.</div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenWiki}
          className="text-xs gap-1.5 font-medium text-foreground hover:text-primary hover:bg-accent h-7 px-2.5"
        >
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          <span>開發者文檔</span>
          <ExternalLink className="h-3 w-3 opacity-60" />
        </Button>
      </div>
    </footer>
  );
};
