import React from 'react';
import { tokens } from './tokens';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = '',
      containerClassName = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full px-3.5 py-2.5 ${leftIcon ? 'pl-10' : ''} ${
              rightIcon ? 'pr-10' : ''
            } rounded-xl text-sm border bg-white dark:bg-[#162235] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
              error
                ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'
            } focus:outline-none focus:ring-2 transition-all duration-150 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900 ${className}`}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-[11px] font-medium text-red-500">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
