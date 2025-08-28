import { useSettings } from '@/hooks/useSettings';

interface WelcomeMessagePopupProps {
  onClose: () => void;
  isOtherPopupVisible?: boolean;
}

export function WelcomeMessagePopup({ onClose, isOtherPopupVisible = false }: WelcomeMessagePopupProps) {
  const { getSettingsQuery } = useSettings();
  const { data: settings, isFetching } = getSettingsQuery;
  const welcomeMessages = settings?.settings?.welcome_message || [];

  if (isFetching || !welcomeMessages.length || isOtherPopupVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-[calc(var(--icon-size)+2rem)] right-5 transition-all duration-300 ease-in-out opacity-100 translate-y-0 fade-in-0 zoom-in-95 z-50">
      {/* Close button */}
      <button
        onClick={onClose}
        className="flex absolute right-0 -top-8 z-10 justify-center items-center w-6 h-6 bg-gray-100 rounded-full transition-colors hover:bg-gray-200"
        aria-label="Close welcome messages"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Messages container */}
      <div className="flex flex-col items-end space-y-3">
        {welcomeMessages.map((message, index) => (
          <div
            key={index}
            className="px-3 py-2 max-w-xs bg-white rounded-lg shadow-sm"
          >
            <p className="text-sm font-medium leading-relaxed">
              {message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}