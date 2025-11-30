import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

export default function MessageStatusTiles({ userId }: { userId?: string }) {
  const { t } = useLanguage();

  const { data: logsData } = useQuery<{ success: boolean; messages: Array<any> }>({
    queryKey: [userId ? '/api/admin/messages' : '/api/client/messages', userId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = userId ? `/api/admin/messages?userId=${userId}` : '/api/client/messages';
      const r = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error('Failed to fetch logs');
      return r.json();
    },
    refetchInterval: 10000,
  });

  const { data: inboxData } = useQuery<{ success: boolean; messages?: any[]; count?: number }>({
    queryKey: [userId ? '/api/web/inbox' : '/api/web/inbox', userId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const base = '/api/web/inbox';
      const url = userId ? `${base}?userId=${userId}` : base;
      const r = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error('Failed to fetch inbox');
      return r.json();
    },
    refetchInterval: 10000,
  });

  const logs = (logsData?.messages || []).map((m: any) => ({
    createdAt: new Date(m?.createdAt || m?.timestamp || Date.now()).getTime(),
  }));
  const incoming = ((inboxData as any)?.messages || []).map((i: any) => ({
    timestamp: new Date(i?.timestamp || i?.createdAt || Date.now()).getTime(),
  }));

  const startOfToday = (() => {
    const d = new Date(); d.setHours(0,0,0,0); return d.getTime();
  })();

  const totalSent = logs.length;
  const totalReceived = incoming.length;
  const totalCombined = totalSent + totalReceived;
  const totalReceivedPct = totalCombined ? Math.round((totalReceived / totalCombined) * 100) : 0;

  const sentToday = logs.filter(l => l.createdAt >= startOfToday).length;
  const receivedToday = incoming.filter(i => i.timestamp >= startOfToday).length;
  const todayCombined = sentToday + receivedToday;
  const todayReceivedPct = todayCombined ? Math.round((receivedToday / todayCombined) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t('messageStatus.allTime') || 'All Time'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded border bg-muted/50">
              <div className="text-muted-foreground">Total Sent</div>
              <div className="text-2xl font-bold">{totalSent.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded border bg-muted/50">
              <div className="text-muted-foreground">Total Received</div>
              <div className="text-2xl font-bold">{totalReceived.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded border bg-muted/50">
              <div className="text-muted-foreground">Total Received %</div>
              <div className="text-2xl font-bold">{totalReceivedPct}%</div>
            </div>
            <div className="p-3 rounded border bg-muted/50">
              <div className="text-muted-foreground">Total</div>
              <div className="text-2xl font-bold">{totalCombined.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t('messageStatus.today') || 'Today'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded border bg-muted/50">
              <div className="text-muted-foreground">Sent Today</div>
              <div className="text-2xl font-bold">{sentToday.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded border bg-muted/50">
              <div className="text-muted-foreground">Received Today</div>
              <div className="text-2xl font-bold">{receivedToday.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded border bg-muted/50">
              <div className="text-muted-foreground">Today Received %</div>
              <div className="text-2xl font-bold">{todayReceivedPct}%</div>
            </div>
            <div className="p-3 rounded border bg-muted/50">
              <div className="text-muted-foreground">Total Today</div>
              <div className="text-2xl font-bold">{todayCombined.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
