import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, RefreshCw, Clock } from "lucide-react";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClientSelector } from "@/components/ClientSelector";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface MessageLog {
  id: string;
  messageId: string;
  userId: string;
  endpoint: string;
  recipient: string | null;
  recipients: string[] | null;
  status: string;
  costPerMessage: string;
  chargePerMessage: string;
  totalCost: string;
  totalCharge: string;
  messageCount: number;
  requestPayload: string | null;
  responsePayload: string | null;
  createdAt: string;
}

export default function MessageHistory() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() => {
    return localStorage.getItem('selectedClientId');
  });
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    return localStorage.getItem('isAdminMode') === 'true';
  });
  const messagesPerPage = 10;

  // Store selected client in localStorage
  useEffect(() => {
    if (selectedClientId) {
      localStorage.setItem('selectedClientId', selectedClientId);
    } else {
      localStorage.removeItem('selectedClientId');
    }
  }, [selectedClientId]);

  // Store admin mode in localStorage
  useEffect(() => {
    localStorage.setItem('isAdminMode', isAdminMode.toString());
  }, [isAdminMode]);

  // Fetch current user profile
  const { data: profile } = useQuery<{
    user: { id: string; email: string; name: string; company: string | null; role: string };
    businessName?: string | null;
  }>({
    queryKey: ['/api/client/profile']
  });

  const isAdmin = profile?.user?.role === 'admin';
  const effectiveUserId = isAdmin && !isAdminMode && selectedClientId ? selectedClientId : undefined;

  // Admin clients list (to resolve selected client's business name)
  const { data: adminClients } = useQuery<{ success: boolean; clients: Array<{ id: string; email: string; name: string; businessName?: string | null }> }>({
    queryKey: ['/api/admin/clients'],
    enabled: !!isAdmin,
  });

  // Fetch message logs
  const { data: messagesData, isLoading } = useQuery<{ 
    success: boolean; 
    messages: MessageLog[];
    count: number;
  }>({
    queryKey: effectiveUserId 
      ? ['/api/admin/messages', effectiveUserId]
      : ['/api/client/messages'],
    queryFn: async () => {
      const endpoint = effectiveUserId 
        ? `/api/admin/messages?userId=${effectiveUserId}`
        : '/api/client/messages';
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Mutation to refresh status
  const refreshStatusMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/dashboard/sms/status/${messageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to refresh status');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both general and specific parameterized queries
      queryClient.invalidateQueries({ queryKey: ['/api/client/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/messages'] });
      if (effectiveUserId) {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/messages', effectiveUserId] });
      }
      toast({
        title: t('common.success'),
        description: "Status updated successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('messageHistory.error.fetchFailed'),
      });
    }
  });

  const messages = messagesData?.messages || [];
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkNumbers, setBulkNumbers] = useState<string[]>([]);
  const [bulkIds, setBulkIds] = useState<string[]>([]);

  // Safe JSON parse helper
  const safeJsonParse = (jsonString: string | null): any => {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  };

  const extractMessageIds = (msg: MessageLog): string[] => {
    const ids: string[] = [];
    const response = safeJsonParse(msg.responsePayload);
    if (response && typeof response === 'object') {
      if (typeof response.messageId === 'string') ids.push(response.messageId);
      if (Array.isArray(response.messageIds)) ids.push(...response.messageIds.filter((x: any) => typeof x === 'string'));
      if (Array.isArray(response.ids)) ids.push(...response.ids.filter((x: any) => typeof x === 'string'));
      if (Array.isArray(response.messages)) {
        for (const m of response.messages) {
          if (m && typeof m.messageId === 'string') ids.push(m.messageId);
        }
      }
    }
    if (ids.length === 0 && typeof msg.responsePayload === 'string' && msg.responsePayload) {
      const text = msg.responsePayload as string;
      const regex = /"messageId"\s*:\s*"([^"]+)"/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) ids.push(match[1]);
      }
    }
    if (ids.length === 0 && typeof msg.messageId === 'string' && msg.messageId && msg.messageId !== 'unknown' && msg.messageId !== '-') {
      ids.push(msg.messageId);
    }
    if (ids.length === 0 && Array.isArray(msg.recipients)) {
      return msg.recipients.map(() => 'unknown');
    }
    return ids;
  };

  // Filter messages based on search query
  const filteredMessages = messages.filter(msg => {
    const searchLower = searchQuery.toLowerCase();
    const recipient = msg.recipient || (msg.recipients && msg.recipients.length > 0 ? msg.recipients.join(', ') : '');
    const requestData = safeJsonParse(msg.requestPayload);
    const message = requestData?.message || requestData?.messages || '';
    
    return recipient.toLowerCase().includes(searchLower) ||
           message.toString().toLowerCase().includes(searchLower) ||
           msg.status.toLowerCase().includes(searchLower);
  });

  // Pagination
  const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);
  const startIndex = (currentPage - 1) * messagesPerPage;
  const paginatedMessages = filteredMessages.slice(startIndex, startIndex + messagesPerPage);

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    
    // Color mapping: queued=yellow, sent=blue, delivered=green, failed=red
    if (statusLower.includes('queue')) {
      return <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">{status}</Badge>;
    }
    if (statusLower.includes('sent') || statusLower.includes('pending')) {
      return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">{status}</Badge>;
    }
    if (statusLower.includes('deliver') || statusLower.includes('success')) {
      return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">{status}</Badge>;
    }
    if (statusLower.includes('fail') || statusLower.includes('error')) {
      return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">{status}</Badge>;
    }
    
    // Default fallback
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'queued': 'secondary',
      'sent': 'default',
      'delivered': 'default',
      'failed': 'destructive',
    };
    
    return (
      <Badge variant={variants[statusLower] || 'outline'} data-testid={`status-${statusLower}`}>
        {t(`messageHistory.status.${statusLower}`) || status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMessagePreview = (msg: MessageLog) => {
    const requestData = safeJsonParse(msg.requestPayload);
    if (!requestData) return 'N/A';
    
    const message = requestData?.message || requestData?.messages || '';
    if (Array.isArray(message)) {
      return message[0]?.message || 'Multiple messages';
    }
    return message.length > 50 ? message.substring(0, 50) + '...' : message;
  };

  const getRecipientDisplay = (msg: MessageLog) => {
    if (msg.recipient) return msg.recipient;
    if (msg.recipients && msg.recipients.length > 0) {
      return msg.recipients[0];
    }
    return 'N/A';
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Clock className="h-8 w-8" />
              <h1 className="text-4xl font-bold tracking-tight">{t('messageHistory.title')}</h1>
            </div>
            <p className="text-muted-foreground mt-2">{t('messageHistory.subtitle')}</p>
          </div>
        </div>

        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('messageHistory.adminMode')}</CardTitle>
              <CardDescription>{t('messageHistory.selectClient')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientSelector 
                selectedClientId={selectedClientId}
                onClientChange={setSelectedClientId}
                isAdminMode={isAdminMode}
                onAdminModeChange={setIsAdminMode}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('messageHistory.search')}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">{t('messageHistory.loading')}</p>
              </div>
            ) : paginatedMessages.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('messageHistory.empty')}</h3>
                <p className="text-muted-foreground">{t('messageHistory.emptyDesc')}</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('messageHistory.table.recipient')}</TableHead>
                        <TableHead>Business Name</TableHead>
                        <TableHead>{t('messageHistory.table.message')}</TableHead>
                        <TableHead>Message ID</TableHead>
                        <TableHead>{t('messageHistory.table.type')}</TableHead>
                        <TableHead>{t('messageHistory.table.status')}</TableHead>
                        <TableHead>{t('messageHistory.table.date')}</TableHead>
                        <TableHead className="text-right">{t('messageHistory.table.cost')}</TableHead>
                        <TableHead className="text-right">{t('messageHistory.table.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMessages.map((msg) => (
                        <TableRow key={msg.id} data-testid={`row-message-${msg.id}`}>
                          <TableCell className="font-mono text-sm" data-testid={`recipient-${msg.id}`}>
                            {getRecipientDisplay(msg)}
                          {msg.recipients && Array.isArray(msg.recipients) && msg.recipients.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-2 border-blue-500 text-blue-600 font-bold"
                            onClick={() => { setBulkNumbers(msg.recipients || []); setBulkIds(extractMessageIds(msg)); setBulkOpen(true); }}
                            >
                              {t('messageHistory.bulk')} ({msg.recipients.length})
                            </Button>
                          )}
                          {msg.recipients && Array.isArray(msg.recipients) && msg.recipients.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-2 border-purple-500 text-purple-600 font-bold"
                              onClick={() => { setBulkNumbers(msg.recipients || []); setBulkIds(extractMessageIds(msg)); setBulkOpen(true); }}
                            >
                              IDs ({extractMessageIds(msg).length})
                            </Button>
                          )}
                          </TableCell>
                          <TableCell className="max-w-[12rem] truncate">
                            <Badge variant="outline" className="max-w-[12rem] truncate">
                              {(() => {
                                const bn = effectiveUserId
                                  ? (adminClients?.clients?.find(c => c.id === effectiveUserId)?.businessName || '—')
                                  : (profile?.businessName || profile?.user?.company || '—');
                                return bn || '—';
                              })()}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate" data-testid={`message-${msg.id}`}>
                            {getMessagePreview(msg)}
                          </TableCell>
                          <TableCell className="font-mono text-xs" data-testid={`messageid-${msg.id}`}>{msg.messageId || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">SMS</Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(msg.status)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground" data-testid={`date-${msg.id}`}>
                            {formatDate(msg.createdAt)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${parseFloat(msg.totalCharge).toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => refreshStatusMutation.mutate(msg.messageId)}
                              disabled={refreshStatusMutation.isPending}
                              data-testid={`button-refresh-${msg.id}`}
                            >
                              <RefreshCw className={`h-4 w-4 ${refreshStatusMutation.isPending ? 'animate-spin' : ''}`} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('messageHistory.showing')} {filteredMessages.length} {t('messageHistory.messages')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      {t('common.back')}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t('messageHistory.page')} {currentPage} {t('messageHistory.of')} {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('messageHistory.bulkRecipients')}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              {bulkNumbers.map((n, i) => (
                <Badge key={`${n}-${i}`} variant="outline" className="justify-center font-mono">
                  {n}
                </Badge>
              ))}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Message IDs</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const text = bulkIds.join('\n');
                    try {
                      if (navigator.clipboard && (window as any).isSecureContext && typeof navigator.clipboard.writeText === 'function') {
                        await navigator.clipboard.writeText(text);
                      } else {
                        const ta = document.createElement('textarea');
                        ta.value = text;
                        ta.style.position = 'fixed';
                        ta.style.opacity = '0';
                        document.body.appendChild(ta);
                        ta.focus();
                        ta.select();
                        try { document.execCommand('copy'); } catch {}
                        document.body.removeChild(ta);
                      }
                    } catch {}
                  }}
                >
                  Copy All
                </Button>
              </div>
              {bulkIds.length > 0 && bulkNumbers.length === bulkIds.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {bulkNumbers.map((n, i) => (
                    <div key={`pair-${i}`} className="flex items-center justify-between gap-2 border rounded p-2">
                      <Badge variant="outline" className="font-mono">{n}</Badge>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{bulkIds[i]}</Badge>
                        <Button variant="ghost" size="sm" onClick={async () => {
                          const text = bulkIds[i];
                          try {
                            if (navigator.clipboard && (window as any).isSecureContext && typeof navigator.clipboard.writeText === 'function') {
                              await navigator.clipboard.writeText(text);
                            } else {
                              const ta = document.createElement('textarea');
                              ta.value = text;
                              ta.style.position = 'fixed';
                              ta.style.opacity = '0';
                              document.body.appendChild(ta);
                              ta.focus();
                              ta.select();
                              try { document.execCommand('copy'); } catch {}
                              document.body.removeChild(ta);
                            }
                          } catch {}
                        }}>Copy</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {bulkIds.map((id, i) => (
                    <div key={`id-${i}`} className="flex items-center justify-between gap-2 border rounded p-2">
                      <Badge variant="outline" className="font-mono">{id}</Badge>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        const text = id;
                        try {
                          if (navigator.clipboard && (window as any).isSecureContext && typeof navigator.clipboard.writeText === 'function') {
                            await navigator.clipboard.writeText(text);
                          } else {
                            const ta = document.createElement('textarea');
                            ta.value = text;
                            ta.style.position = 'fixed';
                            ta.style.opacity = '0';
                            document.body.appendChild(ta);
                            ta.focus();
                            ta.select();
                            try { document.execCommand('copy'); } catch {}
                            document.body.removeChild(ta);
                          }
                        } catch {}
                      }}>Copy</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
