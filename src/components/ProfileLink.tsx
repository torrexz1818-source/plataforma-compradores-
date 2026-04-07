import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

type ProfileLinkProps = {
  userId?: string;
  className?: string;
  children: ReactNode;
  stopPropagation?: boolean;
};

const ProfileLink = ({ userId, className = '', children, stopPropagation = false }: ProfileLinkProps) => {
  const { user } = useAuth();

  if (!userId) {
    return <span className={className}>{children}</span>;
  }

  const target = user?.id === userId ? '/perfil' : `/perfil/${userId}`;

  return (
    <Link
      to={target}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
      }}
      className={`cursor-pointer hover:text-primary hover:underline transition-colors ${className}`}
    >
      {children}
    </Link>
  );
};

export default ProfileLink;
