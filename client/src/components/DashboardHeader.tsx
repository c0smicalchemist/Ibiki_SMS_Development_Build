import { Link, useLocation } from "wouter";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LogOut, RefreshCcw } from "lucide-react";
import logoUrl from "@assets/Yubin_Dash_NOBG_1763476645991.png";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function DashboardHeader() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setLocation('/');
  };

  const handleForceRefresh = async () => {
    setRefreshing(true);
    const keys = [
      ['/api/client/profile'],
      ['/api/client/messages'],
      ['/api/client/inbox'],
      ['/api/v2/sms/messages'],
      ['/api/v2/sms/inbox'],
      ['/api/message-status-stats'],
      ['/api/admin/clients'],
      ['/api/admin/stats'],
      ['/api/admin/recent-activity'],
      ['/api/admin/error-logs'],
      ['/api/admin/config'],
      ['/api/web/inbox'],
    ];
    for (const key of keys) {
      await queryClient.invalidateQueries({ queryKey: key as any });
      await queryClient.refetchQueries({ queryKey: key as any });
    }
    setRefreshing(false);
    toast({ title: t('common.success'), description: 'Refresh successful' });
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-center justify-between h-16 px-6">
        <Link href="/">
          <img src={logoUrl} alt="Yubin Dash" className="h-10 w-auto cursor-pointer" />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForceRefresh}
            data-testid="button-refresh"
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
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
