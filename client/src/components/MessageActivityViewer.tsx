import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface MessageLog {
  id: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  messageId: string;
  endpoint: string;
  recipient?: string | null;
  recipients?: string[] | null;
  senderPhoneNumber?: string | null;
  status: string;
  costPerMessage?: number | null;
  chargePerMessage?: number | null;
  totalCost?: number | null;
  totalCharge?: number | null;
  messageCount?: number | null;
  createdAt: string;
}

export default function MessageActivityViewer({ mode = 'admin' }: { mode?: 'admin' | 'supervisor' }) {
  const [q, setQ] = useState("");
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const { data, isFetching } = useQuery<{ success: boolean; messages: MessageLog[] }>({
    queryKey: [mode === 'admin' ? "/api/admin/message-logs" : "/api/supervisor/message-logs", mode],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const url = mode === 'admin' ? "/api/admin/message-logs?limit=200" : "/api/supervisor/message-logs?limit=200";
      const headers: Record<string,string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      try {
        const resp = await fetch(url, { headers, cache: 'no-store' });
        if (!resp.ok) throw new Error("Failed to fetch message logs");
        return await resp.json();
      } catch (e) {
        if (mode === 'supervisor') {
          const altResp = await fetch('/api/admin/message-logs?limit=200', { headers, cache: 'no-store' });
          if (!altResp.ok) throw new Error("Failed to fetch message logs");
          return await altResp.json();
        }
        throw e;
      }
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    retry: 2,
    staleTime: 30000,
    gcTime: 600000,
    placeholderData: (prev) => prev as any,
    keepPreviousData: true,
  });
  const logs = data?.messages || [];
  // Best-effort mapping: if display fields missing, try to map via /api/admin/clients
  const adminMapQuery = useQuery<{ success: boolean; clients: Array<{ id: string; email: string; name?: string | null }> }>({
    queryKey: ['/api/admin/clients'],
    enabled: mode === 'admin'
  });
  const idToDisplay = (id: string) => {
    const c = adminMapQuery.data?.clients?.find(x => x.id === id);
    return c ? (c.name || c.email || id) : id;
  };
  const [idLookup, setIdLookup] = useState("");
  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('token');
      const resp = await fetch(`/api/admin/users/resolve?id=${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) throw new Error('resolve_failed');
      return resp.json();
    }
  });
  const filtered = logs.filter((l) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      (l.userId || "").toLowerCase().includes(s) ||
      (l.messageId || "").toLowerCase().includes(s) ||
      (l.endpoint || "").toLowerCase().includes(s) ||
      (l.status || "").toLowerCase().includes(s) ||
      (l.senderPhoneNumber || "").toLowerCase().includes(s) ||
      (l.recipient || "").toLowerCase().includes(s) ||
      ((l.recipients || []).join(",").toLowerCase().includes(s))
    );
  });
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Message Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages" className="w-64" />
          <div className="flex items-center gap-2">
            <Input value={idLookup} onChange={(e) => setIdLookup(e.target.value)} placeholder="Translate ID" className="w-64" />
            <Button size="sm" onClick={() => resolveMutation.mutate(idLookup)} disabled={!idLookup}>Translate</Button>
            {resolveMutation.data?.success && (
              <span className="text-xs text-muted-foreground">{resolveMutation.data.user?.name || resolveMutation.data.user?.email || idLookup}</span>
            )}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Recipient(s)</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const dt = new Date(l.createdAt);
                const recipients = (l.recipients && l.recipients.length > 0)
                  ? l.recipients.join(", ")
                  : (l.recipient || "");
                return (
                  <TableRow key={l.id}>
                    <TableCell>{format(dt, "yyyy-MM-dd HH:mm:ss")}</TableCell>
                    <TableCell className="truncate max-w-[220px]">{l.userDisplay || l.userName || l.userEmail || idToDisplay(l.userId)}</TableCell>
                    <TableCell className="truncate max-w-[200px]">{l.endpoint}</TableCell>
                    <TableCell className="truncate max-w-[240px]">
                      {(l.recipients && l.recipients.length > 0) ? (
                        <Button variant="outline" size="sm" onClick={() => { setRecipients(l.recipients || []); setRecipientsOpen(true); }}>
                          Multiple ({l.recipients.length})
                        </Button>
                      ) : (
                        recipients
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{l.senderPhoneNumber || ""}</TableCell>
                    <TableCell>{l.status}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {isFetching && (
          <div className="text-center py-2 text-xs text-muted-foreground">Loading…</div>
        )}
      </CardContent>
    </Card>
    <RecipientsDialog open={recipientsOpen} onOpenChange={setRecipientsOpen} numbers={recipients} />
    </>
  );
}
function RecipientsDialog({ open, onOpenChange, numbers }: { open: boolean; onOpenChange: (v: boolean) => void; numbers: string[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Recipients</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Numbers ({numbers.length})</h4>
          <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(numbers.join('\n')); } catch {} }}>Copy All</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {numbers.map((n, i) => (
            <div key={`rec-${i}`} className="flex items-center justify-between gap-2 border rounded p-2">
              <Badge variant="outline" className="font-mono">{n}</Badge>
              <Button variant="ghost" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(n); } catch {} }}>Copy</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
