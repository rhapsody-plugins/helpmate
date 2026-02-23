import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';
import { User } from 'lucide-react';
import { ChangeSvgColor } from 'svg-color-tools';

interface AvatarProps {
  role: 'user' | 'assistant';
  avatarUrl?: string | null;
  className?: string;
}

export function Avatar({ role, avatarUrl, className = '' }: AvatarProps) {
  // If avatarUrl provided, show image
  if (avatarUrl) {
    return (
      <img 
        src={avatarUrl} 
        alt="" 
        className={`w-8 h-8 rounded-full object-cover ${className}`}
      />
    );
  }
  
  // Otherwise show role-based icon
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center ${
        role === 'user'
          ? 'bg-primary'
          : 'bg-secondary'
      } ${className}`}
    >
      {role === 'user' ? (
        <User size={16} className="text-white" />
      ) : (
        <ChangeSvgColor
          src={HelpmateIcon}
          fill="white"
          style={{
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      )}
    </div>
  );
}
