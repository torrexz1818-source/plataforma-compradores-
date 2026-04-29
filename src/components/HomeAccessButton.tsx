import { Home } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const HomeAccessButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === '/inicio' || location.pathname === '/home' || location.pathname === '/dashboard';

  return (
    <button
      type="button"
      onClick={() => navigate('/inicio')}
      className={`inline-flex h-11 w-11 items-center justify-center gap-2 rounded-xl border px-0 text-sm font-medium transition-colors sm:h-10 sm:w-auto sm:rounded-md sm:px-3 ${
        isActive
          ? 'border-[#0E109E]/35 bg-[#0E109E]/10 text-[#0E109E]'
          : 'border-border bg-card text-[#0E109E] hover:bg-[#0E109E]/10 hover:text-[#0E109E] active:bg-[#0E109E]/15'
      }`}
      aria-label="Abrir inicio"
    >
      <Home className="h-5 w-5 sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">Inicio</span>
    </button>
  );
};

export default HomeAccessButton;
