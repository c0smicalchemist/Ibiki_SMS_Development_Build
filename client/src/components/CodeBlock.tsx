import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    const ok = await copyText(code);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-8"
          data-testid="button-copy-code"
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>
      <pre className="bg-card border border-card-border rounded-lg p-4 overflow-x-hidden">
        <code className="text-sm font-mono text-foreground whitespace-pre-wrap break-words">{code}</code>
      </pre>
    </div>
  );
}
