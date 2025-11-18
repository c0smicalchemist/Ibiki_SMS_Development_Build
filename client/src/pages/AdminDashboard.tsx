import { useState, useEffect } from "react";
import { Users, Settings, Activity, ArrowLeft } from "lucide-react";
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
    lastActive: string;
  }> }>({
    queryKey: ['/api/admin/clients']
  });

  const clients = clientsData?.clients || [];

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title={t('admin.stats.totalClients')}
            value={clients.length}
            icon={Users}
            description={t('admin.stats.activeAccounts')}
          />
          <StatCard
            title={t('admin.stats.totalMessages')}
            value="2,420"
            icon={Activity}
            description={t('admin.stats.last30Days')}
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
                      <TableCell className="text-muted-foreground">{client.lastActive}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" data-testid={`button-view-${client.id}`}>
                          View
                        </Button>
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

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent API Activity</CardTitle>
              <CardDescription>Monitor real-time API requests and responses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="flex items-center justify-between p-3 rounded-lg border border-border" data-testid={`activity-${item}`}>
                    <div>
                      <p className="text-sm font-medium">POST /api/v2/sms/sendsingle</p>
                      <p className="text-xs text-muted-foreground">Client: Acme Corp • 2 minutes ago</p>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">200 OK</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
