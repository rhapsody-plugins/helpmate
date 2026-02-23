import HelpmateIcon from '@/assets/helpmate-logo-icon.svg';
import { useSettings } from '@/hooks/useSettings';
import { ChangeSvgColor } from 'svg-color-tools';
import { useEffect, useState } from 'react';
import { TestChatWidget } from './TestChatWidget';

export function TestChatWithLauncher() {
  const [customization, setCustomization] = useState<{
    icon: string;
    icon_shape: string;
    position: string;
    icon_size: string;
  }>({
    icon: '',
    icon_shape: 'circle',
    position: 'right',
    icon_size: '60px',
  });

  const { getSettingsMutation } = useSettings();
  const { mutate: getSettings } = getSettingsMutation;

  useEffect(() => {
    getSettings('customization', {
      onSuccess: (data: Record<string, unknown>) => {
        setCustomization({
          icon: (data.icon as string) ?? '',
          icon_shape: (data.icon_shape as string) ?? 'circle',
          position: (data.position as string) ?? 'right',
          icon_size: (data.icon_size as string) ?? '60px',
        });
      },
    });
  }, [getSettings]);

  const { icon, icon_shape, position } = customization;

  const panelRadiusClass =
    icon_shape === 'circle'
      ? 'rounded-xl'
      : icon_shape === 'square'
        ? 'rounded-none'
        : icon_shape === 'rounded'
          ? 'rounded-lg'
          : 'rounded-md';

  const launcherRadiusClass =
    icon_shape === 'circle'
      ? 'rounded-full'
      : icon_shape === 'square'
        ? 'rounded-none'
        : icon_shape === 'rounded'
          ? 'rounded-lg'
          : 'rounded-md';

  return (
    <div
      className={`flex flex-col gap-3 w-full max-w-lg ${
        position === 'right' ? 'items-end' : 'items-start'
      }`}
    >
      {/* Panel - always visible */}
      <div className="relative mx-auto w-full max-w-lg">
        <div
          className={`absolute inset-0 z-0 translate-y-2 blur-sm [background:var(--secondary-gradient)] opacity-30 ${panelRadiusClass}`}
        />
        <div
          className={`overflow-hidden relative z-10 bg-background h-[700px] flex flex-col ${panelRadiusClass}`}
        >
          <TestChatWidget />
        </div>
      </div>

      {/* Launcher - decorative only */}
      <div
        className={`relative ${
          icon_shape === 'rectangle'
            ? 'w-auto'
            : 'h-[var(--icon-size)] w-[var(--icon-size)]'
        }`}
      >
        <div
          className={`absolute inset-0 z-0 translate-y-2 blur-sm [background:var(--secondary-gradient)] opacity-30 ${launcherRadiusClass}`}
        />
        <div
          role="presentation"
          className={`[background:var(--primary-gradient)] relative flex items-center justify-center z-20 p-4 pointer-events-none ${launcherRadiusClass} ${
            icon_shape === 'rectangle'
              ? 'w-auto px-6 gap-3'
              : 'h-[var(--icon-size)] w-[var(--icon-size)]'
          }`}
        >
          {icon ? (
            <img
              src={icon}
              alt="Chat"
              className={`${launcherRadiusClass} ${
                icon_shape === 'rectangle' ? 'h-8 w-8' : '!w-full !h-full'
              }`}
            />
          ) : (
            <ChangeSvgColor
              src={HelpmateIcon}
              fill="white"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className={icon_shape === 'rectangle' ? 'h-8 w-8' : '!w-full !h-full'}
            />
          )}
          {icon_shape === 'rectangle' && (
            <span className="text-xl font-medium text-white">Test Chat</span>
          )}
        </div>
      </div>
    </div>
  );
}
