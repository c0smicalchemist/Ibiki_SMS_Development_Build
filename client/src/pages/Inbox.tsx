import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inbox" className="w-64" />
                  <Button onClick={() => setShowDeleted(!showDeleted)} variant={showDeleted ? "default" : "outline"}>{showDeleted ? 'Deleted Messages' : 'Show Deleted'}</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                      return (
                        <TableRow key={msg.id}>
                          <TableCell className="font-mono text-sm whitespace-nowrap">{(msg as any).from || (msg as any).receiver}</TableCell>
                          <TableCell className="text-sm truncate max-w-[380px]">{(msg as any).message}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{dateStr}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{timeStr}</TableCell>
                          <TableCell className="text-right">
                            {!showDeleted && (
                              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate((msg as any).id)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
