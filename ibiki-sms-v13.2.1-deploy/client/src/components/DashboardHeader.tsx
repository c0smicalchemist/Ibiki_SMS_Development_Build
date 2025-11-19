import { Link, useLocation } from "wouter";
import { LanguageToggle } from "./LanguageToggle";
import { Button } from "./ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LogOut } from "lucide-react";
import logoUrl from "@assets/Yubin_Dash_NOBG_1763476645991.png";

export function DashboardHeader() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const handleLogout = () => {
    localStorage.removeItem('token');
    setLocation('/');
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-center justify-between h-16 px-6">
        <Link href="/">
          <img src={logoUrl} alt="Yubin Dash" className="h-10 w-auto cursor-pointer" />
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </div>
    </header>
  );
}
