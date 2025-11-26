import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface Message {
  id: string;
  message: string;
  timestamp: string;
  status?: string;
  type: 'incoming' | 'outgoing';
  createdAt?: string;
}

interface ConversationDialogProps {
  open: boolean;
  onClose: () => void;
  phoneNumber: string;
  userId?: string;
  isAdmin?: boolean;
}

export function ConversationDialog({ open, onClose, phoneNumber, userId, isAdmin }: ConversationDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [replyText, setReplyText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch conversation history
  const { data: conversationData, isLoading } = useQuery({
    queryKey: ['/api/web/inbox/conversation', phoneNumber, userId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = userId && isAdmin 
        ? `/api/web/inbox/conversation/${encodeURIComponent(phoneNumber)}?userId=${userId}`
        : `/api/web/inbox/conversation/${encodeURIComponent(phoneNumber)}`;
      const response = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Failed to fetch conversation');
      return response.json();
    },
    enabled: open && !!phoneNumber,
  });

  const lastInbound = (() => {
    const inc = conversationData?.conversation?.incoming || [];
    return inc.length ? inc[inc.length - 1] : null;
  })();

  // Mark conversation as read when opening
  const markReadMutation = useMutation({
    mutationFn: async () => {
      const payload: { phoneNumber: string; userId?: string } = { phoneNumber };
      if (userId && isAdmin) {
        payload.userId = userId;
      }
      return await apiRequest('/api/web/inbox/mark-read', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
  });

  useEffect(() => {
    if (open && phoneNumber) {
      markReadMutation.mutate();
    }
  }, [open, phoneNumber]);

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async (data: { to: string; message: string; userId?: string }) => {
      return await apiRequest('/api/web/inbox/reply', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('inbox.success.replySent') });
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ['/api/web/inbox/conversation', phoneNumber, userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/web/inbox', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/client/messages'] });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message || t('inbox.error.replyFailed'), variant: "destructive" });
    }
  });

  const handleSendReply = () => {
    if (!replyText.trim()) {
      toast({ title: t('common.error'), description: t('inbox.error.enterReply'), variant: "destructive" });
      return;
    }
    const payload: { to: string; message: string; userId?: string } = {
      to: phoneNumber,
      message: replyText
    };
    if (userId && isAdmin) {
      payload.userId = userId;
    }
    replyMutation.mutate(payload);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationData]);

  // Combine and sort messages
  const messages: Message[] = [];
  if (conversationData?.conversation) {
    const incoming = (conversationData.conversation.incoming || []).map((msg: any) => ({
      ...msg,
      type: 'incoming' as const,
      timestamp: msg.timestamp
    }));
    const outgoing = (conversationData.conversation.outgoing || []).map((msg: any) => {
      let body = '';
      try {
        const req = typeof msg.requestPayload === 'string' ? JSON.parse(msg.requestPayload || '') : msg.requestPayload;
        body = (req?.message || req?.content || msg.message || '') as string;
      } catch {
        body = (msg.message || '') as string;
      }
      if (!body) {
        try {
          const resp = typeof msg.responsePayload === 'string' ? JSON.parse(msg.responsePayload || '') : msg.responsePayload;
          body = (resp?.message || resp?.content || body || '') as string;
        } catch {}
      }
      return {
        ...msg,
        message: body,
        type: 'outgoing' as const,
        timestamp: msg.createdAt
      };
    });
    messages.push(...incoming, ...outgoing);
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { variant: 'default' | 'secondary' | 'destructive' | 'outline', className: string } } = {
      'queued': { variant: 'secondary', className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20' },
      'sent': { variant: 'default', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
      'delivered': { variant: 'secondary', className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' },
      'failed': { variant: 'destructive', className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20' }
    };
    const config = statusMap[status] || statusMap['sent'];
    return <Badge variant={config.variant} className={`${config.className} text-xs`}>{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-conversation-title">
              {t('inbox.conversation')}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="text-conversation-phone">
              {phoneNumber}
            </p>
            {lastInbound?.usedmodem || lastInbound?.port ? (
              <div className="mt-1 flex items-center gap-2">
                {lastInbound?.usedmodem && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-modem">modem: {String(lastInbound.usedmodem)}</Badge>
                )}
                {lastInbound?.port && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-port">port: {String(lastInbound.port)}</Badge>
                )}
              </div>
            ) : null}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            data-testid="button-close-conversation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4" data-testid="conversation-messages">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              {t('common.loading')}...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {t('inbox.noMessages')}
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={`${msg.type}-${msg.id}-${index}`}
                className={`flex ${msg.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${msg.type}-${index}`}
              >
                <div className={`max-w-[70%] ${msg.type === 'outgoing' ? 'ml-auto' : 'mr-auto'}`}>
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      msg.type === 'outgoing'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                  <div className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${msg.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                    <span>{format(new Date(msg.timestamp), 'MM/dd/yyyy, HH:mm:ss')}</span>
                    {msg.status && msg.type === 'outgoing' && getStatusBadge(msg.status)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Reply Input */}
        <div className="border-t px-6 py-4 bg-muted/30">
          <div className="flex gap-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t('inbox.typeReply')}
              className="flex-1 min-h-[60px] max-h-[120px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              data-testid="input-reply-message"
            />
            <Button
              onClick={handleSendReply}
              disabled={replyMutation.isPending || !replyText.trim()}
              size="icon"
              className="h-[60px] w-[60px]"
              data-testid="button-send-reply"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t('inbox.pressEnterToSend')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
