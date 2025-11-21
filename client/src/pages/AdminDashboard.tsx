import { useState, useEffect } from "react";
import { Users, Settings, Activity, ArrowLeft, Wallet, Copy, CheckCircle, Send, Inbox as InboxIcon, Clock } from "lucide-react";
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
  const [webhookReceiver, setWebhookReceiver] = useState('');
  const [webhookMessage, setWebhookMessage] = useState('');
  const [flowReceiver, setFlowReceiver] = useState('');

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

  const { data: config } = useQuery<{ success: boolean; config: Record<string, string> }>({
    queryKey: ['/api/admin/config']
  });

  useEffect(() => {
    if (config?.config) {
      setExtremeApiKey(config.config.extreme_api_key || "");
      setExtremeCost(config.config.extreme_cost_per_sms || "0.01");
      setClientRate(config.config.client_rate_per_sms || "0.02");
      setTimezone(config.config.timezone || "America/New_York");
    }
  }, [config]);

  const saveConfigMutation = useMutation({
    mutationFn: async (data: { extremeApiKey?: string; extremeCost?: string; clientRate?: string; timezone?: string }) => {
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

  const webhookTestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/webhook/test', {
        method: 'POST',
        body: JSON.stringify({ from: webhookFrom, receiver: webhookReceiver, message: webhookMessage })
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
      const params = new URLSearchParams({ receiver: flowReceiver });
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
    messagesSent: number;
    credits: string;
    lastActive: string;
    assignedPhoneNumbers: string[];
    rateLimitPerMinute: number;
    businessName: string | null;
  }> }>({
    queryKey: ['/api/admin/clients']
  });

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
      return await apiRequest(`/api/admin/users/${userId}/delete`, { method: 'POST' });
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

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate({
      extremeApiKey,
      extremeCost,
      clientRate,
      timezone
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
            title="ExtremeSMS Balance"
            value={
              balanceLoading ? "Loading..." : 
              balanceError ? "Unavailable" :
              extremeBalance !== null ? `${balanceCurrency} ${extremeBalance.toLocaleString()}` : "N/A"
            }
            icon={Wallet}
            description={balanceError ? "Unable to fetch balance" : "Current account balance"}
          />
          <StatCard
            title={t('admin.stats.systemStatus')}
            value={t('admin.stats.healthy')}
            icon={Settings}
            description={t('admin.stats.allRunning')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover-elevate active-elevate-2 cursor-pointer">
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
          <Card className="hover-elevate active-elevate-2 cursor-pointer">
            <Link href="/inbox">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <InboxIcon className="h-5 w-5" />
                  Inbox
                </CardTitle>
                <CardDescription>
                  View and reply to incoming messages
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover-elevate active-elevate-2 cursor-pointer">
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
          <Card className="hover-elevate active-elevate-2 cursor-pointer">
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
            <TabsTrigger value="configuration" data-testid="tab-configuration">{t('admin.tabs.configuration')}</TabsTrigger>
            <TabsTrigger value="webhook" data-testid="tab-webhook">Webhook Setup</TabsTrigger>
            <TabsTrigger value="testing" data-testid="tab-testing">API Testing</TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">Error Logs</TabsTrigger>
            <TabsTrigger value="monitoring" data-testid="tab-monitoring">{t('admin.tabs.monitoring')}</TabsTrigger>
          </TabsList>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Management</CardTitle>
              <CardDescription>View and manage all connected clients</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Messages Sent</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>{t('admin.clients.table.rateLimit')}</TableHead>
                    <TableHead>{t('admin.clients.table.businessName')}</TableHead>
                    <TableHead>Assigned Numbers</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell className="font-mono text-sm">{client.apiKey}</TableCell>
                      <TableCell>
                        <Badge variant={client.status === "active" ? "default" : "secondary"}>
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{client.messagesSent.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold" data-testid={`text-credits-${client.id}`}>
                          ${parseFloat(client.credits).toFixed(2)}
                        </span>
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
                          className="w-24"
                          data-testid={`input-rate-limit-${client.id}`}
                          title={t('admin.clients.rateLimit.description')}
                          min="1"
                          max="10000"
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
                          className="w-36"
                          data-testid={`input-business-name-${client.id}`}
                          title={t('admin.clients.businessName.description')}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          placeholder="+1111, +2222, +3333"
                          defaultValue={(client.assignedPhoneNumbers || []).join(', ')}
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
                          className="w-48 font-mono text-xs"
                          data-testid={`input-phones-${client.id}`}
                          title="Enter multiple numbers separated by commas"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{client.lastActive}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AddCreditsToClientDialog 
                            clientId={client.id}
                            clientName={client.name}
                            currentCredits={client.credits}
                          />
                          {client.status === 'disabled' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => enableUserMutation.mutate(client.id)}
                              data-testid={`button-enable-${client.id}`}
                            >
                              Enable
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => disableUserMutation.mutate(client.id)}
                              data-testid={`button-disable-${client.id}`}
                            >
                              Disable
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => revokeUserKeysMutation.mutate(client.id)}
                            data-testid={`button-revoke-keys-${client.id}`}
                          >
                            Revoke Keys
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`Delete user ${client.name}? This will disable the account, revoke keys, and clear contacts.`)) {
                                deleteUserMutation.mutate(client.id);
                              }
                            }}
                            data-testid={`button-delete-${client.id}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ExtremeSMS Configuration</CardTitle>
              <CardDescription>
                Configure the connection to ExtremeSMS API. Changes will affect all clients.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveConfig} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="extremeApiKey">ExtremeSMS API Key</Label>
                  <Input
                    id="extremeApiKey"
                    type="password"
                    placeholder="Enter ExtremeSMS API key"
                    value={extremeApiKey}
                    onChange={(e) => setExtremeApiKey(e.target.value)}
                    data-testid="input-extreme-api-key"
                  />
                  <p className="text-xs text-muted-foreground">
                    This key is used to authenticate with ExtremeSMS on behalf of all clients
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

                <div className="border-t pt-6 space-y-4">
                  <h3 className="text-lg font-semibold">Pricing Configuration</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="extremeCost">ExtremeSMS Cost per SMS (USD)</Label>
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
                        What ExtremeSMS charges you per message
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
        </TabsContent>

        <TabsContent value="webhook" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration (2-Way SMS)</CardTitle>
              <CardDescription>
                Configure this webhook URL in your SMS provider account to receive incoming messages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Webhook URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value="http://151.243.109.79/webhook/incoming-sms"
                    readOnly
                    className="font-mono text-sm"
                    data-testid="input-webhook-url"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText("http://151.243.109.79/webhook/incoming-sms");
                      toast({
                        title: "Copied!",
                        description: "Webhook URL copied to clipboard"
                      });
                    }}
                    data-testid="button-copy-webhook"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Copy this URL and configure it in your SMS provider dashboard under "Incoming Messages" or webhook settings
                </p>
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

          <Card>
            <CardHeader>
              <CardTitle>Webhook Diagnostics</CardTitle>
              <CardDescription>Simulate inbound webhook and verify routing to Ibiki inbox</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>From (sender phone)</Label>
                  <Input value={webhookFrom} onChange={(e) => setWebhookFrom(e.target.value)} placeholder="+1-555-0000" />
                </div>
                <div>
                  <Label>Receiver (your number)</Label>
                  <Input value={webhookReceiver} onChange={(e) => setWebhookReceiver(e.target.value)} placeholder="Assigned phone number" />
                </div>
                <div>
                  <Label>Message</Label>
                  <Input value={webhookMessage} onChange={(e) => setWebhookMessage(e.target.value)} placeholder="Hello from test" />
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
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(webhookStatusQuery.data?.lastEvent || null, null, 2)}</pre>
                  <p className="text-xs mt-2">Routed User: {webhookStatusQuery.data?.lastRoutedUser || '—'}</p>
                </div>
                <div className="p-3 border rounded">
                  <h4 className="font-semibold mb-2">Flow Check</h4>
                  <Label>Receiver Number</Label>
                  <Input value={flowReceiver} onChange={(e) => setFlowReceiver(e.target.value)} placeholder="Assigned phone number" />
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
          <ErrorLogsViewer />
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
