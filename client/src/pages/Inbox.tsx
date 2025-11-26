import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox as InboxIcon, MessageSquare, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ClientSelector } from "@/components/ClientSelector";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ConversationDialog } from "@/components/ConversationDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface IncomingMessage {
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
  isRead: boolean;
}

export default function Inbox() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);
  const [showConversationDialog, setShowConversationDialog] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() => {
    return localStorage.getItem('selectedClientId');
  });
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    return localStorage.getItem('isAdminMode') === 'true';
  });
  const [search, setSearch] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

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
  }>({
    queryKey: ['/api/client/profile']
  });

  const isAdmin = profile?.user?.role === 'admin';
  const effectiveUserId = isAdmin && !isAdminMode && selectedClientId ? selectedClientId : undefined;

  // Fetch inbox messages
  const { data: inboxData, isLoading } = useQuery({
    queryKey: [showDeleted ? "/api/web/inbox/deleted" : "/api/web/inbox", effectiveUserId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const base = showDeleted ? '/api/web/inbox/deleted' : '/api/web/inbox';
      const url = effectiveUserId 
        ? `${base}?userId=${effectiveUserId}`
        : base;
      const response = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(t('inbox.error.fetchFailed'));
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const messages: IncomingMessage[] = (inboxData as any)?.messages || [];
  const deletedCount: number = (inboxData as any)?.count || 0;
  const seedExample = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = effectiveUserId || profile?.user?.id;
      await fetch('/api/admin/seed-example', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId })
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
      await queryClient.refetchQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
    } catch {}
  };

  const seedExampleForAdmin = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = profile?.user?.id;
      await fetch('/api/admin/seed-example', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId })
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", undefined] });
      await queryClient.refetchQueries({ queryKey: ["/api/web/inbox", undefined] });
    } catch {}
  };

  const deleteExample = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = effectiveUserId || profile?.user?.id;
      await fetch('/api/admin/seed-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId })
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
      await queryClient.refetchQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
    } catch {}
  };

  const handleRetrieveInbox = async () => {
    try {
      const token = localStorage.getItem('token');
      const body: any = {};
      if (effectiveUserId) body.userId = effectiveUserId;
      const resp = await fetch('/api/web/inbox/retrieve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error('Failed to retrieve inbox');
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
      await queryClient.refetchQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
      toast({ title: t('common.success'), description: t('inbox.retrieveSuccess') });
    } catch {}
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/web/inbox/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id, userId: effectiveUserId })
      });
      if (!resp.ok) throw new Error('Failed to delete message');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] });
    }
  });

  const deletePermanentMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/web/inbox/delete-permanent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id, userId: effectiveUserId })
      });
      if (!resp.ok) throw new Error('Failed to permanently delete message');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] });
    }
  });


  const handleOpenConversation = (phoneNumber: string) => {
    setSelectedPhoneNumber(phoneNumber);
    setShowConversationDialog(true);
  };

  const handleCloseConversation = () => {
    setShowConversationDialog(false);
    setSelectedPhoneNumber(null);
  };

  // Group messages by sender
  const groupedMessages = messages.reduce((acc: any, msg) => {
    if (!acc[msg.from]) {
      acc[msg.from] = [];
    }
    acc[msg.from].push(msg);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="container mx-auto p-6 space-y-6">
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>{t('inbox.adminMode')}</CardTitle>
              <CardDescription>{t('inbox.selectClient')}</CardDescription>
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
        
        <div className="mb-6 flex items-center gap-4">
          <Link href={isAdmin ? "/admin" : "/dashboard"}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <InboxIcon className="h-8 w-8" />
              {t('clientDashboard.inbox')}
            </h1>
            <p className="text-muted-foreground">{t('clientDashboard.inboxDesc')}</p>
          </div>
          <div className="ml-auto">
            <Button onClick={handleRetrieveInbox}>Retrieve Inbox</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-center">
                {t('inbox.loading')}
              </CardContent>
            </Card>
          ) : messages.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <InboxIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">{t('inbox.noMessages')}</h3>
                <p className="text-muted-foreground">
                  {t('inbox.noMessagesDesc')}
                </p>
                {isAdmin && (
                  <div className="mt-6 flex items-center gap-2 justify-center">
                    <Button onClick={seedExample} data-testid="button-seed-example-client">Add Example (Selected Client)</Button>
                    <Button variant="outline" onClick={seedExampleForAdmin} data-testid="button-seed-example-admin">Add Example (Admin)</Button>
                    <Button variant="destructive" onClick={deleteExample} data-testid="button-delete-example">Delete Example</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center gap-2">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('inbox.search')} className="w-64" />
                  <Button onClick={() => setShowDeleted(!showDeleted)} variant="destructive">{showDeleted ? t('inbox.deletedMessages') : t('inbox.showDeleted')}</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {showDeleted && deletedCount >= 2000 && (
                  <div className="px-4 pt-3">
                    <div className="flex items-center justify-between rounded border border-red-500 bg-red-50 p-2">
                      <span className="text-xs text-red-700">{t('inbox.binWarning').replace('{count}', String(deletedCount))}</span>
                      <Button variant="destructive" size="sm" onClick={async () => {
                        const token = localStorage.getItem('token');
                        await fetch('/api/web/inbox/purge-deleted', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                          body: JSON.stringify({ userId: effectiveUserId })
                        });
                        await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] });
                      }}>{t('inbox.purgeBin')}</Button>
                    </div>
                  </div>
                )}
                <ScrollArea className="h-[65vh] rounded border">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 bg-background z-10">Recipient</TableHead>
                      <TableHead className="sticky top-0 bg-background z-10">Message</TableHead>
                      <TableHead className="sticky top-0 bg-background z-10">Date</TableHead>
                      <TableHead className="sticky top-0 bg-background z-10">Time</TableHead>
                      <TableHead className="sticky top-0 bg-background z-10 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.filter(m => {
                      const q = search.trim().toLowerCase();
                      if (!q) return true;
                      return (m.from || '').toLowerCase().includes(q) || (m.receiver || '').toLowerCase().includes(q) || (m.message || '').toLowerCase().includes(q);
                    }).map(msg => {
                      const dt = new Date((msg as any).timestamp || (msg as any).createdAt);
                      const dateStr = format(dt, 'MMM d, yyyy');
                      const timeStr = format(dt, 'HH:mm');
                      const phone = (msg as any).from || (msg as any).receiver;
                      return (
                        <TableRow key={msg.id} onClick={() => !showDeleted && handleOpenConversation(phone)} className="cursor-pointer">
                          <TableCell className="font-mono text-sm whitespace-nowrap">{(msg as any).from || (msg as any).receiver}</TableCell>
                          <TableCell className="text-sm truncate max-w-[380px]">{(msg as any).message}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{dateStr}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{timeStr}</TableCell>
                          <TableCell className="text-right">
                            {!showDeleted && (
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate((msg as any).id); }}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                            {showDeleted && (
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fetch('/api/web/inbox/restore', {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: (msg as any).id, userId: effectiveUserId })
                                }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] })); }}>
                                  {t('inbox.restore')}
                                </Button>
                                <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); deletePermanentMutation.mutate((msg as any).id); }}>
                                  <Trash2 className="w-4 h-4" /> {t('inbox.deletePermanent')}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Conversation Dialog */}
      {selectedPhoneNumber && (
        <ConversationDialog
          open={showConversationDialog}
          onClose={handleCloseConversation}
          phoneNumber={selectedPhoneNumber}
          userId={effectiveUserId}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
