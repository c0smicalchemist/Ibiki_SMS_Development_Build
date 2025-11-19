import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DollarSign } from "lucide-react";

interface AddCreditsToClientDialogProps {
  clientId: string;
  clientName: string;
  currentCredits: string;
}

export function AddCreditsToClientDialog({ clientId, clientName, currentCredits }: AddCreditsToClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const { toast } = useToast();

  const addCreditsMutation = useMutation({
    mutationFn: async (data: { userId: string; amount: string }) => {
      return await apiRequest('/api/admin/add-credits', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      toast({
        title: "Success",
        description: `Added $${amount} to ${clientName}'s account. New balance: $${data.newBalance}`
      });
      setAmount("");
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add credits",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a positive amount",
        variant: "destructive"
      });
      return;
    }
    addCreditsMutation.mutate({ userId: clientId, amount });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          data-testid={`button-add-credits-${clientId}`}
        >
          <DollarSign className="h-4 w-4 mr-1" />
          Add Credits
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-add-credits">
        <DialogHeader>
          <DialogTitle>Add Credits to {clientName}</DialogTitle>
          <DialogDescription>
            Current balance: ${parseFloat(currentCredits).toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="10.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-credit-amount"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the amount to add to this client's credit balance
              </p>
            </div>
            {amount && parseFloat(amount) > 0 && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">New Balance:</span>
                  <span className="font-bold text-lg" data-testid="text-new-balance">
                    ${(parseFloat(currentCredits) + parseFloat(amount)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={addCreditsMutation.isPending || !amount || parseFloat(amount) <= 0}
              data-testid="button-submit-credits"
            >
              {addCreditsMutation.isPending ? "Adding..." : "Add Credits"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
