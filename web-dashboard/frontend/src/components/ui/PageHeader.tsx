import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from './badge';

interface PageHeaderProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  description?: string;
  badgeText?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning";
  actions?: React.ReactNode;
  kpis?: Array<{
    label: string;
    value: string | number;
    icon?: LucideIcon;
    iconColor?: string;
    trend?: string;
  }>;
}

export default function PageHeader({
  icon: Icon,
  iconColor = "text-primary",
  title,
  description,
  badgeText,
  badgeVariant = "outline",
  actions,
  kpis
}: PageHeaderProps) {
  return (
    <div className="flex flex-col space-y-4 pb-6 border-b border-border/80 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-none border border-border bg-card shadow-xs shrink-0 mt-0.5">
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div className="space-y-1 text-left">
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
              {badgeText && (
                <Badge variant={badgeVariant} className="text-[11px] py-0.5 px-2 font-mono rounded-none">
                  {badgeText}
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground leading-normal max-w-3xl">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center space-x-2 shrink-0 self-start md:self-auto">
            {actions}
          </div>
        )}
      </div>

      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
          {kpis.map((kpi, idx) => {
            const KpiIcon = kpi.icon;
            const kpiColor = kpi.iconColor || "text-primary";
            return (
              <div key={idx} className="p-3.5 rounded-none border border-border bg-card flex items-center justify-between transition-all hover:border-primary/40">
                <div className="text-left space-y-0.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-base font-semibold font-mono tracking-tight text-foreground">{kpi.value}</p>
                </div>
                {KpiIcon && (
                  <div className="p-2 rounded-none bg-muted/50 border border-border/50">
                    <KpiIcon className={`w-4 h-4 ${kpiColor}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
