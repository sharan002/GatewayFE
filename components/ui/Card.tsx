import React from 'react';
import { tokens } from './tokens';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className = '', children, ...props }, ref) => {
    const variantStyles = {
      default: `${tokens.colors.bg.surface} ${tokens.colors.border.default} border ${tokens.shadow.xs}`,
      elevated: `${tokens.colors.bg.surfaceElevated} ${tokens.colors.border.subtle} border ${tokens.shadow.md}`,
      subtle: `${tokens.colors.bg.surfaceSubtle} ${tokens.colors.border.subtle} border`,
      interactive: `${tokens.colors.bg.surface} ${tokens.colors.border.default} border ${tokens.shadow.xs} hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-sm cursor-pointer transition-all duration-150`,
    };

    const paddingStyles = {
      none: 'p-0',
      sm: 'p-3.5',
      md: 'p-5 sm:p-6',
      lg: 'p-6 sm:p-8',
    };

    return (
      <div
        ref={ref}
        className={`${tokens.radius.lg} ${variantStyles[variant]} ${paddingStyles[padding]} transition-colors duration-150 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`flex items-center justify-between gap-3 mb-4 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3 className={`${tokens.typography.h3} flex items-center gap-2 ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <p className={`${tokens.typography.bodySm} mt-1 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => <div className={`${className}`} {...props}>{children}</div>;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`border-t border-slate-100 dark:border-slate-800/80 mt-5 pt-4 flex items-center justify-between gap-3 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export default Card;
