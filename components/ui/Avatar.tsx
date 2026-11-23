import React from 'react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy';
}

const sizeStyles = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-14 h-14 text-lg',
};

const avatarColors = [
  'bg-blue-600 text-white',
  'bg-purple-600 text-white',
  'bg-emerald-600 text-white',
  'bg-rose-600 text-white',
  'bg-amber-600 text-white',
  'bg-cyan-600 text-white',
  'bg-indigo-600 text-white',
];

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColor(name?: string): string {
  if (!name) return avatarColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  status,
  className = '',
  ...props
}) => {
  const initials = getInitials(name);
  const color = getColor(name);

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full font-bold select-none shrink-0 ${sizeStyles[size]} ${
        src ? 'bg-slate-200 dark:bg-slate-700' : color
      } ${className}`}
      {...props}
    >
      {src ? (
        <img src={src} alt={name || 'Avatar'} className="w-full h-full rounded-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}

      {status && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
            status === 'online' ? 'bg-emerald-500' : status === 'busy' ? 'bg-rose-500' : 'bg-slate-400'
          }`}
        />
      )}
    </div>
  );
};

export default Avatar;
