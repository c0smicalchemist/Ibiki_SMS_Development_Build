import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Plus, Minus } from "lucide-react";

interface AddCreditsToClientDialogProps {
  clientId: string;
  clientName: string;
  currentCredits: string;
}

export function AddCreditsToClientDialog({ clientId, clientName, currentCredits }: AddCreditsToClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [operation, setOperation] = useState<"add" | "deduct">("add");
  const { toast } = useToast();

  const addCreditsMutation = useMutation({
    mutationFn: async (data: { userId: string; amount: string; operation: "add" | "deduct" }) => {
      return await apiRequest('/api/admin/adjust-credits', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/clients'] });
      const actionWord = operation === "add" ? "Added" : "Deducted";
      toast({
        title: "Success",
        description: `${actionWord} $${amount} ${operation === "add" ? "to" : "from"} ${clientName}'s account. New balance: $${data.newBalance}`
      });
      setAmount("");
      setOperation("add");
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust credits",
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

    const parsedAmount = parseFloat(amount);
    const currentBalance = parseFloat(currentCredits);
    
    // Check if deduction would result in negative balance
    if (operation === "deduct" && parsedAmount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: `Cannot deduct $${amount}. Current balance is only $${currentBalance.toFixed(2)}`,
        variant: "destructive"
      });
      return;
    }

    addCreditsMutation.mutate({ userId: clientId, amount, operation });
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
          Adjust Credits
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-add-credits">
        <DialogHeader>
          <DialogTitle>Adjust Credits for {clientName}</DialogTitle>
          <DialogDescription>
            Current balance: ${parseFloat(currentCredits).toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label>Operation</Label>
              <RadioGroup 
                value={operation} 
                onValueChange={(value) => setOperation(value as "add" | "deduct")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="add" id="add" data-testid="radio-add" />
                  <Label htmlFor="add" className="flex items-center gap-1.5 cursor-pointer font-normal">
                    <Plus className="h-4 w-4 text-green-500" />
                    Add Credits
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="deduct" id="deduct" data-testid="radio-deduct" />
                  <Label htmlFor="deduct" className="flex items-center gap-1.5 cursor-pointer font-normal">
                    <Minus className="h-4 w-4 text-red-500" />
                    Deduct Credits
                  </Label>
                </div>
              </RadioGroup>
            </div>

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
                {operation === "add" 
                  ? "Enter the amount to add to this client's balance" 
                  : "Enter the amount to deduct from this client's balance"}
              </p>
            </div>

            {amount && parseFloat(amount) > 0 && (
              <div className={`rounded-lg p-3 ${operation === "add" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">New Balance:</span>
                  <span className="font-bold text-lg" data-testid="text-new-balance">
                    ${operation === "add" 
                      ? (parseFloat(currentCredits) + parseFloat(amount)).toFixed(2)
                      : (parseFloat(currentCredits) - parseFloat(amount)).toFixed(2)}
                  </span>
                </div>
                {operation === "deduct" && parseFloat(amount) > parseFloat(currentCredits) && (
                  <p className="text-xs text-red-500 mt-1">
                    ⚠️ Insufficient balance
                  </p>
                )}
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
              variant={operation === "deduct" ? "destructive" : "default"}
            >
              {addCreditsMutation.isPending 
                ? `${operation === "add" ? "Adding" : "Deducting"}...` 
                : `${operation === "add" ? "Add" : "Deduct"} Credits`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
