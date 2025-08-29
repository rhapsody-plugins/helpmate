import { createContext, useContext, ReactNode, useState, useCallback } from 'react';

interface ConsentContextType {
  requestConsent: (action: () => void) => void;
  isConsentDialogOpen: boolean;
  setIsConsentDialogOpen: (open: boolean) => void;
  pendingTrainingAction: (() => void) | null;
  setPendingTrainingAction: (action: (() => void) | null) => void;
}

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false);
  const [pendingTrainingAction, setPendingTrainingAction] = useState<(() => void) | null>(null);

  const requestConsent = useCallback((action: () => void) => {
    setPendingTrainingAction(() => action);
    setIsConsentDialogOpen(true);
  }, []);

  return (
    <ConsentContext.Provider
      value={{
        requestConsent,
        isConsentDialogOpen,
        setIsConsentDialogOpen,
        pendingTrainingAction,
        setPendingTrainingAction,
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
