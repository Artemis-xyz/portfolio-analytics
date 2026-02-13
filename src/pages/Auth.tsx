import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";
import { Navigate } from "react-router-dom";
import logo from "@/assets/logo.png";

const Auth = () => {
  const { user, loading, signUp, signIn } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-[13px]">Loading...</div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      const { error, data } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else if (data?.user?.identities?.length === 0) {
        setError("This email is already registered. Try signing in or use Google login.");
      } else {
        setMessage("Check your email to confirm your account.");
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[340px]">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Logo" className="w-8 h-8 rounded mb-3" />
          <h1 className="text-[15px] font-semibold text-foreground">
            {isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            {isLogin ? "Sign in to your portfolio" : "Get started with portfolio tracking"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-8 px-2.5 text-[13px] bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-8 px-2.5 text-[13px] bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-[11px] text-negative">{error}</p>}
          {message && <p className="text-[11px] text-positive">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-8 text-[13px] font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? "..." : isLogin ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-muted-foreground uppercase">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={async () => {
            setError("");
            const result = await lovable.auth.signInWithOAuth("google", {
              redirect_uri: window.location.origin,
            });
            if (result?.error) setError(result.error.message || "Google sign-in failed");
          }}
          className="w-full h-8 text-[13px] font-medium border border-border rounded-md hover:bg-secondary transition-colors flex items-center justify-center gap-2 text-foreground"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(""); setMessage(""); }}
            className="text-foreground hover:underline"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
