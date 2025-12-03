import { MessageSquare, DollarSign, Activity, ArrowLeft, Inbox, Send, Users, Clock, Star } from "lucide-react";
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
import MessageStatusTiles from "@/components/MessageStatusTiles";
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

  const { data: webInbox } = useQuery<{ success: boolean; messages: Array<{ id: string; isRead: boolean }>; count?: number }>({
    queryKey: ['/api/web/inbox'],
    refetchInterval: 5000
  });

  const credits = profile?.credits || "0.00";
  const ratePerSms = profile?.ratePerSms || "0.02";
  const messageCount = messages?.messages?.length || 0;
  const inboxCount = (webInbox?.messages?.length || webInbox?.count || 0) as number;
  const unreadCount = (webInbox?.messages || []).filter((m) => !m.isRead).length;
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
        <div className="rounded border p-3 bg-muted/40">
          <p className="text-xs text-muted-foreground">SMS capacity: {Math.floor(parseFloat(credits)).toLocaleString()} messages</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button size="icon" data-testid="button-back" className="bg-blue-600 text-white hover:bg-blue-700 font-bold">
              <ArrowLeft className="h-5 w-5" strokeWidth={3} />
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
          <StatCard title={t('dashboard.stats.credits')} value={`${parseFloat(credits).toFixed(2)}`} icon={DollarSign} description={t('dashboard.stats.balance')} />
          <StatCard
            title={t('dashboard.stats.status')}
            value={t('dashboard.stats.online')}
            icon={Activity}
            description={t('dashboard.stats.operational')}
          />
          <StatCard
            title={'User'}
            value={profile?.user?.email || profile?.user?.id || ''}
            icon={Users}
            description={'Logged in account'}
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
                  <Link href="/inbox?view=favorites">
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-2 h-6 px-2 text-xs bg-yellow-100 text-yellow-800 border border-yellow-500 hover:bg-yellow-200 flex items-center gap-1"
                    >
                      <Star className="h-3 w-3" />
                      {t('inbox.favorites')}
                    </Button>
                  </Link>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="p-2 rounded bg-primary/10 text-xs text-primary font-bold min-w-[3rem] text-center">
                      {inboxCount.toLocaleString()}<span className="ml-1">{t('inbox.indicator.all')}</span>
                    </div>
                    <div className="p-2 rounded bg-yellow-100 text-xs text-yellow-800 font-bold min-w-[3rem] text-center border border-yellow-500">
                      {unreadCount.toLocaleString()}<span className="ml-1">{t('inbox.unreadIndicator')}</span>
                    </div>
                  </div>
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
        <MessageStatusTiles />

        {/* Inbox list removed from main dashboard to reduce clutter */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
