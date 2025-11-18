import { MessageSquare, DollarSign, Activity } from "lucide-react";
import StatCard from "@/components/StatCard";
import ApiKeyDisplay from "@/components/ApiKeyDisplay";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function ClientDashboard() {
  const { t } = useLanguage();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['/api/client/profile']
  });

  const { data: messages } = useQuery({
    queryKey: ['/api/client/messages']
  });

  const credits = profile?.credits || "0.00";
  const messageCount = messages?.messages?.length || 0;
  const firstApiKey = profile?.apiKeys?.[0];

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
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('dashboard.subtitle')}</p>
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

        {firstApiKey && (
          <ApiKeyDisplay 
            apiKey={`${firstApiKey.displayKey.split('...')[0]}${'•'.repeat(32)}${firstApiKey.displayKey.split('...')[1]}`}
            title={t('dashboard.apiKey.title')}
            description={t('dashboard.apiKey.description')}
          />
        )}

        <div className="flex gap-3">
          <Link href="/docs">
            <Button data-testid="button-view-docs">{t('dashboard.buttons.viewDocs')}</Button>
          </Link>
          <Button variant="outline" data-testid="button-add-credits">{t('dashboard.buttons.addCredits')}</Button>
        </div>
      </div>
    </div>
  );
}
