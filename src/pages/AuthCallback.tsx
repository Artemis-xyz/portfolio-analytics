import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("OAuth callback error:", error);
          navigate("/auth?error=" + encodeURIComponent(error.message));
          return;
        }

        if (session) {
          navigate("/", { replace: true });
        } else {
          navigate("/auth");
        }
      } catch (err) {
        console.error("Unexpected callback error:", err);
        navigate("/auth?error=authentication_failed");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-foreground border-r-transparent mb-4"></div>
        <p className="text-[13px] text-muted-foreground">
          Completing sign in...
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
