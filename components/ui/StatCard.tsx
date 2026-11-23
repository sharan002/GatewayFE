import React from 'react';
import { tokens } from './tokens';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subLabel?: React.ReactNode;
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subLabel,
  icon,
  iconBg = 'bg-blue-500',
  iconColor = 'text-white',
  trend,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#111a28] rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between min-w-[140px] flex-1 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        {icon && (
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0 shadow-2xs`}
          >
            {icon}
          </div>
        )}
        {trend && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
              trend.isPositive
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
            }`}
          >
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
            {value}
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
          {label}
        </p>

        {subLabel && (
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {subLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
