import React from 'react';

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: (string | SelectOption)[];
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      error,
      helperText,
      className = '',
      containerClassName = '',
      children,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`w-full px-3.5 py-2.5 pr-10 rounded-xl text-sm border bg-white dark:bg-[#162235] text-slate-900 dark:text-slate-100 appearance-none cursor-pointer transition-all duration-150 ${
              error
                ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'
            } focus:outline-none focus:ring-2 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900 ${className}`}
            {...props}
          >
            {options
              ? options.map((opt, i) => {
                  if (typeof opt === 'string') {
                    return (
                      <option key={`${opt}-${i}`} value={opt} className="bg-white dark:bg-slate-900">
                        {opt}
                      </option>
                    );
                  }
                  return (
                    <option key={`${opt.value}-${i}`} value={opt.value} className="bg-white dark:bg-slate-900">
                      {opt.label}
                    </option>
                  );
                })
              : children}
          </select>

          {/* Custom Chevron Indicator */}
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
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

Select.displayName = 'Select';
export default Select;
