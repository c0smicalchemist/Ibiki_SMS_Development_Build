import { useState, useEffect } from "react";
import { Users, Settings, Activity, ArrowLeft, Wallet, Copy, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function AdminDashboard() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [extremeApiKey, setExtremeApiKey] = useState("");
  const [extremeCost, setExtremeCost] = useState("0.01");
  const [clientRate, setClientRate] = useState("0.02");
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  const { data: config } = useQuery<{ success: boolean; config: Record<string, string> }>({
    queryKey: ['/api/admin/config']
  });

  useEffect(() => {
    if (config?.config) {
      setExtremeApiKey(config.config.extreme_api_key || "");
      setExtremeCost(config.config.extreme_cost_per_sms || "0.01");
      setClientRate(config.config.client_rate_per_sms || "0.02");
    }
  }, [config]);

  const saveConfigMutation = useMutation({
    mutationFn: async (data: { extremeApiKey?: string; extremeCost?: string; clientRate?: string }) => {
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
        description: "Failed to save configuration",
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
        description: error.message || "Failed to connect to ExtremeSMS API",
        variant: "destructive"
      });
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
        description: "Failed to update phone numbers",
        variant: "destructive"
      });
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
      clientRate
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
                        <AddCreditsToClientDialog 
                          clientId={client.id}
                          clientName={client.name}
                          currentCredits={client.credits}
                        />
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
