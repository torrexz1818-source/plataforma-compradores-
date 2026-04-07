import { useNavigate } from 'react-router-dom';

type BackButtonProps = {
  fallback?: string;
  className?: string;
};

const BackButton = ({ fallback = '/', className = '' }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallback, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary transition-colors cursor-pointer ${className}`}
    >
      <span aria-hidden="true">←</span>
      <span>Volver</span>
    </button>
  );
};

export default BackButton;
