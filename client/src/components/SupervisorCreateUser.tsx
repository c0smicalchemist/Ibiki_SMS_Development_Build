import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function SupervisorCreateUser() {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/supervisor/users/create', { method: 'POST', body: JSON.stringify({ username, email, password }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({ title: 'Success', description: 'User created successfully' });
      setUsername(""); setEmail(""); setPassword("");
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'Failed to create user', variant: 'destructive' });
    }
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supervisor Create User (Auto group)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="username">Username (required)</Label>
          <Input id="username" value={username} onChange={(e)=>setUsername(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email (optional)</Label>
          <Input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        </div>
        <Button onClick={()=>m.mutate()} disabled={m.isPending || !username || !password}>Create</Button>
      </CardContent>
    </Card>
  );
}
