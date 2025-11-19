import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Inbox as InboxIcon, Reply, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface IncomingMessage {
  id: string;
  from: string;
  firstname: string | null;
  lastname: string | null;
  business: string | null;
  message: string;
  status: string;
  receiver: string;
  timestamp: string;
  messageId: string;
}

export default function Inbox() {
  const { toast } = useToast();
  const [selectedMessage, setSelectedMessage] = useState<IncomingMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showReplyDialog, setShowReplyDialog] = useState(false);

  // Fetch inbox messages
  const { data: inboxData, isLoading } = useQuery({
    queryKey: ["/api/web/inbox"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const messages: IncomingMessage[] = (inboxData as any)?.messages || [];

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async (data: { to: string; message: string }) => {
      return await apiRequest('/api/web/inbox/reply', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reply sent successfully" });
      setShowReplyDialog(false);
      setReplyText("");
      setSelectedMessage(null);
      queryClient.invalidateQueries({ queryKey: ['/api/web/inbox'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client/messages'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send reply", variant: "destructive" });
    }
  });

  const handleReply = (message: IncomingMessage) => {
    setSelectedMessage(message);
    setReplyText("");
    setShowReplyDialog(true);
  };

  const handleSendReply = () => {
    if (!selectedMessage || !replyText) {
      toast({ title: "Error", description: "Please enter a reply message", variant: "destructive" });
      return;
    }
    replyMutation.mutate({
      to: selectedMessage.from,
      message: replyText
    });
  };

  // Group messages by sender
  const groupedMessages = messages.reduce((acc: any, msg) => {
    if (!acc[msg.from]) {
      acc[msg.from] = [];
    }
    acc[msg.from].push(msg);
    return acc;
  }, {});

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <InboxIcon className="h-8 w-8" />
          Inbox
        </h1>
        <p className="text-muted-foreground">View and reply to incoming SMS messages</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center">
              Loading messages...
            </CardContent>
          </Card>
        ) : messages.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <InboxIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Messages Yet</h3>
              <p className="text-muted-foreground">
                Incoming SMS messages will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedMessages).map(([sender, msgs]: [string, any]) => {
            const latestMsg = msgs[msgs.length - 1];
            const senderName = latestMsg.firstname && latestMsg.lastname
              ? `${latestMsg.firstname} ${latestMsg.lastname}`
              : latestMsg.firstname || latestMsg.lastname || sender;

            return (
              <Card key={sender} data-testid={`conversation-${sender}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        {senderName}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">{sender}</CardDescription>
                      {latestMsg.business && (
                        <Badge variant="outline" className="mt-1">{latestMsg.business}</Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleReply(latestMsg)}
                      data-testid={`button-reply-${sender}`}
                    >
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {msgs.map((msg: IncomingMessage) => (
                    <div key={msg.id} className="border-l-2 border-primary pl-4 py-2" data-testid={`message-${msg.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant={msg.status === "received" ? "secondary" : "destructive"}>
                          {msg.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.timestamp), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                        <span>Receiver: {msg.receiver}</span>
                        {msg.messageId && <span>• ID: {msg.messageId}</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Message</DialogTitle>
            <DialogDescription>
              Sending reply to {selectedMessage?.from}
              {selectedMessage?.firstname && ` (${selectedMessage.firstname})`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Original Message</Label>
              <div className="border rounded-lg p-3 bg-muted text-sm">
                {selectedMessage?.message}
              </div>
            </div>
            <div>
              <Label htmlFor="reply-message">Your Reply *</Label>
              <Textarea
                id="reply-message"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here..."
                rows={6}
                data-testid="textarea-reply"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {replyText.length} characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReplyDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendReply}
              disabled={!replyText || replyMutation.isPending}
              data-testid="button-send-reply"
            >
              <Reply className="h-4 w-4 mr-2" />
              {replyMutation.isPending ? "Sending..." : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
