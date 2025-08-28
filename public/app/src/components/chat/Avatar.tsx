import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';
import { User } from 'lucide-react';
import { ChangeSvgColor } from 'svg-color-tools';

interface AvatarProps {
  role: 'user' | 'assistant';
  className?: string;
}

export function Avatar({ role, className = '' }: AvatarProps) {
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
