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
            title={t('dashboard.stats.credits')}
            value={`${parseFloat(credits).toFixed(2)}`}
            icon={DollarSign}
            description={t('dashboard.stats.balance')}
          />
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
                      Favorites
                    </Button>
                  </Link>
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

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle>{t('inbox.title')}</CardTitle>
              <div className="p-3 rounded-lg bg-primary/10 min-w-[3rem] text-right">
                <p className="text-sm font-bold">{inboxCount.toLocaleString()}</p>
              </div>
            </div>
            <CardDescription>
              {t('inbox.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {incomingMessages?.messages && incomingMessages.messages.length > 0 ? (
                incomingMessages.messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className="flex items-start justify-between p-4 rounded-lg border border-border hover-elevate"
                    data-testid={`incoming-message-${msg.id}`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {t('inbox.from')}: {msg.from}
                          {msg.firstname || msg.lastname ? (
                            <span className="text-muted-foreground ml-2">
                              ({[msg.firstname, msg.lastname].filter(Boolean).join(' ')})
                            </span>
                          ) : null}
                          {msg.business ? (
                            <span className="text-muted-foreground ml-2">- {msg.business}</span>
                          ) : null}
                        </p>
                      </div>
                      <p className="text-sm text-foreground">{msg.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('inbox.to')}: {msg.receiver} • {new Date(msg.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge 
                      className={
                        msg.status === 'received'
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }
                      data-testid={`badge-status-${msg.id}`}
                    >
                      {msg.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">{t('inbox.empty')}</p>
                  <p className="text-xs mt-1">{t('inbox.emptyDesc')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
