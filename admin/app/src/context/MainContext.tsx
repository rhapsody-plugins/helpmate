import { useSettings } from '@/hooks/useSettings';
import * as React from 'react';
import { useState, useMemo } from 'react';

export type PageType =
  | 'apps'
  | 'dashboard'
  | 'activity'
  | 'data-source'
  | 'customization'
  | 'behavior'
  | 'settings'
  | 'proactive-sales'
  | 'sales-notifications'
  | 'abandoned-cart'
  | 'coupon-delivery'
  | 'order-tracker'
  | 'image-search'
  | 'promo-banner'
  | 'ticket-system'
  | 'refund-return';

interface MainContextProps {
  page: PageType;
  setPage: (value: PageType) => void;
  modules: Record<string, boolean>;
  totalScore: number;
  moduleScores: Record<string, number>;
}

const MainContext = React.createContext<MainContextProps | null>(null);

export function useMain() {
  const context = React.useContext(MainContext);
  if (!context) {
    throw new Error('useMain must be used within a MainProvider');
  }
  return context;
}

interface MainProviderProps {
  children: React.ReactNode;
}

export function MainProvider({ children }: MainProviderProps) {
  const { getModulesQuery } = useSettings();
  const { data: modules } = getModulesQuery;
  const [page, setPage] = useState<PageType>('data-source');

  const moduleScores: Record<string, number> = {
    chatbot: 30,
    'ticket-system': 10,
    'image-search': 10,
    'proactive-sales': 10,
    'sales-notifications': 5,
    'abandoned-cart': 10,
    'order-tracker': 10,
    'coupon-delivery': 5,
    'refund-return': 10,
  };

  const totalScore = useMemo(() => {
    if (!modules) return 0;

    return Object.entries(modules).reduce((total, [moduleId, isEnabled]) => {
      return total + (isEnabled ? moduleScores[moduleId] || 0 : 0);
    }, 0);
  }, [modules]);

  const value = React.useMemo(
    () => ({
      page,
      setPage,
      modules: modules ?? {},
      totalScore,
      moduleScores,
    }),
    [page, setPage, modules, totalScore]
  );

  return <MainContext.Provider value={value}>{children}</MainContext.Provider>;
}
