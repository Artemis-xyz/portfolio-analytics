import { useAuth } from "@/hooks/useAuth";
import { usePrivy } from '@privy-io/react-auth';
import { Navigate } from "react-router-dom";
import logo from "@/assets/logo.png";

const Auth = () => {
  const { user, loading } = useAuth();
  const { login } = usePrivy();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-[13px]">Loading...</div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[340px]">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Logo" className="w-8 h-8 rounded mb-3" />
          <h1 className="text-[15px] font-semibold text-foreground">
            Welcome to Artemis Portfolio Tracker
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            Portfolio optimization to help you invest better.
          </p>
        </div>

        <button
          onClick={login}
          className="w-full h-10 text-[13px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
        >
          Sign In
        </button>
      </div>
    </div>
  );
};

export default Auth;
