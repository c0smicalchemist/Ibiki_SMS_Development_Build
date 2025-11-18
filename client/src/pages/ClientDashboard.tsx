import { MessageSquare, DollarSign, Activity, ArrowLeft } from "lucide-react";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { AddCreditsDialog } from "@/components/AddCreditsDialog";
import { ApiKeysManagement } from "@/components/ApiKeysManagement";

export default function ClientDashboard() {
  const { t } = useLanguage();
  const { data: profile, isLoading } = useQuery<{
    user: { id: string; email: string; name: string; company: string | null; role: string };
    credits: string;
    currency: string;
    apiKeys: Array<{ id: string; displayKey: string; isActive: boolean; createdAt: string; lastUsedAt: string | null }>;
  }>({
    queryKey: ['/api/client/profile']
  });

  const { data: messages } = useQuery<{ success: boolean; messages: any[] }>({
    queryKey: ['/api/client/messages']
  });

  const credits = profile?.credits || "0.00";
  const messageCount = messages?.messages?.length || 0;
  const apiKeys = profile?.apiKeys || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="p-6 space-y-8">
          <div className="animate-pulse">
            <div className="h-10 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="p-6 space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground mt-2">{t('dashboard.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title={t('dashboard.stats.messages')}
            value={messageCount.toLocaleString()}
            icon={MessageSquare}
            description={t('dashboard.stats.allTime')}
          />
          <StatCard
            title={t('dashboard.stats.credits')}
            value={`$${parseFloat(credits).toFixed(2)}`}
            icon={DollarSign}
            description={t('dashboard.stats.balance')}
          />
          <StatCard
            title={t('dashboard.stats.status')}
            value={t('dashboard.stats.online')}
            icon={Activity}
            description="All systems operational"
          />
        </div>

        <ApiKeysManagement apiKeys={apiKeys} />

        <div className="flex gap-3">
          <Link href="/docs">
            <Button data-testid="button-view-docs">{t('dashboard.buttons.viewDocs')}</Button>
          </Link>
          <AddCreditsDialog />
        </div>
      </div>
    </div>
  );
}
