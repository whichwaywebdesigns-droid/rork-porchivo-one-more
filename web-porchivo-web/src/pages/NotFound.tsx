import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-navy-900 px-6 text-center">
      <img
        src="/porchivo-icon-liquid-glass-512.png"
        alt="Porchivo"
        width={96}
        height={96}
        className="h-24 w-24 rounded-3xl shadow-xl mb-8"
      />
      <h1 className="text-5xl font-bold text-brand-text-primary mb-3">404</h1>
      <p className="text-xl text-brand-text-secondary mb-8">Oops! That page doesn't exist.</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-orange text-white font-bold hover:bg-brand-orange-light transition-colors"
      >
        Return to Home
      </Link>
    </div>
  );
};

export default NotFound;
