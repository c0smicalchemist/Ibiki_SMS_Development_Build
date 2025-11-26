import { MessageSquare, DollarSign, Activity, ArrowLeft, Inbox, Send, Users, Clock } from "lucide-react";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { AddCreditsDialog } from "@/components/AddCreditsDialog";
import { ApiKeysManagement } from "@/components/ApiKeysManagement";
import { WorldClock } from "@/components/WorldClock";
import { MessageStatusChart } from "@/components/MessageStatusChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ClientDashboard() {
  const { t } = useLanguage();
  const { data: profile, isLoading } = useQuery<{
    user: { id: string; email: string; name: string; company: string | null; role: string };
    credits: string;
    currency: string;
    ratePerSms: string;
    apiKeys: Array<{ id: string; displayKey: string; isActive: boolean; createdAt: string; lastUsedAt: string | null }>;
  }>({
    queryKey: ['/api/client/profile']
  });

  const { data: messages } = useQuery<{ success: boolean; messages: any[] }>({
    queryKey: ['/api/client/messages']
  });

  const { data: incomingMessages } = useQuery<{ 
    success: boolean; 
    messages: Array<{
      id: string;
      from: string;
      firstname: string | null;
      lastname: string | null;
      business: string | null;
      message: string;
      status: string;
      receiver: string;
      timestamp: string;
      messageId: string;
    }>;
    count: number;
  }>({
    queryKey: ['/api/client/inbox'],
    refetchInterval: 5000
  });

  const credits = profile?.credits || "0.00";
  const ratePerSms = profile?.ratePerSms || "0.02";
  const messageCount = messages?.messages?.length || 0;
  const inboxCount = incomingMessages?.count || 0;
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title={t('dashboard.stats.messages')}
            value={messageCount.toLocaleString()}
            icon={MessageSquare}
            description={t('dashboard.stats.allTime')}
          />
          <StatCard
            title={t('dashboard.stats.inbox')}
            value={inboxCount.toLocaleString()}
            icon={Inbox}
            description={t('dashboard.stats.inboxMessages')}
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
            description={t('dashboard.stats.operational')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover-elevate active-elevate-2 cursor-pointer border-2 border-blue-500/30">
            <Link href="/send-sms">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  {t('clientDashboard.sendSms')}
                </CardTitle>
                <CardDescription>
                  {t('clientDashboard.sendSmsDesc')}
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover-elevate active-elevate-2 cursor-pointer border-2 border-blue-500/30">
            <Link href="/inbox">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  {t('clientDashboard.inbox')}
                </CardTitle>
                <CardDescription>
                  {t('clientDashboard.inboxDesc')}
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover-elevate active-elevate-2 cursor-pointer border-2 border-blue-500/30">
            <Link href="/contacts">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('clientDashboard.contacts')}
                </CardTitle>
                <CardDescription>
                  {t('clientDashboard.contactsDesc')}
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover-elevate active-elevate-2 cursor-pointer border-2 border-blue-500/30">
            <Link href="/message-history">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {t('messageHistory.title')}
                </CardTitle>
                <CardDescription>
                  {t('messageHistory.subtitle')}
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          {/* Removed non-SMS tiles */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WorldClock />
          <MessageStatusChart />
        </div>

        {/* Inbox list removed from main dashboard to reduce clutter */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('clientDashboard.pricing')}</CardTitle>
              <CardDescription className="text-xs">
                {t('clientDashboard.pricingDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('clientDashboard.ratePerSms')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" data-testid="text-rate-per-sms">
                      ${parseFloat(ratePerSms).toFixed(4)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('clientDashboard.perMessage')}</p>
                  </div>
                </div>
                {parseFloat(credits) > 0 && (
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t('clientDashboard.estimatedMessages')}:</span>
                      <span className="font-semibold" data-testid="text-messages-available">
                        ~{Math.floor(parseFloat(credits) / parseFloat(ratePerSms)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <ApiKeysManagement apiKeys={apiKeys} isCompact={true} />
        </div>

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
