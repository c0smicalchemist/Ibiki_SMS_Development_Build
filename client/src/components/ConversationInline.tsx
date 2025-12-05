import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
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

export default function ConversationInline({ phoneNumber, userId, isAdmin, inboxGroup }: { phoneNumber: string; userId?: string; isAdmin?: boolean; inboxGroup?: any[] }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [replyText, setReplyText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversationData, isLoading, isFetching } = useQuery({
    queryKey: ['/api/web/inbox/conversation', phoneNumber, userId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = userId && isAdmin 
        ? `/api/web/inbox/conversation/${encodeURIComponent(phoneNumber)}?userId=${userId}`
        : `/api/web/inbox/conversation/${encodeURIComponent(phoneNumber)}`;
      const response = await fetch(url, { headers: token ? { "Authorization": `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('Failed to fetch conversation');
      return response.json();
    },
    enabled: !!phoneNumber,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    retry: 2,
    staleTime: 30000,
    gcTime: 600000,
    placeholderData: (prev) => prev,
    keepPreviousData: true,
  });

  const lastInbound = (() => {
    const inc = conversationData?.conversation?.incoming || [];
    return inc.length ? inc[inc.length - 1] : null;
  })();

  const business = (() => {
    const inc = conversationData?.conversation?.incoming || [];
    for (let i = inc.length - 1; i >= 0; i--) {
      const b = inc[i]?.business;
      if (b) return String(b);
    }
    return null;
  })();

  const senderAssigned = (() => {
    const out = conversationData?.conversation?.outgoing || [];
    for (let i = out.length - 1; i >= 0; i--) {
      const s = out[i]?.senderPhoneNumber;
      if (s) return String(s);
    }
    return lastInbound?.receiver ? String(lastInbound.receiver) : null;
  })();

  const markReadMutation = useMutation({
    mutationFn: async () => {
      const payload: { phoneNumber: string; userId?: string } = { phoneNumber };
      if (userId && isAdmin) payload.userId = userId;
      return await apiRequest('/api/web/inbox/mark-read', { method: 'POST', body: JSON.stringify(payload) });
    },
  });

  useEffect(() => {
    if (phoneNumber) markReadMutation.mutate();
  }, [phoneNumber]);

  const replyMutation = useMutation({
    mutationFn: async (data: { to: string; message: string; userId?: string }) => {
      return await apiRequest('/api/web/inbox/reply', { method: 'POST', body: JSON.stringify(data) });
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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversationData]);

  const messages: Message[] = [];
  const conversationIncoming = (conversationData?.conversation?.incoming || []).map((msg: any) => ({ ...msg, type: 'incoming' as const, timestamp: msg.timestamp }));
  const conversationOutgoing = (conversationData?.conversation?.outgoing || []).map((msg: any) => {
      const safeParse = (v: any) => { try { return typeof v === 'string' ? JSON.parse(v || '') : v; } catch { return null; } };
      const findMessage = (obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        for (const key of Object.keys(obj)) {
          const val: any = (obj as any)[key];
          if (typeof val === 'string' && (/message/i.test(key) || /content/i.test(key))) return val;
          if (val && typeof val === 'object') { const deep = findMessage(val); if (deep) return deep; }
        }
        return null;
      };
      let body = findMessage(safeParse(msg.requestPayload)) || findMessage(safeParse(msg.responsePayload)) || (msg.message || '') as string;
      if (!body && typeof msg.requestPayload === 'string') {
        const m = (msg.requestPayload as string).match(/"message"\s*:\s*"([\s\S]*?)"/i) || (msg.requestPayload as string).match(/"content"\s*:\s*"([\s\S]*?)"/i);
        if (m && m[1]) body = m[1];
      }
      return { ...msg, message: body, type: 'outgoing' as const, timestamp: msg.createdAt };
    });
  messages.push(...conversationIncoming, ...conversationOutgoing);
  if ((!conversationIncoming.length && !conversationOutgoing.length) && Array.isArray(inboxGroup) && inboxGroup.length) {
    const fallbackIncoming = inboxGroup.map((m: any) => ({ ...m, type: 'incoming' as const, timestamp: m.timestamp }));
    messages.push(...fallbackIncoming);
  }
  messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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
    <div className="flex flex-col h-[70vh]">
      <div className="flex items-center justify-between px-2 pb-2">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold">{String(phoneNumber)}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {business && <Badge variant="secondary" className="text-xs">{t('inbox.label.business')}: {business}</Badge>}
            {senderAssigned && <Badge variant="secondary" className="text-xs">{t('inbox.label.sender')}: {senderAssigned}</Badge>}
            {lastInbound?.usedmodem && <Badge variant="secondary" className="text-xs">{t('inbox.label.modem')}: {String(lastInbound.usedmodem)}</Badge>}
            {lastInbound?.port && <Badge variant="secondary" className="text-xs">{t('inbox.label.port')}: {String(lastInbound.port)}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2"></div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {isLoading && !messages.length ? (
          <div className="text-center text-muted-foreground py-8">{t('common.loading')}...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">{t('inbox.noMessages')}</div>
        ) : (
          messages.map((msg, index) => (
            <div key={`${msg.type}-${msg.id}-${index}`} className={`flex ${msg.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${msg.type === 'outgoing' ? 'ml-auto' : 'mr-auto'}`}>
                <div className={`rounded-lg px-4 py-2 ${msg.type === 'outgoing' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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
        {isFetching && (
          <div className="text-center py-1 text-xs text-muted-foreground">{t('common.loading')}…</div>
        )}
      </div>

      <div className="border-t pt-2">
        <div className="flex gap-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={t('inbox.typeReply')}
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (replyText.trim()) replyMutation.mutate({ to: phoneNumber, message: replyText, userId, ...(lastInbound?.usedmodem ? { usemodem: String(lastInbound.usedmodem) } : {}), ...(lastInbound?.port ? { port: String(lastInbound.port) } : {}) }); } }}
          />
          <Button onClick={() => replyText.trim() && replyMutation.mutate({ to: phoneNumber, message: replyText, userId, ...(lastInbound?.usedmodem ? { usemodem: String(lastInbound.usedmodem) } : {}), ...(lastInbound?.port ? { port: String(lastInbound.port) } : {}) })} disabled={replyMutation.isPending || !replyText.trim()} size="icon" className="h-[60px] w-[60px]">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t('inbox.pressEnterToSend')}</p>
      </div>
    </div>
  );
}
