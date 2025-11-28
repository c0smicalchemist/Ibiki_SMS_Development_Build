import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";

interface ActionLog {
  id: string;
  actorUserId: string;
  actorRole: string;
  targetUserId: string | null;
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
        <div className="flex items-center gap-2 mb-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search logs" className="w-64" />
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
                    <TableCell className="font-mono">{l.actorUserId}</TableCell>
                    <TableCell>{l.actorRole}</TableCell>
                    <TableCell className="font-mono">{l.targetUserId || ""}</TableCell>
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
