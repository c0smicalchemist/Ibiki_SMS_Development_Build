import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Eye, EyeOff, Check } from "lucide-react";

interface ApiKeyDisplayProps {
  apiKey: string;
  title?: string;
  description?: string;
}

export default function ApiKeyDisplay({ 
  apiKey, 
  title = "Your API Key",
  description = "Use this key to authenticate your API requests"
}: ApiKeyDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

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
    if (!ok) {
      toast({ title: 'Copy failed', description: 'Unable to copy to clipboard', variant: 'destructive' });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied', description: 'API key copied to clipboard' });
  };

  const maskedKey = apiKey.slice(0, 8) + "•".repeat(24) + apiKey.slice(-4);

  return (
    <Card data-testid="card-api-key">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-md px-3 py-2 font-mono text-sm">
            <code data-testid="text-api-key">{isVisible ? apiKey : maskedKey}</code>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsVisible(!isVisible)}
            data-testid="button-toggle-visibility"
          >
            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            data-testid="button-copy-key"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
