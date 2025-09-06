import { useSettings } from '@/hooks/useSettings';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export const ThemeContext = createContext({
  icon: '',
  icon_shape: '',
  position: '',
  sound_effect: '',
  bot_name: '',
});

export const useTheme = () => {
  return useContext(ThemeContext);
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [icon, setIcon] = useState('');
  const [icon_shape, setIconShape] = useState('');
  const [bot_name, setBotName] = useState('');
  const [position, setPosition] = useState('');
  const [sound_effect, setSoundEffect] = useState('');
  const [hideOnMobile, setHideOnMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { getSettingsQuery } = useSettings();

  useEffect(() => {
    const checkMobile = () => {
      const userAgentIsMobile = /Mobi|Android|iPhone|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent);
      const widthIsMobile = window.innerWidth <= 768;
      setIsMobile(userAgentIsMobile || widthIsMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (getSettingsQuery.data) {
      const { customization, settings } = getSettingsQuery.data;
      const {
        primary_color,
        primary_gradient,
        secondary_color,
        secondary_gradient,
        font_size,
        icon_size,
        position,
        icon,
        icon_shape,
        sound_effect,
        bot_name,
      } = customization;
      const { hide_on_mobile } = settings;
      const host = document.querySelector('#helpmate-root');
      if (host) {
        (host as HTMLElement).style.setProperty(
          '--primary',
          primary_color as unknown as string
        );
        (host as HTMLElement).style.setProperty(
          '--primary-gradient',
          primary_gradient as unknown as string
        );
        (host as HTMLElement).style.setProperty(
          '--secondary',
          secondary_color as unknown as string
        );
        (host as HTMLElement).style.setProperty(
          '--secondary-gradient',
          secondary_gradient as unknown as string
        );
        (host as HTMLElement).style.setProperty(
          '--font-size',
          font_size as unknown as string
        );
        (host as HTMLElement).style.setProperty(
          '--icon-size',
          icon_size as unknown as string
        );
        (host as HTMLElement).style.setProperty(
          '--position',
          position as unknown as string
        );
      }
      setBotName(bot_name as string);
      setIconShape(icon_shape as string);
      setIcon(icon as string);
      setPosition(position as string);
      setSoundEffect(sound_effect as string);
      setHideOnMobile(!!hide_on_mobile);
    }
  }, [getSettingsQuery]);

  const memoizedValues = useMemo(
    () => ({ icon, icon_shape, position, sound_effect, bot_name }),
    [icon, icon_shape, position, sound_effect, bot_name]
  );

  if (hideOnMobile && isMobile) return null;

  return (
    <ThemeContext.Provider value={memoizedValues}>
      {children}
    </ThemeContext.Provider>
  );
};
