import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { useDataSource } from '@/hooks/useDataSource';

interface ConsentContextType {
  requestConsent: (action: () => void) => void;
  isConsentDialogOpen: boolean;
  setIsConsentDialogOpen: (open: boolean) => void;
  pendingTrainingAction: (() => void) | null;
  setPendingTrainingAction: (action: (() => void) | null) => void;
  checkConsentAndExecute: (action: () => void) => void;
}

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false);
  const [pendingTrainingAction, setPendingTrainingAction] = useState<(() => void) | null>(null);
  const { getConsentQuery } = useDataSource();

  const requestConsent = useCallback((action: () => void) => {
    setPendingTrainingAction(() => action);
    setIsConsentDialogOpen(true);
  }, []);

  const checkConsentAndExecute = useCallback((action: () => void) => {
    const hasConsent = getConsentQuery.data;

    if (hasConsent) {
      // User has already given consent, execute the action directly
      action();
    } else {
      // User hasn't given consent, show the popup
      requestConsent(action);
    }
  }, [getConsentQuery.data, requestConsent]);

  return (
    <ConsentContext.Provider
      value={{
        requestConsent,
        isConsentDialogOpen,
        setIsConsentDialogOpen,
        pendingTrainingAction,
        setPendingTrainingAction,
        checkConsentAndExecute,
      }}
    >
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (context === undefined) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}
