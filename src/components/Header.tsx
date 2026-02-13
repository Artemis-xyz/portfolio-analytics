import { Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

const Header = () => {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const navItems = [
    { label: "Portfolio", path: "/" },
    { label: "Analytics", path: "/analytics" },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border">
      <div className="flex items-center gap-5">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center w-7 h-7">
          <img src={logo} alt="Logo" className="w-7 h-7 rounded" />
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-1 text-[13px] rounded transition-colors ${
                isActive(item.path)
                  ? "bg-nav-active text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {user && (
          <span className="text-[11px] text-muted-foreground mr-1">
            {user.email}
          </span>
        )}
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
        {user && (
          <button
            onClick={signOut}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
