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
import ConversationInline from "@/components/ConversationInline";
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
      setIsAdminMode(false);
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
  const effectiveUserId = (isAdmin || isSupervisor) && !isAdminMode && selectedClientId ? selectedClientId : undefined;

  // Fetch inbox messages
  const { data: inboxData, isLoading, isFetching } = useQuery({
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
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    retry: 2,
    staleTime: 30000,
    gcTime: 600000,
    placeholderData: (prev) => prev,
    keepPreviousData: true,
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

  const { data: logsData } = useQuery<{ success: boolean; messages: Array<any> }>({
    queryKey: [
      (isAdmin ? '/api/admin/messages' : (isSupervisor ? '/api/supervisor/messages' : '/api/client/messages')),
      effectiveUserId
    ],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      let url = '/api/client/messages';
      if (isAdmin) {
        url = effectiveUserId ? `/api/admin/messages?userId=${effectiveUserId}` : '/api/admin/messages';
      } else if (isSupervisor) {
        url = effectiveUserId ? `/api/supervisor/messages?userId=${effectiveUserId}` : '/api/supervisor/messages';
      }
      const headers: Record<string,string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      try {
        const resp = await fetch(url, { headers, cache: 'no-store' });
        if (!resp.ok) throw new Error('Failed to fetch logs');
        return await resp.json();
      } catch (e) {
        let altUrl = url;
        if (isSupervisor && effectiveUserId) {
          altUrl = `/api/admin/messages?userId=${effectiveUserId}`;
        }
        const resp2 = await fetch(altUrl, { headers, cache: 'no-store' });
        if (!resp2.ok) throw new Error('Failed to fetch logs');
        return await resp2.json();
      }
    },
    enabled: !!localStorage.getItem('token'),
    retry: false,
    refetchInterval: 10000,
  });
  const lastOutByPhone: Record<string, number> = {};
  (logsData?.messages || []).forEach((l: any) => {
    const recips = Array.isArray(l?.recipients) ? l.recipients : (l?.recipient ? [l.recipient] : []);
    const ts = new Date(l?.createdAt).getTime();
    recips.forEach((r: any) => {
      const k = String(r);
      if (!lastOutByPhone[k] || ts > lastOutByPhone[k]) lastOutByPhone[k] = ts;
    });
  });

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

  // Group messages by contact phone (sender or receiver)
  const groupedMessages = messages.reduce((acc: any, msg) => {
    const key = (msg.from || msg.receiver);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(msg);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="mx-[2cm] p-6 space-y-6">
        <div className="rounded border p-3 bg-muted/40">
          <p className="text-sm">1 credit = 1 SMS</p>
          <p className="text-xs text-muted-foreground">Your credits translate directly to SMS capacity.</p>
        </div>
        {(isAdmin || isSupervisor) && (
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
        )}
        
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <Link href={isAdmin ? "/admin" : (isSupervisor ? "/adminsup" : "/dashboard")}>
              <Button size="icon" data-testid="button-back" className="bg-blue-600 text-white hover:bg-blue-700 font-bold">
                <ArrowLeft className="h-5 w-5" strokeWidth={3} />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <InboxIcon className="h-8 w-8" />
                {t('clientDashboard.inbox')}
              </h1>
              <p className="text-muted-foreground">{t('clientDashboard.inboxDesc')}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 min-w-[4rem] flex flex-col items-center justify-center bg-gray-500 text-white border-none"
              title="All"
              disabled
            >
              <span className="text-sm font-bold leading-none">{messages.length.toLocaleString()}</span>
              <span className="text-[11px] opacity-80 leading-none mt-0.5">{t('inbox.indicator.all')}</span>
            </Button>
            <UnreadIndicator userId={effectiveUserId} isAdmin={isAdmin} />
            {/* Deleted toggle moved below near favourites */}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
          {isLoading && !messages.length ? (
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
            <>
              <Card>
                <CardHeader className={viewFavorites ? 'py-3 border-t-4 border-yellow-400' : 'py-3'}>
                  <div className="flex items-center gap-2">
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('inbox.search')} className="w-64" />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-4 pb-2">
                    <Button
                      size="sm"
                      onClick={() => setViewFavorites(v => !v)}
                      className={`${viewFavorites ? 'h-7 px-3 bg-yellow-100 text-yellow-800 border border-yellow-500 hover:bg-yellow-200 flex items-center gap-2' : 'h-7 px-3 flex items-center gap-2'} `}
                      variant={viewFavorites ? 'outline' : 'outline'}
                    >
                      <Star className={`h-4 w-4 ${viewFavorites ? 'text-yellow-600' : ''}`} />
                      <span>{t('inbox.favorites')}</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowDeleted(d => !d)}
                      className={`h-7 px-3 ${showDeleted ? 'bg-red-100 text-red-800 border border-red-500 hover:bg-red-200' : ''}`}
                      variant={showDeleted ? 'outline' : 'outline'}
                    >
                      <span className="inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Deleted</span>
                    </Button>
                    {showDeleted && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('token');
                            const body: any = {};
                            if (effectiveUserId) body.userId = effectiveUserId;
                            await fetch('/api/web/inbox/purge-deleted', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                              body: JSON.stringify(body)
                            });
                            await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] });
                            await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
                          } catch {}
                        }}
                      >
                        Purge
                      </Button>
                    )}
                    <select className="border rounded px-2 py-1 text-xs" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
                      <option value="newest">{t('inbox.sort.mostRecent')}</option>
                      <option value="oldest">{t('inbox.sort.oldest')}</option>
                    </select>
                  </div>
                  <div className="h-[70vh] overflow-y-scroll">
                    {Object.entries(groupedMessages)
                      .filter(([phone, msgs]: any[]) => {
                        const q = search.trim().toLowerCase();
                        const latest = (msgs as any[])[(msgs as any[]).length - 1] || {};
                        const text = `${String(phone)} ${(latest.message||'')}`.toLowerCase();
                        const isFav = favorites.includes(String(phone));
                        if (viewFavorites && !isFav) return false;
                        return !q || text.includes(q);
                      })
                      .sort((a: any[], b: any[]) => {
                        const favA = favorites.includes(String(a[0])) ? 1 : 0;
                        const favB = favorites.includes(String(b[0])) ? 1 : 0;
                        if (favA !== favB) return favB - favA; // pin favourites on top
                        const msgsA = a[1] as any[];
                        const msgsB = b[1] as any[];
                        const ta = new Date(((msgsA.slice().sort((x:any,y:any)=>new Date((y.timestamp||y.createdAt)).getTime()-new Date((x.timestamp||x.createdAt)).getTime()))[0]||{}).timestamp || ((msgsA[0]||{}).createdAt||0)).getTime();
                        const tb = new Date(((msgsB.slice().sort((x:any,y:any)=>new Date((y.timestamp||y.createdAt)).getTime()-new Date((x.timestamp||x.createdAt)).getTime()))[0]||{}).timestamp || ((msgsB[0]||{}).createdAt||0)).getTime();
                        return sortOrder === 'newest' ? (tb - ta) : (ta - tb);
                      })
                      .map(([phone, msgs]: any[]) => {
                      const latest = (msgs as any[]).slice().sort((a: any, b: any) => new Date((b.timestamp||b.createdAt)).getTime() - new Date((a.timestamp||a.createdAt)).getTime())[0];
                      const dt = new Date((latest as any).timestamp || (latest as any).createdAt);
                      const hasUnread = (msgs as any[]).some((m: any) => !m.isRead);
                      const lastInboundTs = new Date(((latest as any).timestamp || (latest as any).createdAt)).getTime();
                      const pendingReply = lastInboundTs > (lastOutByPhone[String(phone)] || 0);
                      return (
                        <div key={phone} className={`p-3 border-b cursor-pointer ${selectedPhoneNumber === phone ? 'bg-muted' : ''}`} onClick={() => setSelectedPhoneNumber(phone)}>
                          <div className="text-sm font-semibold flex items-center gap-2">
                            {t('inbox.from')}: <span className="font-mono">{String(phone)}</span>
                            {hasUnread && <span className="inline-block w-2 h-2 rounded-full bg-blue-600" title="Unread" />}
                            {/* pending reply indicator removed per request */}
                          </div>
                          <div className="text-xs text-muted-foreground">{t('inbox.to')}: {(latest as any).receiver}</div>
                          <div className="text-xs truncate mt-1">{(latest as any).message}</div>
                          <div className="text-xs mt-1">{format(dt, 'yyyy-MM-dd HH:mm')}</div>
                        </div>
                      );
                    })
                    }
                    {isFetching && (
                      <div className="text-center py-2 text-xs text-muted-foreground">{t('inbox.loading')}</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-sm">
                        <div>{t('inbox.from')}: <span className="font-mono">{selectedPhoneNumber || '-'}</span></div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Save selected conversation to favourites (header star) */}
                      <Button
                        variant="outline"
                        size="icon"
                        title="Save to favourites"
                        disabled={!selectedPhoneNumber}
                        onClick={() => {
                          if (!selectedPhoneNumber) return;
                          const fav = favorites.includes(selectedPhoneNumber);
                          toggleFavoriteMutation.mutate({ phoneNumber: selectedPhoneNumber, favorite: !fav });
                        }}
                      >
                        <Star className={`h-4 w-4 ${selectedPhoneNumber && favorites.includes(selectedPhoneNumber) ? 'text-yellow-600 fill-yellow-500' : ''}`} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Delete conversation"
                        disabled={!selectedPhoneNumber}
                        onClick={async () => {
                          if (!selectedPhoneNumber) return;
                          try {
                            const token = localStorage.getItem('token');
                            const body: any = { phoneNumber: selectedPhoneNumber };
                            if (effectiveUserId) body.userId = effectiveUserId;
                            await fetch('/api/web/inbox/delete-conversation', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                              body: JSON.stringify(body)
                            });
                          } catch {}
                          await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox", effectiveUserId] });
                          await queryClient.invalidateQueries({ queryKey: ["/api/web/inbox/deleted", effectiveUserId] });
                          setSelectedPhoneNumber(null);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedPhoneNumber ? (
                    <ConversationInline
                      phoneNumber={selectedPhoneNumber}
                      userId={effectiveUserId}
                      isAdmin={isAdmin || isSupervisor}
                      inboxGroup={(groupedMessages as any)[selectedPhoneNumber] || []}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">Select a conversation on the left</div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Inline conversation replaces dialog */}
    </div>
  );
}

function UnreadIndicator({ userId, isAdmin }: { userId?: string; isAdmin?: boolean }) {
  const { t } = useLanguage();
  const params = new URLSearchParams(userId ? { userId } : {});
  const { data } = useQuery<{ success: boolean; unread: number }>({
    queryKey: ['/api/web/inbox/unread-count', userId || 'me'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/web/inbox/unread-count${params.toString() ? `?${params.toString()}` : ''}`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (r.status === 401) return { success: false, pending: 0 } as any;
      if (!r.ok) return { success: false, pending: 0 } as any;
      return r.json();
    },
    enabled: !!localStorage.getItem('token'),
    retry: false,
    refetchInterval: 10000,
  });
  const count = data?.unread ?? 0;
  return (
    <Button
      variant="default"
      size="sm"
      className="h-9 px-3 min-w-[4rem] flex flex-col items-center justify-center bg-blue-600 text-white disabled:opacity-100"
      title={t('inbox.unreadIndicator')}
      disabled
    >
      <span className="text-sm font-bold leading-none">{count.toLocaleString()}</span>
      <span className="text-[11px] opacity-80 leading-none mt-0.5">{t('inbox.unreadIndicator')}</span>
    </Button>
  );
}
