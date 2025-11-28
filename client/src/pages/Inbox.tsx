import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Trash2, Star } from "lucide-react";
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

  const isAdmin = profile?.user?.role === 'admin' || profile?.user?.email === 'ibiki_dash@proton.me';
  const isSupervisor = profile?.user?.role === 'supervisor';
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

  // Favorites
  const { data: favoritesData } = useQuery<{ success: boolean; favorites: string[] }>({
    queryKey: ['/api/web/inbox/favorites', effectiveUserId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = effectiveUserId ? `/api/web/inbox/favorites?userId=${effectiveUserId}` : '/api/web/inbox/favorites';
      const resp = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!resp.ok) throw new Error('Failed to fetch favorites');
      return resp.json();
    }
  });
  const favorites = favoritesData?.favorites || [];
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ phoneNumber, favorite }: { phoneNumber: string; favorite: boolean }) => {
      const token = localStorage.getItem('token');
      const body: any = { phoneNumber, favorite };
      if (effectiveUserId) body.userId = effectiveUserId;
      const resp = await fetch('/api/web/inbox/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error('Failed to update favorite');
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/web/inbox/favorites', effectiveUserId] as any, data);
    }
  });

  const [viewFavorites, setViewFavorites] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('view') === 'favorites') setViewFavorites(true);
    } catch {}
  }, []);
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
        <Card>
          <CardHeader>
            <CardTitle>{isSupervisor ? 'Supervisor Mode' : t('inbox.adminMode')}</CardTitle>
            <CardDescription>{t('inbox.selectClient')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ClientSelector 
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
              isAdminMode={isAdminMode}
              onAdminModeChange={setIsAdminMode}
              modeLabel={isSupervisor ? 'Supervisor Mode' : 'Admin Direct Mode'}
            />
          </CardContent>
        </Card>
        
        <div className="mb-6 flex items-center gap-4">
          <Link href={(isAdmin || isSupervisor) ? "/admin" : "/dashboard"}>
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
          <div className="ml-auto flex items-center gap-3">
            <Button
              variant="default"
              size="sm"
              className="h-9 px-3 min-w-[3.5rem] flex flex-col items-center justify-center"
              title="All"
              disabled
            >
              <span className="text-sm font-bold leading-none">{messages.length.toLocaleString()}</span>
              <span className="text-[11px] opacity-80 leading-none mt-0.5">All</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-9 px-3 min-w-[3.5rem] flex flex-col items-center justify-center bg-primary text-primary-foreground disabled:opacity-100"
              title="Unread"
              disabled
            >
              <span className="text-sm font-bold leading-none">{messages.filter(m => !m.isRead).length.toLocaleString()}</span>
              <span className="text-[11px] opacity-80 leading-none mt-0.5">Unread</span>
            </Button>
            <Button onClick={handleRetrieveInbox}>Retrieve Inbox</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <Card className={viewFavorites ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 ring-1 ring-yellow-300' : ''}>
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
              <CardHeader className={viewFavorites ? 'py-3 border-t-4 border-yellow-400' : 'py-3'}>
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
                <div className="flex items-center gap-2 px-4 pb-2">
                  <Button variant={viewFavorites ? 'secondary' : 'outline'} size="sm" onClick={() => setViewFavorites(v => !v)}>
                    {viewFavorites ? t('inbox.favorites') : t('inbox.favorites')}
                  </Button>
                  <select className="border rounded px-2 py-1 text-xs" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
                    <option value="newest">{t('inbox.sort.mostRecent')}</option>
                    <option value="oldest">{t('inbox.sort.oldest')}</option>
                  </select>
                </div>
                <div className="max-h-[65vh] overflow-y-auto rounded border">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="sticky top-0 bg-background z-10">
                      <TableHead>Recipient</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages
                      .filter(m => {
                        const q = search.trim().toLowerCase();
                        if (!q) return true;
                        return (m.from || '').toLowerCase().includes(q) || (m.receiver || '').toLowerCase().includes(q) || (m.message || '').toLowerCase().includes(q);
                      })
                      .filter(m => !viewFavorites || favorites.includes((m as any).from || (m as any).receiver))
                      .sort((a, b) => {
                        const ta = new Date((a as any).timestamp || (a as any).createdAt).getTime();
                        const tb = new Date((b as any).timestamp || (b as any).createdAt).getTime();
                        return sortOrder === 'newest' ? (tb - ta) : (ta - tb);
                      })
                      .map(msg => {
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
                            {!showDeleted && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); const p = (msg as any).from || (msg as any).receiver; const fav = favorites.includes(p); toggleFavoriteMutation.mutate({ phoneNumber: p, favorite: !fav }); }}
                                title={favorites.includes((msg as any).from || (msg as any).receiver) ? 'Unfavorite' : 'Favorite'}
                              >
                                <Star className={`w-4 h-4 ${favorites.includes((msg as any).from || (msg as any).receiver) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
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
                </div>
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
