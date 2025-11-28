import { Link, useLocation } from "wouter";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { LogOut, RefreshCcw } from "lucide-react";
import logoUrl from "@assets/Yubin_Dash_NOBG_1763476645991.png";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function DashboardHeader() {
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [retrieving, setRetrieving] = useState(false);

  const { data: profile } = useQuery<{
    user: { id: string; email: string; name: string; company: string | null; role: string };
  }>({ queryKey: ['/api/client/profile'] });

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
    const selectedClientId = localStorage.getItem('selectedClientId');
    const isAdminMode = localStorage.getItem('isAdminMode') === 'true';
    const effectiveUserId = !isAdminMode && selectedClientId ? selectedClientId : undefined;
    const contactsKeys = [
      ['/api/contacts', effectiveUserId],
      ['/api/contact-groups', effectiveUserId],
      ['/api/contacts/sync-stats', effectiveUserId],
    ];
    for (const key of keys) {
      await queryClient.invalidateQueries({ queryKey: key as any });
      await queryClient.refetchQueries({ queryKey: key as any });
    }
    for (const key of contactsKeys) {
      await queryClient.invalidateQueries({ queryKey: key as any });
      await queryClient.refetchQueries({ queryKey: key as any });
    }
    await queryClient.invalidateQueries({ predicate: (q: any) => String(q.queryKey?.[0] || '').startsWith('/api/') });
    await queryClient.refetchQueries({ predicate: (q: any) => String(q.queryKey?.[0] || '').startsWith('/api/') });
    setRefreshing(false);
    toast({ title: t('common.success'), description: 'Refresh successful' });
  };

  const handleRetrieveInbox = async () => {
    try {
      setRetrieving(true);
      const token = localStorage.getItem('token');
      await fetch('/api/web/inbox/retrieve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/web/inbox'] });
      await queryClient.refetchQueries({ queryKey: ['/api/web/inbox'] });
      toast({ title: t('common.success'), description: t('inbox.retrieveSuccess') });
    } catch (e) {
      toast({ title: t('common.error'), description: t('inbox.retrieveFailed'), variant: 'destructive' });
    } finally {
      setRetrieving(false);
    }
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-center justify-between h-16 px-6">
        <Link href="/">
          <img src={logoUrl} alt="Yubin Dash" className="h-10 w-auto cursor-pointer" />
        </Link>
        <div className="flex items-center gap-3">
          {profile?.user?.name && (
            <Badge variant="secondary" data-testid="badge-username">{profile.user.name}</Badge>
          )}
          {profile?.user?.role && (
            <Badge variant="outline" data-testid="badge-role">
              {profile.user.role === 'admin' ? 'Admin' : profile.user.role === 'supervisor' ? 'Supervisor' : 'User'}
            </Badge>
          )}
          <ThemeToggle />
          <LanguageToggle />
          {/* Retrieve Inbox action moved into Inbox page header */}
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
