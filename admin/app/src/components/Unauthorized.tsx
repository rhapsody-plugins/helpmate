import { ShieldX } from 'lucide-react';

interface UnauthorizedProps {
  message?: string;
}

export default function Unauthorized({ message }: UnauthorizedProps) {
  return (
    <div className="p-6">
      <div className="text-center py-12">
        <ShieldX className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-500">
          {message || "You don't have permission to access this page."}
        </p>
      </div>
    </div>
  );
}

