import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function AdminCreateUser() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<'client'|'supervisor'|'admin'>("client");
  const [groupId, setGroupId] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/users/create', { method: 'POST', body: JSON.stringify({ email, password, role, groupId }) });
    }
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create User</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <select id="role" className="border rounded px-2 py-1" value={role} onChange={(e)=>setRole(e.target.value as any)}>
            <option value="client">Client</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="groupId">Group ID</Label>
          <Input id="groupId" value={groupId} onChange={(e)=>setGroupId(e.target.value)} placeholder="optional; must exist if provided" />
        </div>
        <Button onClick={()=>m.mutate()} disabled={m.isPending || !email || !password}>Create</Button>
      </CardContent>
    </Card>
  );
}
