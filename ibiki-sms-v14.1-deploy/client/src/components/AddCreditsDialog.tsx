import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { DollarSign } from "lucide-react";

export function AddCreditsDialog() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleClick = () => {
    toast({
      title: "Contact Administrator",
      description: "Please contact your administrator to add credits to your account. They will process your payment and update your balance.",
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-add-credits" onClick={handleClick}>
          <DollarSign className="mr-2 h-4 w-4" />
          {t('dashboard.buttons.addCredits')}
        </Button>
      </DialogTrigger>
    </Dialog>
  );
}
