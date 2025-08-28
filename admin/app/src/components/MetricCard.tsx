import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp } from 'lucide-react';
import React from 'react';

interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  subtitle?: string;
  className?: string;
  icon?: React.ReactNode;
  topRightIcon?: React.ReactNode;
}

export function MetricCard({
  title,
  value,
  change,
  subtitle,
  className,
  icon,
  topRightIcon,
}: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const hasChange = change !== undefined;

  return (
    <Card className={cn('relative', className)}>
      {topRightIcon && (
        <div className="absolute top-5 right-5 p-1.5 border border-gray-300 rounded-md">
          {React.isValidElement(topRightIcon)
            ? React.cloneElement(topRightIcon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4 text-gray-400' })
            : topRightIcon}
        </div>
      )}
      <CardContent>
        <div className="flex flex-row gap-4 items-center w-full">
          <div className="flex flex-col flex-1 gap-1 items-start">
            <p className="text-sm font-medium text-muted-foreground !m-0 !p-0 text-left">
              {title}
            </p>
            <div className="flex gap-2 items-baseline">
              <p className="text-2xl font-bold !m-0 !p-0">{value}</p>
              {hasChange && (
                <div
                  className={cn(
                    'flex items-center gap-1 text-sm font-medium',
                    isPositive && 'text-green-600',
                    isNegative && 'text-red-600'
                  )}
                >
                  {isPositive && <ArrowUp className="w-4 h-4" />}
                  {isNegative && <ArrowDown className="w-4 h-4" />}
                  {Math.abs(change)}%
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground !m-0 !p-0 text-left">{subtitle}</p>
            )}
          </div>
          {icon && (
            <span className="flex justify-center items-center ml-auto text-muted-foreground">
              {React.isValidElement(icon)
                ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-8 w-8 text-muted-foreground' })
                : icon}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}