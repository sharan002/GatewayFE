import React from 'react';
import { tokens } from './tokens';

export type BadgeVariant =
  | 'hot'
  | 'warm'
  | 'cold'
  | 'enrolled'
  | 'success'
  | 'new'
  | 'info'
  | 'responded'
  | 'purple'
  | 'neutral'
  | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  hot: {
    container: tokens.colors.status.hot.badge,
    dot: tokens.colors.status.hot.dot,
  },
  warm: {
    container: tokens.colors.status.warm.badge,
    dot: tokens.colors.status.warm.dot,
  },
  cold: {
    container: tokens.colors.status.cold.badge,
    dot: tokens.colors.status.cold.dot,
  },
  enrolled: {
    container: tokens.colors.status.enrolled.badge,
    dot: tokens.colors.status.enrolled.dot,
  },
  success: {
    container: tokens.colors.status.enrolled.badge,
    dot: tokens.colors.status.enrolled.dot,
  },
  new: {
    container: tokens.colors.status.new.badge,
    dot: tokens.colors.status.new.dot,
  },
  info: {
    container: tokens.colors.status.new.badge,
    dot: tokens.colors.status.new.dot,
  },
  responded: {
    container: tokens.colors.status.responded.badge,
    dot: tokens.colors.status.responded.dot,
  },
  purple: {
    container: tokens.colors.status.responded.badge,
    dot: tokens.colors.status.responded.dot,
  },
  neutral: {
    container: tokens.colors.status.neutral.badge,
    dot: tokens.colors.status.neutral.dot,
  },
  outline: {
    container:
      'bg-transparent border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
};

const sizeStyles = {
  xs: 'text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider',
  sm: 'text-[10px] px-2 py-0.5 rounded-full font-semibold',
  md: 'text-xs px-2.5 py-1 rounded-full font-semibold',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  icon,
  children,
  className = '',
  ...props
}) => {
  const current = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 ${current.container} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} />}
      {icon}
      <span>{children}</span>
    </span>
  );
};

/**
 * Intelligent Status Badge automatically resolving lead pipeline & status states
 */
export const StatusBadge: React.FC<{
  status?: string | null;
  pipeline?: string | null;
  size?: 'xs' | 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}> = ({ status, pipeline, size = 'sm', showDot = true, className = '' }) => {
  const val = (status || pipeline || '').trim().toLowerCase();

  let variant: BadgeVariant = 'neutral';
  if (val === 'hot') variant = 'hot';
  else if (val === 'warm') variant = 'warm';
  else if (val === 'cold') variant = 'cold';
  else if (val.includes('enrolled') || val.includes('paid')) variant = 'enrolled';
  else if (val.includes('respond') || val.includes('progress')) variant = 'responded';
  else if (val === 'new') variant = 'new';

  return (
    <Badge variant={variant} size={size} dot={showDot} className={className}>
      {status || pipeline || 'New'}
    </Badge>
  );
};

export default Badge;
