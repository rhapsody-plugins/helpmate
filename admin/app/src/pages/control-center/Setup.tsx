import SetupWidget from '@/components/SetupWidget';
import { PageType } from '@/contexts/MainContext';

export default function Setup({
  setPage,
}: {
  setPage: (page: PageType) => void;
}) {
  return (
    <div className="flex z-50 justify-center items-center p-6 w-full bg-gray-50">
      <div className="w-full">
        <SetupWidget setPage={setPage} />
      </div>
    </div>
  );
}

