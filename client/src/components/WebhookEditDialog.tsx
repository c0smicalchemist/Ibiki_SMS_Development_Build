import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  clientId: string;
  currentUrl?: string | null;
  currentSecret?: string | null;
  triggerLabel?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "destructive";
  buttonClassName?: string;
}

export default function WebhookEditDialog({ clientId, currentUrl, currentSecret, triggerLabel = "Edit", buttonVariant = "outline", buttonClassName }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(currentUrl || "");
  const [secret, setSecret] = useState(currentSecret || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/admin/clients/${clientId}/webhook`, { method: 'POST', body: JSON.stringify({ url, secret }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({ title: 'Success', description: 'Webhook updated' });
      setOpen(false);
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e?.message || 'Failed to update webhook', variant: 'destructive' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setUrl(currentUrl || ""); setSecret(currentSecret || ""); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant={buttonVariant} className={buttonClassName} data-testid={`button-webhook-${(triggerLabel || 'edit').toLowerCase()}-${clientId}`}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Webhook</DialogTitle>
          <DialogDescription>Configure URL and secret for client webhook delivery</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input className="text-xs font-mono" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          <Input className="text-xs font-mono" placeholder="secret" value={secret} onChange={(e) => setSecret(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !url}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
