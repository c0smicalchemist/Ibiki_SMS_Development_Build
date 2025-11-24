import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string;
  title?: string;
}

export function ApiKeyDialog({ open, onOpenChange, apiKey, title = "Your API Key" }: ApiKeyDialogProps) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(true);

  const handleCopy = async () => {
    const copyText = async (text: string) => {
      try {
        if (navigator.clipboard && window.isSecureContext && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {}
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      let success = false;
      try {
        success = document.execCommand('copy');
      } catch {}
      if (!success) {
        const handler = (e: ClipboardEvent) => {
          e.preventDefault();
          e.clipboardData?.setData('text/plain', text);
        };
        document.addEventListener('copy', handler);
        try { success = document.execCommand('copy'); } catch {}
        document.removeEventListener('copy', handler);
      }
      document.body.removeChild(textarea);
      return success;
    };
    const ok = await copyText(apiKey);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-api-key">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Save this API key now - it won't be shown again for security reasons.
          </DialogDescription>
        </DialogHeader>
        
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Important:</strong> Copy this key now! You won't be able to see it again after closing this dialog.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Input
                readOnly
                value={showKey ? apiKey : '•'.repeat(apiKey.length)}
                className="font-mono text-sm pr-20"
                data-testid="input-api-key-display"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-12 top-1/2 -translate-y-1/2 h-7"
                onClick={() => setShowKey(!showKey)}
                data-testid="button-toggle-visibility"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                onClick={handleCopy}
                data-testid="button-copy-key"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Store this key in a secure password manager</p>
            <p>• Never share your API key publicly</p>
            <p>• You can revoke and generate a new key anytime from your dashboard</p>
          </div>

          <Button
            onClick={() => onOpenChange(false)}
            className="w-full"
            variant={copied ? "default" : "secondary"}
            data-testid="button-close-dialog"
          >
            {copied ? "Key Copied - Close" : "I've Saved My Key"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
