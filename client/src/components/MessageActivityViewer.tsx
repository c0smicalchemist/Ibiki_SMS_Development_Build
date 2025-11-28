import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";

interface MessageLog {
  id: string;
  userId: string;
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

export default function MessageActivityViewer() {
  const [q, setQ] = useState("");
  const { data } = useQuery<{ success: boolean; messages: MessageLog[] }>({
    queryKey: ["/api/admin/message-logs"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const resp = await fetch("/api/admin/message-logs?limit=500", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error("Failed to fetch message logs");
      return resp.json();
    },
    refetchInterval: 10000,
  });
  const logs = data?.messages || [];
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
    <Card>
      <CardHeader>
        <CardTitle>Message Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages" className="w-64" />
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
                <TableHead>Cost</TableHead>
                <TableHead>Charge</TableHead>
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
                    <TableCell className="font-mono">{l.userId}</TableCell>
                    <TableCell className="truncate max-w-[200px]">{l.endpoint}</TableCell>
                    <TableCell className="truncate max-w-[240px]">{recipients}</TableCell>
                    <TableCell className="font-mono">{l.senderPhoneNumber || ""}</TableCell>
                    <TableCell>{l.status}</TableCell>
                    <TableCell>{l.totalCost ?? l.costPerMessage ?? ""}</TableCell>
                    <TableCell>{l.totalCharge ?? l.chargePerMessage ?? ""}</TableCell>
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
