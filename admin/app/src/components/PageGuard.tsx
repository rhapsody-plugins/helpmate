import { usePermissions } from '@/hooks/usePermissions';
import { PageType } from '@/contexts/MainContext';
import Unauthorized from './Unauthorized';
import Loading from './Loading';

interface PageGuardProps {
  page: PageType;
  children: React.ReactNode;
  requiredRole?: string;
  customMessage?: string;
}

export default function PageGuard({
  page,
  children,
  requiredRole,
  customMessage,
}: PageGuardProps) {
  const { canAccessPage, hasRole, isLoading } = usePermissions();

  if (isLoading) {
    return <Loading />;
  }

  // Check for required role first (e.g., admin for team management)
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <Unauthorized
        message={
          customMessage ||
          `Only ${requiredRole} role users can access this page.`
        }
      />
    );
  }

  // Check page permissions
  if (!canAccessPage(page)) {
    return (
      <Unauthorized
        message={
          customMessage || "You don't have permission to access this page."
        }
      />
    );
  }

  return <>{children}</>;
}

