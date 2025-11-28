import { useState, useEffect } from "react";
import { Users, Settings, Activity, ArrowLeft, Wallet, Copy, CheckCircle, Send, Inbox as InboxIcon, Clock, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatCard from "@/components/StatCard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Link } from "wouter";
import ApiTestUtility from "@/components/ApiTestUtility";
import ErrorLogsViewer from "@/components/ErrorLogsViewer";
import { AddCreditsToClientDialog } from "@/components/AddCreditsToClientDialog";
import ResetPasswordDialog from "@/components/ResetPasswordDialog";
import WebhookEditDialog from "@/components/WebhookEditDialog";
import { WorldClock } from "@/components/WorldClock";
import { MessageStatusChart } from "@/components/MessageStatusChart";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [extremeApiKey, setExtremeApiKey] = useState("");
  const [extremeCost, setExtremeCost] = useState("0.01");
  const [clientRate, setClientRate] = useState("0.02");
  const [timezone, setTimezone] = useState("America/New_York");
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [webhookFrom, setWebhookFrom] = useState('');
  const [webhookBusiness, setWebhookBusiness] = useState('');
  const [webhookMessage, setWebhookMessage] = useState('');
  const [webhookMessageId, setWebhookMessageId] = useState('');
  const [flowBusiness, setFlowBusiness] = useState('');
  const [editDeliveryMode, setEditDeliveryMode] = useState<'poll' | 'push' | 'both'>('poll');
  const [editWebhookUrl, setEditWebhookUrl] = useState('');
  const [editWebhookSecret, setEditWebhookSecret] = useState('');

  const usTimezones = [
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Detroit", label: "Eastern Time - Michigan" },
    { value: "America/Kentucky/Louisville", label: "Eastern Time - Louisville, KY" },
    { value: "America/Indiana/Indianapolis", label: "Eastern Time - Indianapolis" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Indiana/Knox", label: "Central Time - Knox, IN" },
    { value: "America/Menominee", label: "Central Time - Menominee, MI" },
    { value: "America/North_Dakota/Center", label: "Central Time - North Dakota" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Boise", label: "Mountain Time - Boise" },
    { value: "America/Phoenix", label: "Mountain Time - Arizona (no DST)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Anchorage", label: "Alaska Time (AKT)" },
    { value: "America/Juneau", label: "Alaska Time - Juneau" },
    { value: "America/Adak", label: "Hawaii-Aleutian Time (HAT)" },
    { value: "Pacific/Honolulu", label: "Hawaii-Aleutian Time - Honolulu (no DST)" },
  ];

  const { data: config } = useQuery<{ success: boolean; config: Record<string, string> }>({ queryKey: ['/api/admin/config'] });
  const { data: profile } = useQuery<{ user: { id: string; role: string } }>({ queryKey: ['/api/client/profile'] });

  useEffect(() => {
    if (config?.config) {
      setExtremeApiKey(config.config.extreme_api_key || "");
      setExtremeCost(config.config.extreme_cost_per_sms || "0.01");
      setClientRate(config.config.client_rate_per_sms || "0.02");
      setTimezone(config.config.timezone || "America/New_York");
      setWebhookBusiness(config.config.admin_default_business_id || 'IBS_0');
    }
  }, [config]);

  const saveConfigMutation = useMutation({
    mutationFn: async (data: { extremeApiKey?: string; extremeCost?: string; clientRate?: string; timezone?: string; adminDefaultBusinessId?: string }) => {
      return await apiRequest('/api/admin/config', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/config'] });
      toast({
        title: "Success",
        description: "Configuration saved successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: t("admin.config.error.saveFailed"),
        variant: "destructive"
      });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/test-connection', {
        method: 'POST'
      });
    },
    onSuccess: (data: any) => {
      setConnectionStatus('connected');
      toast({
        title: "Connection Successful",
        description: data.message || "ExtremeSMS API is working correctly"
      });
    },
    onError: (error: any) => {
      setConnectionStatus('disconnected');
      toast({
        title: "Connection Failed",
        description: error.message || t("admin.config.error.connectionFailed"),
        variant: "destructive"
      });
    }
  });

  const webhookStatusQuery = useQuery<{ success: boolean; lastEvent: any; lastEventAt: string | null; lastRoutedUser: string | null }>({
    queryKey: ['/api/admin/webhook/status']
  });
  const dbStatusQuery = useQuery<{ success: boolean; tables: string[] }>({
    queryKey: ['/api/admin/db/status']
  });
  const runMigrationsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/db/migrate', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/db/status'] });
      toast({ title: t('common.success'), description: 'Migrations applied' });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message || 'Migration failed', variant: 'destructive' });
    }
  });

  const secretsStatusQuery = useQuery<{ success: boolean; configured: Record<string, boolean> }>({
    queryKey: ['/api/admin/secrets/status']
  });
  const setWebhookUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      return await apiRequest('/api/admin/webhook/set-url', { method: 'POST', body: JSON.stringify({ url }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/secrets/status'] });
      toast({ title: 'Success', description: 'Webhook URL updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to set webhook URL', variant: 'destructive' });
    }
  });
  const rotateSecretMutation = useMutation({
    mutationFn: async (key: string) => {
      return await apiRequest('/api/admin/secrets/rotate', { method: 'POST', body: JSON.stringify({ key }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/secrets/status'] });
      toast({ title: t('common.success'), description: 'Secret rotated' });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message || 'Rotation failed', variant: 'destructive' });
    }
  });

  const webhookTestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/webhook/test', {
        method: 'POST',
        body: JSON.stringify({ from: webhookFrom, business: webhookBusiness, message: webhookMessage, messageId: webhookMessageId || undefined })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/webhook/status'] });
      toast({ title: t('common.success'), description: 'Webhook simulated and stored' });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message || 'Webhook simulation failed', variant: 'destructive' });
    }
  });

  const flowCheckMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ business: flowBusiness });
      return await apiRequest(`/api/admin/webhook/flow-check?${params.toString()}`);
    },
    onSuccess: (data: any) => {
      toast({ title: t('common.success'), description: `Receiver ${data.receiver} → routed user ${data.routedUserId || 'none'}` });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message || 'Flow check failed', variant: 'destructive' });
    }
  });

  const { data: clientsData } = useQuery<{ success: boolean; clients: Array<{
    id: string;
    name: string;
    email: string;
    apiKey: string;
    status: string;
    isActive?: boolean;
    messagesSent: number;
    credits: string;
    lastActive: string;
    assignedPhoneNumbers: string[];
    rateLimitPerMinute: number;
    businessName: string | null;
    role?: string;
    groupId?: string | null;
    deliveryMode?: 'poll' | 'push' | 'both';
    webhookUrl?: string | null;
    webhookSecret?: string | null;
    passwordSetBy?: string | null;
    passwordSetAt?: string | null;
  }> }>({
    queryKey: ['/api/admin/clients']
  });

  const [phoneInputs, setPhoneInputs] = useState<Record<string, string>>({});
  useEffect(() => {
    const init: Record<string, string> = {};
    (clientsData?.clients || []).forEach(c => {
      init[c.id] = (c.assignedPhoneNumbers || []).join(', ');
    });
    setPhoneInputs(init);
  }, [clientsData]);

  const randomPhone = () => `+${Math.floor(100000 + Math.random() * 900000)}`;

  const updatePhoneNumbersMutation = useMutation({
    mutationFn: async ({ userId, phoneNumbers }: { userId: string; phoneNumbers: string }) => {
      return await apiRequest('/api/admin/update-phone-numbers', {
        method: 'POST',
        body: JSON.stringify({ userId, phoneNumbers })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({
        title: "Success",
        description: "Phone numbers updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: t("admin.config.error.updatePhonesFailed"),
        variant: "destructive"
      });
    }
  });

  const updateRateLimitMutation = useMutation({
    mutationFn: async ({ userId, rateLimit }: { userId: string; rateLimit: number }) => {
      return await apiRequest('/api/admin/update-rate-limit', {
        method: 'POST',
        body: JSON.stringify({ userId, rateLimitPerMinute: rateLimit })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({
        title: t('common.success'),
        description: "Rate limit updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update rate limit",
        variant: "destructive"
      });
    }
  });

  const updateBusinessNameMutation = useMutation({
    mutationFn: async ({ userId, businessName }: { userId: string; businessName: string }) => {
      return await apiRequest('/api/admin/update-business-name', {
        method: 'POST',
        body: JSON.stringify({ userId, businessName })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({
        title: t('common.success'),
        description: "Business name updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update business name",
        variant: "destructive"
      });
    }
  });

  const disableUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/admin/users/${userId}/disable`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({ title: t('common.success'), description: 'User disabled and keys revoked' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to disable user', variant: 'destructive' });
    }
  });

  const enableUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/admin/users/${userId}/enable`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({ title: t('common.success'), description: 'User enabled' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to enable user', variant: 'destructive' });
    }
  });

  const revokeUserKeysMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/admin/users/${userId}/revoke-keys`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({ title: t('common.success'), description: 'All API keys revoked' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to revoke keys', variant: 'destructive' });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/v2/account/${userId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({ title: t('common.success'), description: 'User data cleared' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' });
    }
  });

  const { data: statsData } = useQuery<{ success: boolean; totalMessages: number; totalClients: number }>({
    queryKey: ['/api/admin/stats']
  });

  const { data: recentActivity } = useQuery<{ 
    success: boolean; 
    logs: Array<{
      id: string;
      endpoint: string;
      clientName: string;
      timestamp: string;
      status: string;
      recipient: string;
    }>
  }>({
    queryKey: ['/api/admin/recent-activity'],
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  });

  const { data: balanceData, isLoading: balanceLoading, error: balanceError } = useQuery<{ 
    success: boolean; 
    balance: number;
    currency: string;
  }>({
    queryKey: ['/api/admin/extremesms-balance'],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    retry: 2
  });

  const clients = clientsData?.clients || [];
  const totalMessages = statsData?.totalMessages || 0;
  const totalClients = statsData?.totalClients || clients.length;
  const extremeBalance = balanceData?.balance ?? null;
  const balanceCurrency = balanceData?.currency || 'USD';
  const sumCredits = clients.reduce((sum, c) => sum + (parseFloat(c.credits || '0') || 0), 0);
  const clientRateNumber = parseFloat(clientRate || config?.config?.client_rate_per_sms || '0') || 0;
  const creditsValueUSD = (sumCredits * clientRateNumber).toFixed(2);
  const extremeUSD = (extremeBalance !== null) ? (extremeBalance * (parseFloat(extremeCost || '0') || 0)).toFixed(2) : null;

  const syncCreditsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/credits/sync', { method: 'POST' });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/extremesms-balance'] });
      toast({ title: t('common.success'), description: t('admin.syncCredits.success').replace('{count}', String(data.adjustedCount || 0)) });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error?.message || t('admin.syncCredits.failed'), variant: 'destructive' });
    }
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate({
      extremeApiKey,
      extremeCost,
      clientRate,
      timezone,
      adminDefaultBusinessId: webhookBusiness || 'IBS_0'
    });
  };

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
            <h1 className="text-4xl font-bold tracking-tight">{t('admin.title')}</h1>
            <p className="text-muted-foreground mt-2">{t('admin.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title={t('admin.stats.totalClients')}
            value={totalClients}
            icon={Users}
            description={t('admin.stats.activeAccounts')}
          />
          <StatCard
            title={t('admin.stats.totalMessages')}
            value={totalMessages.toLocaleString()}
            icon={Activity}
            description={t('admin.stats.last30Days')}
          />
          <StatCard
            title={t('admin.stats.systemStatus')}
            value={t('admin.stats.healthy')}
            icon={Settings}
            description={t('admin.stats.allRunning')}
          />
          <StatCard
            title={'User'}
            value={(profile as any)?.user?.email || profile?.user?.id || ''}
            icon={Users}
            description={'Logged in account'}
          />
          <Card className="md:col-span-2 lg:col-span-4">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-muted-foreground">Credits Overview</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="default" onClick={() => syncCreditsMutation.mutate()} data-testid="button-sync-credits">
                    {t('admin.syncCredits')}
                  </Button>
                  <div className="p-3 rounded-lg bg-primary/10"><Wallet className="w-5 h-5 text-primary" /></div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground">IbikiSMS Balance</p>
                  <p className="text-2xl font-bold tracking-tight mt-1">
                    {balanceLoading ? 'Loading...' : balanceError ? 'Unavailable' : (
                      extremeBalance !== null ? `${extremeBalance.toLocaleString()} credits${extremeUSD ? ` (≈ $ ${extremeUSD})` : ''}` : 'N/A'
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Current account balance</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Allocated Credits</p>
                  <p className="text-2xl font-bold tracking-tight mt-1 text-red-600">
                    {sumCredits.toFixed(2)} credits (≈ $ {(sumCredits * clientRateNumber).toFixed(2)})
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Sum of all client credits</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remaining Credits</p>
                  <p className="text-2xl font-bold tracking-tight mt-1 text-red-600">
                    {extremeBalance !== null ? `${Math.max(extremeBalance - sumCredits, 0).toFixed(2)} credits (≈ $ ${(Math.max(extremeBalance - sumCredits, 0) * (parseFloat(extremeCost || '0') || 0)).toFixed(2)})` : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">IbikiSMS minus allocated</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover-elevate active-elevate-2 cursor-pointer border-2 border-blue-500/30">
            <Link href="/send-sms">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Send SMS
                </CardTitle>
                <CardDescription>
                  Send single or bulk SMS messages
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover-elevate active-elevate-2 cursor-pointer border-2 border-blue-500/30">
            <Link href="/inbox">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <InboxIcon className="h-5 w-5" />
                  Inbox
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
                  View and reply to incoming messages
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover-elevate active-elevate-2 cursor-pointer border-2 border-blue-500/30">
            <Link href="/contacts">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Contacts
                </CardTitle>
                <CardDescription>
                  Manage your contact list
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover-elevate active-elevate-2 cursor-pointer border-2 border-blue-500/30">
            <Link href="/message-history">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Message History
                </CardTitle>
                <CardDescription>
                  Track delivery status and history
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WorldClock />
          <MessageStatusChart />
        </div>

        <Tabs defaultValue="clients" data-testid="tabs-admin">
          <TabsList>
            <TabsTrigger value="clients" data-testid="tab-clients">{t('admin.tabs.clients')}</TabsTrigger>
            {profile?.user?.role === 'admin' ? (
              <>
                <TabsTrigger value="configuration" data-testid="tab-configuration">{t('admin.tabs.configuration')}</TabsTrigger>
                <TabsTrigger value="webhook" data-testid="tab-webhook">{t('admin.tabs.webhook')}</TabsTrigger>
                <TabsTrigger value="testing" data-testid="tab-testing">{t('admin.tabs.testing')}</TabsTrigger>
                <TabsTrigger value="monitoring" data-testid="tab-monitoring">{t('admin.tabs.monitoring')}</TabsTrigger>
                <TabsTrigger value="actionlogs" data-testid="tab-actionlogs">{t('admin.actionLogs')}</TabsTrigger>
              </>
            ) : (
              <TabsTrigger value="logs" data-testid="tab-logs">{t('admin.tabs.logs')}</TabsTrigger>
            )}
          </TabsList>

        <TabsContent value="clients" className="space-y-4">
          <div className="bg-muted/50 rounded p-3 text-xs">
            <div className="font-semibold mb-2">Delivery Mode Key</div>
            <div>Poll: Dashboard fetches inbox periodically; no external webhook needed.</div>
            <div>Push: System posts incoming messages to client's configured webhook URL.</div>
            <div>Both: Enable polling and webhook delivery together for redundancy.</div>
          </div>
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle>Client Management</CardTitle>
              <CardDescription>View and manage all connected clients</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap text-center">Client Name</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Email</TableHead>
                    <TableHead className="whitespace-nowrap text-center">API Key</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Status</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Messages</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Credits</TableHead>
                    <TableHead className="text-center">{t('admin.clients.table.rateLimit')}</TableHead>
                    <TableHead className="text-center">{t('admin.clients.table.businessName')}</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Assigned Numbers</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Last Active</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Delivery</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Webhook</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Role</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Group ID</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} data-testid={`row-client-${client.id}`} className="align-middle">
                      <TableCell className="font-medium py-2">{client.name}</TableCell>
                      <TableCell className="py-2">{client.email}</TableCell>
                      <TableCell className="font-mono text-[11px] max-w-[12rem] truncate py-2">
                        {client.apiKey}
                        <Button size="sm" variant="ghost" className="ml-2 px-2 h-6" onClick={() => alert(client.apiKey)}>View</Button>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={(client.isActive ?? client.status === "active") ? "default" : "secondary"}>
                          {(client.isActive ?? client.status === "active") ? 'active' : 'disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">{client.messagesSent.toLocaleString()}</TableCell>
                      <TableCell className="py-2">
                        <div className="space-y-1">
                          <span className="font-mono font-semibold" data-testid={`text-credits-${client.id}`}>
                            {parseFloat(client.credits || '0').toFixed(2)} credits
                          </span>
                          <div className="text-xs text-muted-foreground">
                            ≈ ${ ( (parseFloat(client.credits || '0') || 0) * clientRateNumber ).toFixed(2) } USD
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="200"
                          defaultValue={client.rateLimitPerMinute}
                          onBlur={(e) => {
                            const newLimit = parseInt(e.target.value);
                            if (!isNaN(newLimit) && newLimit !== client.rateLimitPerMinute) {
                              updateRateLimitMutation.mutate({ 
                                userId: client.id, 
                                rateLimit: newLimit 
                              });
                            }
                          }}
                          className="w-20 h-8"
                          data-testid={`input-rate-limit-${client.id}`}
                          title={t('admin.clients.rateLimit.description')}
                          min="1"
                          max="10000"
                          disabled={profile?.user?.role === 'supervisor'}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          placeholder={t('admin.clients.businessName.placeholder')}
                          defaultValue={client.businessName || ''}
                          onBlur={(e) => {
                            const newBusinessName = e.target.value.trim();
                            const currentBusinessName = client.businessName || '';
                            if (newBusinessName !== currentBusinessName) {
                              updateBusinessNameMutation.mutate({ 
                                userId: client.id, 
                                businessName: newBusinessName 
                              });
                            }
                          }}
                          className="w-32 h-8"
                          data-testid={`input-business-name-${client.id}`}
                          title={t('admin.clients.businessName.description')}
                        />
                      </TableCell>
                      {profile?.user?.role === 'admin' && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            placeholder="+123456, +234567"
                            value={phoneInputs[client.id] ?? (client.assignedPhoneNumbers || []).join(', ')}
                            onChange={(e) => setPhoneInputs(p => ({ ...p, [client.id]: e.target.value }))}
                            onBlur={(e) => {
                              const newPhones = e.target.value.trim();
                              const currentPhones = (client.assignedPhoneNumbers || []).join(', ');
                              if (newPhones !== currentPhones) {
                                updatePhoneNumbersMutation.mutate({ 
                                  userId: client.id, 
                                  phoneNumbers: newPhones 
                                });
                              }
                            }}
                            className="w-40 h-8 font-mono text-[11px]"
                            data-testid={`input-phones-${client.id}`}
                            title="Enter multiple numbers separated by commas"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const next = randomPhone();
                              setPhoneInputs(p => {
                                const current = (p[client.id] ?? (client.assignedPhoneNumbers || []).join(', ')).trim();
                                const updated = current ? `${current}, ${next}` : next;
                                updatePhoneNumbersMutation.mutate({ userId: client.id, phoneNumbers: updated });
                                return { ...p, [client.id]: updated };
                              });
                            }}
                            className="h-8">
                            Random
                          </Button>
                        </div>
                      </TableCell>
                      )}
                      <TableCell className="text-muted-foreground py-2">{client.lastActive}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <select
                              className="border rounded px-2 py-1 text-xs"
                              defaultValue={(client.deliveryMode || 'poll') as any}
                              onChange={(e) => setEditDeliveryMode(e.target.value as any)}
                              disabled={profile?.user?.role === 'supervisor'}
                            >
                              <option value="poll">Poll</option>
                              <option value="push">Push</option>
                              <option value="both">Both</option>
                            </select>
                            <Button size="sm" variant="outline" onClick={() => {
                              apiRequest(`/api/admin/clients/${client.id}/delivery-mode`, { method: 'POST', body: JSON.stringify({ mode: editDeliveryMode }) })
                                .then(() => queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] }));
                            }} className="h-7 px-2 text-xs">Save</Button>
                          </div>
                        </TableCell>
                      <TableCell className="py-2">
                        <div className="w-40 flex items-center justify-center gap-2">
                          <WebhookEditDialog clientId={client.id} currentUrl={client.webhookUrl} currentSecret={client.webhookSecret} triggerLabel="URL" buttonVariant="outline" buttonClassName="h-8 px-3 text-xs rounded" />
                          <WebhookEditDialog clientId={client.id} currentUrl={client.webhookUrl} currentSecret={client.webhookSecret} triggerLabel="Secret" buttonVariant="outline" buttonClassName="h-8 px-3 text-xs rounded" />
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <select defaultValue={client.role || 'client'} className="border rounded px-2 py-1 text-xs h-8" onChange={(e) => {
                          const nextRole = e.target.value;
                          apiRequest(`/api/admin/users/${client.id}/role`, { method: 'POST', body: JSON.stringify({ role: nextRole }) })
                            .then(() => {
                              queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
                              toast({ title: 'Saved', description: 'Role updated' });
                            })
                            .catch((err: any) => {
                              toast({ title: 'Error', description: err?.message || 'Failed to update role', variant: 'destructive' });
                            });
                        }}>
                          <option value="admin">Admin</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="client">User</option>
                        </select>
                      </TableCell>
                      <TableCell className="py-2">
                        <Input defaultValue={client.groupId || ''} placeholder="GROUP-ID" className="w-32 h-8 text-xs" onBlur={(e) => {
                          const v = e.target.value.trim();
                          apiRequest(`/api/admin/users/${client.id}/group`, { method: 'POST', body: JSON.stringify({ groupId: v }) })
                            .then(() => {
                              queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
                              toast({ title: 'Saved', description: 'Group ID updated' });
                            })
                            .catch((err: any) => {
                              toast({ title: 'Error', description: err?.message || 'Failed to update group', variant: 'destructive' });
                            });
                        }} onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const v = (e.target as HTMLInputElement).value.trim();
                            apiRequest(`/api/admin/users/${client.id}/group`, { method: 'POST', body: JSON.stringify({ groupId: v }) })
                              .then(() => {
                                queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
                                toast({ title: 'Saved', description: 'Group ID updated' });
                              })
                              .catch((err: any) => {
                                toast({ title: 'Error', description: err?.message || 'Failed to update group', variant: 'destructive' });
                              });
                          }
                        }} />
                      </TableCell>
                      <TableCell className="align-top py-2">
                        {profile?.user?.role === 'admin' ? (
                        <div className="grid grid-cols-2 md:grid-cols-1 gap-2 items-start min-w-[12rem]">
                          <AddCreditsToClientDialog 
                            clientId={client.id}
                            clientName={client.name}
                            currentCredits={client.credits}
                            triggerMode="add"
                            triggerLabel="$ Add"
                            buttonVariant="default"
                            buttonClassName="w-full h-7 justify-center bg-green-600 text-white hover:bg-green-700 border border-green-700 text-xs"
                          />
                          <AddCreditsToClientDialog 
                            clientId={client.id}
                            clientName={client.name}
                            currentCredits={client.credits}
                            triggerMode="deduct"
                            triggerLabel="$ Deduct"
                            buttonVariant="outline"
                            buttonClassName="w-full h-7 justify-center bg-orange-100 text-orange-800 border border-orange-500 hover:bg-orange-200 text-xs"
                          />
                          {!(client.isActive ?? client.status === 'active') ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => enableUserMutation.mutate(client.id)}
                              data-testid={`button-enable-${client.id}`}
                            className="h-7 px-2 text-xs">
                              Enable
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => disableUserMutation.mutate(client.id)}
                              data-testid={`button-disable-${client.id}`}
                            className="h-7 px-2 text-xs">
                              Disable
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => revokeUserKeysMutation.mutate(client.id)}
                            data-testid={`button-revoke-keys-${client.id}`}
                          className="h-7 px-2 text-xs">
                            Revoke Keys
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const msg = 'This action will totally remove the user profile from Ibiki, this action is irreversible.\n\nProceed to PURGE this user?';
                              if (confirm(msg)) {
                                deleteUserMutation.mutate(client.id);
                              }
                            }}
                            data-testid={`button-purge-${client.id}`}
                          className="h-7 px-2 text-xs">
                            Purge
                          </Button>
                          <div className="text-[10px]">
                            {client.passwordSetBy ? (
                              <div>
                                <div>Set by {client.passwordSetBy}</div>
                                <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-800 text-[10px]">PWD set</span>
                              </div>
                            ) : null}
                          </div>
                          {/* Reset Password */}
                          {client.role !== 'admin' && (
                            <div className="flex justify-center">
                              {/* @ts-ignore */}
                              <ResetPasswordDialog clientId={client.id} clientName={client.name} />
                            </div>
                          )}
                        </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">—</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle>{t('admin.config.title')}</CardTitle>
              <CardDescription>
                {t('admin.config.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveConfig} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="extremeApiKey">IbikiSMS API Key</Label>
                  <Input
                    id="extremeApiKey"
                    type="password"
                    placeholder="Enter IbikiSMS API key"
                    value={extremeApiKey}
                    onChange={(e) => setExtremeApiKey(e.target.value)}
                    data-testid="input-extreme-api-key"
                  />
                  <p className="text-xs text-muted-foreground">
                    This key is used to authenticate with IbikiSMS on behalf of all clients
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">System Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone" data-testid="select-timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {usTimezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    All timestamps in the system will be displayed in this timezone
                  </p>
                </div>

                {profile?.user?.role === 'admin' && (
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="text-lg font-semibold">Pricing Configuration</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="extremeCost">IbikiSMS Cost per SMS (USD)</Label>
                        <Input
                          id="extremeCost"
                          type="number"
                          step="0.0001"
                          placeholder="0.01"
                          value={extremeCost}
                          onChange={(e) => setExtremeCost(e.target.value)}
                          data-testid="input-extreme-cost"
                        />
                        <p className="text-xs text-muted-foreground">
                          What IbikiSMS charges you per message
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="clientRate">Client Rate per SMS (USD)</Label>
                        <Input
                          id="clientRate"
                          type="number"
                          step="0.0001"
                          placeholder="0.02"
                          value={clientRate}
                          onChange={(e) => setClientRate(e.target.value)}
                          data-testid="input-client-rate"
                        />
                        <p className="text-xs text-muted-foreground">
                          What you charge your clients per message
                        </p>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Profit Margin per SMS:</span>
                        <span className="text-lg font-bold text-primary" data-testid="text-profit-margin">
                          ${(parseFloat(clientRate || "0") - parseFloat(extremeCost || "0")).toFixed(4)} USD
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button type="submit" data-testid="button-save-config" disabled={saveConfigMutation.isPending}>
                    {saveConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    data-testid="button-test-connection"
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending}
                  >
                    {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
                  </Button>
                  {connectionStatus !== 'unknown' && (
                    <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
                      {connectionStatus === 'connected' ? '✓ Connected' : '✗ Disconnected'}
                    </Badge>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle>{t('admin.envDb.title')}</CardTitle>
              <CardDescription>Overview of critical configuration and database state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Database Connection</span>
                    {dbStatusQuery.isLoading ? (
                      <Badge variant="secondary">Checking…</Badge>
                    ) : dbStatusQuery.data?.success ? (
                      <Badge>Connected</Badge>
                    ) : (
                      <Badge variant="destructive">Error</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tables: {dbStatusQuery.data?.tables ? dbStatusQuery.data.tables.length : 0}
                  </div>
                  {dbStatusQuery.data?.tables && dbStatusQuery.data.tables.length > 0 && (
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {dbStatusQuery.data.tables.slice(0, 10).join('\n')}
                    </pre>
                  )}
                  <div className="flex items-center gap-2">
                    <Button onClick={() => runMigrationsMutation.mutate()} disabled={runMigrationsMutation.isPending}>
                      {runMigrationsMutation.isPending ? t('common.loading') : t('admin.envDb.runMigrations')}
                    </Button>
                    <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/db/status'] })}>{t('common.refresh')}</Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">IbikiSMS Key</span>
                    {(config?.config?.extreme_api_key) ? <Badge>Configured</Badge> : <Badge variant="secondary">Not set</Badge>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Timezone</span>
                    {(config?.config?.timezone) ? <Badge>Configured</Badge> : <Badge variant="secondary">Not set</Badge>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Client Rate per SMS</span>
                    {(config?.config?.client_rate_per_sms) ? <Badge>Configured</Badge> : <Badge variant="secondary">Not set</Badge>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">IbikiSMS Cost per SMS</span>
                    {(config?.config?.extreme_cost_per_sms) ? <Badge>Configured</Badge> : <Badge variant="secondary">Not set</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Note: JWT/Session secrets are stored in server environment and not displayed.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">JWT Secret</span>
                      <div className="flex items-center gap-2">
                        {secretsStatusQuery.data?.configured?.jwt_secret ? <Badge>Configured</Badge> : <Badge variant="secondary">Not set</Badge>}
                        {secretsStatusQuery.data?.envPresent?.JWT_SECRET ? <Badge>Env present</Badge> : <Badge variant="secondary">Env missing</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Session Secret</span>
                      <div className="flex items-center gap-2">
                        {secretsStatusQuery.data?.configured?.session_secret ? <Badge>Configured</Badge> : <Badge variant="secondary">Not set</Badge>}
                        {secretsStatusQuery.data?.envPresent?.SESSION_SECRET ? <Badge>Env present</Badge> : <Badge variant="secondary">Env missing</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Webhook Secret</span>
                      <div className="flex items-center gap-2">
                        {secretsStatusQuery.data?.configured?.webhook_secret ? <Badge>Configured</Badge> : <Badge variant="secondary">Not set</Badge>}
                        {secretsStatusQuery.data?.envPresent?.WEBHOOK_SECRET ? <Badge>Env present</Badge> : <Badge variant="secondary">Env missing</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Resend API Key</span>
                      <div className="flex items-center gap-2">
                        {secretsStatusQuery.data?.configured?.resend_api_key ? <Badge>Configured</Badge> : <Badge variant="secondary">Not set</Badge>}
                        {secretsStatusQuery.data?.envPresent?.RESEND_API_KEY ? <Badge>Env present</Badge> : <Badge variant="secondary">Env missing</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button variant="outline" onClick={() => rotateSecretMutation.mutate('jwt_secret')} disabled={rotateSecretMutation.isPending}>Rotate JWT</Button>
                    <Button variant="outline" onClick={() => rotateSecretMutation.mutate('session_secret')} disabled={rotateSecretMutation.isPending}>Rotate Session</Button>
                    <Button variant="outline" onClick={() => rotateSecretMutation.mutate('webhook_secret')} disabled={rotateSecretMutation.isPending}>Rotate Webhook</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhook" className="space-y-4">
              <Card className="border border-border/60">
                <CardHeader>
                  <CardTitle>{t('docs.webhook.title')}</CardTitle>
                  <CardDescription>
                    {t('docs.webhook.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">{t('admin.webhook.suggestedUrl')}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={secretsStatusQuery.data?.suggestedWebhook || ''}
                        readOnly
                        className="font-mono text-sm"
                        data-testid="input-webhook-url"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          const val = secretsStatusQuery.data?.suggestedWebhook || '';
                          const copyText = async (text: string) => {
                            try {
                              if (navigator.clipboard && window.isSecureContext && typeof navigator.clipboard.writeText === 'function') {
                                await navigator.clipboard.writeText(text);
                                return true;
                              }
                            } catch {}
                            const textarea = document.createElement('textarea');
                            textarea.value = text;
                            textarea.style.position = 'fixed';
                            textarea.style.opacity = '0';
                            document.body.appendChild(textarea);
                            textarea.focus();
                            textarea.select();
                            let success = false;
                            try {
                              success = document.execCommand('copy');
                            } catch {}
                            if (!success) {
                              const handler = (e: ClipboardEvent) => {
                                e.preventDefault();
                                e.clipboardData?.setData('text/plain', text);
                              };
                              document.addEventListener('copy', handler);
                              try { success = document.execCommand('copy'); } catch {}
                              document.removeEventListener('copy', handler);
                            }
                            document.body.removeChild(textarea);
                            return success;
                          };
                          const ok = await copyText(val);
                          toast({ title: ok ? "Copied!" : "Copy failed", description: ok ? "Webhook URL copied to clipboard" : "Unable to copy to clipboard", variant: ok ? undefined : 'destructive' });
                        }}
                        data-testid="button-copy-webhook"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure this URL in your SMS provider dashboard under "Incoming Messages" or webhook settings
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      <div>
                        <Label>{t('admin.webhook.configuredUrl')}</Label>
                        <Input
                          defaultValue={secretsStatusQuery.data?.configuredWebhook || ''}
                          onBlur={(e) => {
                            const url = e.target.value.trim();
                            if (url) setWebhookUrlMutation.mutate(url);
                          }}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div>
                        <Label>Admin Business ID</Label>
                        <Input
                          value={webhookBusiness}
                          onChange={(e) => setWebhookBusiness(e.target.value)}
                          placeholder="IBS_0"
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button variant="outline" onClick={() => {
                          const val = secretsStatusQuery.data?.suggestedWebhook || '';
                          if (val) setWebhookUrlMutation.mutate(val);
                        }}>{t('admin.webhook.setToSuggested')}</Button>
                      </div>
                      <div className="flex items-end">
                        <Button onClick={handleSaveConfig} disabled={saveConfigMutation.isPending}>Save Admin Business ID</Button>
                      </div>
                    </div>
                  </div>

              <div className="border-t pt-6 space-y-3">
                <h3 className="text-base font-semibold">Setup Instructions</h3>
                <ol className="space-y-2 text-sm list-decimal list-inside">
                  <li>Login to your SMS provider account</li>
                  <li>Navigate to Settings → Webhooks or Incoming Messages</li>
                  <li>Paste the webhook URL above</li>
                  <li>Select "POST" as the method</li>
                  <li>Save the configuration</li>
                  <li>Test by sending an SMS to one of your numbers</li>
                </ol>
              </div>

              <div className="border-t pt-6 space-y-3">
                <h3 className="text-base font-semibold">How It Works</h3>
                <div className="bg-muted rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Automatic Routing</p>
                      <p className="text-sm text-muted-foreground">
                        When someone replies to your client's phone number, the SMS provider sends the message to this webhook. The system automatically routes it to the correct client based on their assigned phone numbers.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Multiple Numbers Support</p>
                      <p className="text-sm text-muted-foreground">
                        Each client can have multiple phone numbers assigned. ALL replies to ANY of their numbers will be delivered to their inbox.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Client Dashboard</p>
                      <p className="text-sm text-muted-foreground">
                        Clients see incoming messages in their dashboard with auto-refresh every 5 seconds. No technical setup required on their end.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 space-y-3">
                <h3 className="text-base font-semibold">Expected Payload Format</h3>
                <p className="text-sm text-muted-foreground">
                  Your SMS provider will send POST requests with this structure:
                </p>
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto">
{`{
  "from": "+1234567890",
  "firstname": "John",
  "lastname": "Doe",
  "business": "ABC Company",
  "message": "Reply message text",
  "status": "received",
  "matchedBlockWord": null,
  "receiver": "+1987654321",
  "usedmodem": "modem_id",
  "port": "port_number",
  "timestamp": "2025-11-18T10:30:00.000Z",
  "messageId": "unique_msg_id"
}`}
                </pre>
              </div>

              <div className="border-t pt-6">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    ⚠️ Important: Assign Phone Numbers
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Make sure to assign phone numbers to your clients in the "Client Management" tab. Messages will only be routed if the receiver number matches a client's assigned numbers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle>Webhook Diagnostics</CardTitle>
              <CardDescription>Simulate inbound webhook and verify routing to Ibiki inbox</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>From (sender phone)</Label>
                  <Input value={webhookFrom} onChange={(e) => setWebhookFrom(e.target.value)} placeholder="+1-555-0000" />
                </div>
                <div>
                  <Label>Business</Label>
                  <Input value={webhookBusiness} onChange={(e) => setWebhookBusiness(e.target.value)} placeholder="Client business name" />
                </div>
                <div>
                  <Label>Message</Label>
                  <Input value={webhookMessage} onChange={(e) => setWebhookMessage(e.target.value)} placeholder="Hello from test" />
                </div>
                <div>
                  <Label>Message ID (optional)</Label>
                  <Input value={webhookMessageId} onChange={(e) => setWebhookMessageId(e.target.value)} placeholder="Provide custom messageId" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Button onClick={() => webhookTestMutation.mutate()} disabled={webhookTestMutation.isPending}>
                  {webhookTestMutation.isPending ? t('common.loading') : 'Send Test Webhook'}
                </Button>
                <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/webhook/status'] })}>Refresh Status</Button>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 border rounded">
                  <h4 className="font-semibold mb-2">Last Webhook Event</h4>
                  <p className="text-xs text-muted-foreground">At: {webhookStatusQuery.data?.lastEventAt || '—'}</p>
                  <p className="text-xs">Message ID: {webhookStatusQuery.data?.lastEvent?.messageId || '—'}</p>
                  <p className="text-xs">Modem: {webhookStatusQuery.data?.lastEvent?.usedmodem || '—'} · Port: {webhookStatusQuery.data?.lastEvent?.port || '—'}</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(webhookStatusQuery.data?.lastEvent || null, null, 2)}</pre>
                  <p className="text-xs mt-2">Routed User: {webhookStatusQuery.data?.lastRoutedUser || '—'}</p>
                </div>
                <div className="p-3 border rounded">
                  <h4 className="font-semibold mb-2">Flow Check</h4>
                  <Label>Business</Label>
                  <Input value={flowBusiness} onChange={(e) => setFlowBusiness(e.target.value)} placeholder="Client business name" />
                  <Button className="mt-2" onClick={() => flowCheckMutation.mutate()} disabled={flowCheckMutation.isPending}>
                    {flowCheckMutation.isPending ? t('common.loading') : 'Check Routing'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <ApiTestUtility />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {profile?.user?.role === 'admin' ? <ErrorLogsViewer /> : <SupervisorLogsTable />}
        </TabsContent>



        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent API Activity</CardTitle>
              <CardDescription>Monitor real-time API requests and responses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity?.logs && recentActivity.logs.length > 0 ? (
                  recentActivity.logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border border-border" data-testid={`activity-${log.id}`}>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.endpoint}</p>
                        <p className="text-xs text-muted-foreground">
                          Client: {log.clientName} • {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <Badge 
                        className={
                          log.status === 'delivered' || log.status === 'sent' || log.status === 'queued'
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }
                      >
                        {log.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No recent API activity</p>
                    <p className="text-xs mt-1">Activity will appear here when clients use the API</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
function SupervisorLogsTable() {
  const { data } = useQuery<{ success: boolean; logs: Array<{ id: string; actorUserId: string; actorRole: string; targetUserId: string | null; action: string; details: string | null; createdAt: string }> }>({
    queryKey: ['/api/supervisor/logs'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/supervisor/logs', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || 'Failed to fetch logs');
      }
      return r.json();
    }
  });
  const logs = data?.logs || [];
  const exportTxt = () => {
    const lines = logs.map(l => `${l.createdAt} | actor=${l.actorUserId}(${l.actorRole}) | action=${l.action} | target=${l.targetUserId || ''} | details=${l.details || ''}`).join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'group-logs.txt'; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportTxt}>{t('logs.export') || 'Export'}</Button>
      </div>
      <div className="max-h-[65vh] overflow-y-auto rounded border">
        <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target User</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map(l => (
            <TableRow key={l.id}>
              <TableCell>{new Date(l.createdAt).toLocaleString()}</TableCell>
              <TableCell className="font-mono text-xs">{l.actorUserId}</TableCell>
              <TableCell>{l.actorRole}</TableCell>
              <TableCell className="font-mono text-xs">{l.action}</TableCell>
              <TableCell className="font-mono text-xs">{l.targetUserId || '-'}</TableCell>
              <TableCell className="font-mono text-xs break-words">{l.details || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
