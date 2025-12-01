import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface ActionLog {
  id: string;
  actorUserId: string;
  actorEmail?: string | null;
  actorName?: string | null;
  actorRole: string;
  targetUserId: string | null;
  targetEmail?: string | null;
  targetName?: string | null;
  action: string;
  details: string | null;
  createdAt: string;
}

export default function ActionLogsViewer() {
  const [q, setQ] = useState("");
  const { data } = useQuery<{ success: boolean; logs: ActionLog[] }>({
    queryKey: ["/api/admin/action-logs", "all"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const resp = await fetch("/api/admin/action-logs?type=all", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error("Failed to fetch action logs");
      return resp.json();
    },
    refetchInterval: 10000,
  });
  const logs = data?.logs || [];
  const filtered = logs.filter((l) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      (l.actorUserId || "").toLowerCase().includes(s) ||
      (l.actorRole || "").toLowerCase().includes(s) ||
      (l.targetUserId || "").toLowerCase().includes(s) ||
      (l.action || "").toLowerCase().includes(s) ||
      (l.details || "").toLowerCase().includes(s)
    );
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Action Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search logs" className="w-64" />
          <Translator />
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const dt = new Date(l.createdAt);
                return (
                  <TableRow key={l.id}>
                    <TableCell>{format(dt, "yyyy-MM-dd HH:mm:ss")}</TableCell>
                    <TableCell className="truncate max-w-[240px]">{(l as any).actorDisplay || l.actorName || l.actorEmail || l.actorUserId}</TableCell>
                    <TableCell>{l.actorRole}</TableCell>
                    <TableCell className="truncate max-w-[240px]">{(l as any).targetDisplay || l.targetName || l.targetEmail || l.targetUserId || ""}</TableCell>
                    <TableCell>{l.action}</TableCell>
                    <TableCell className="truncate max-w-[360px]">{l.details || ""}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function Translator() {
  const [idLookup, setIdLookup] = useState("");
  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('token');
      const resp = await fetch(`/api/admin/users/resolve?id=${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) throw new Error('resolve_failed');
      return resp.json();
    }
  });
  return (
    <div className="flex items-center gap-2">
      <Input value={idLookup} onChange={(e) => setIdLookup(e.target.value)} placeholder="Translate ID" className="w-64" />
      <Button size="sm" onClick={() => resolveMutation.mutate(idLookup)} disabled={!idLookup}>Translate</Button>
      {resolveMutation.data?.success && (
        <span className="text-xs text-muted-foreground">{resolveMutation.data.user?.name || resolveMutation.data.user?.email || idLookup}</span>
      )}
    </div>
  );
}
