import React from 'react';

export const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
      <table ref={ref} className={`w-full text-left text-xs border-collapse ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = '', children, ...props }, ref) => (
  <thead
    ref={ref}
    className={`bg-[#1e293b] dark:bg-[#162235] text-slate-200 border-b border-slate-700/60 select-none ${className}`}
    {...props}
  >
    {children}
  </thead>
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className = '', children, ...props }, ref) => (
  <tbody
    ref={ref}
    className={`divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#111a28] ${className}`}
    {...props}
  >
    {children}
  </tbody>
));
TableBody.displayName = 'TableBody';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isSelected?: boolean;
  isHoverable?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ isSelected = false, isHoverable = true, className = '', children, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={`transition-colors duration-150 ${
          isSelected
            ? 'bg-blue-50/80 dark:bg-blue-950/40'
            : isHoverable
            ? 'hover:bg-slate-50/90 dark:hover:bg-[#162235]/90'
            : ''
        } ${className}`}
        {...props}
      >
        {children}
      </tr>
    );
  }
);
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className = '', children, ...props }, ref) => (
  <th
    ref={ref}
    className={`px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 dark:text-slate-300 ${className}`}
    {...props}
  >
    {children}
  </th>
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className = '', children, ...props }, ref) => (
  <td
    ref={ref}
    className={`px-4 py-3.5 text-xs text-slate-700 dark:text-slate-200 align-middle ${className}`}
    {...props}
  >
    {children}
  </td>
));
TableCell.displayName = 'TableCell';
