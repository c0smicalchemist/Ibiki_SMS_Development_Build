import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  clientId: string;
  clientName: string;
}

export default function ResetPasswordDialog({ clientId, clientName }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");

  const resetMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/admin/users/${clientId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: pwd })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({ title: 'Success', description: `Password set for ${clientName}` });
      setOpen(false);
      setPwd("");
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e?.message || 'Failed to set password', variant: 'destructive' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full justify-center" data-testid={`button-reset-pwd-${clientId}`}>Reset Password</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Enter a new password for {clientName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="New password" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => resetMutation.mutate()} disabled={!pwd || resetMutation.isPending}>{resetMutation.isPending ? 'Setting…' : 'Set Password'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
