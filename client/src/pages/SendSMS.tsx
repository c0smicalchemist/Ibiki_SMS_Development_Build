import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, List, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

interface Contact {
  id: string;
  phoneNumber: string;
  name: string | null;
  email: string | null;
  groupId: string | null;
}

interface ContactGroup {
  id: string;
  name: string;
}

export default function SendSMS() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("single");

  // Single SMS state
  const [singleTo, setSingleTo] = useState("");
  const [singleMessage, setSingleMessage] = useState("");

  // Bulk SMS state
  const [bulkRecipients, setBulkRecipients] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");

  // Bulk Multi SMS state
  const [bulkMultiMessages, setBulkMultiMessages] = useState([
    { to: "", message: "" }
  ]);

  // Fetch contacts and groups
  const { data: contactsData } = useQuery({
    queryKey: ["/api/contacts"],
  });

  const { data: groupsData } = useQuery({
    queryKey: ["/api/contact-groups"],
  });

  const contacts: Contact[] = (contactsData as any)?.contacts || [];
  const groups: ContactGroup[] = (groupsData as any)?.groups || [];

  // Send single SMS mutation
  const sendSingleMutation = useMutation({
    mutationFn: async (data: { to: string; message: string }) => {
      return await apiRequest('/api/web/sms/send-single', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "SMS sent successfully" });
      setSingleTo("");
      setSingleMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/client/messages'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send SMS", variant: "destructive" });
    }
  });

  // Send bulk SMS mutation
  const sendBulkMutation = useMutation({
    mutationFn: async (data: { recipients: string[]; message: string }) => {
      return await apiRequest('/api/web/sms/send-bulk', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Bulk SMS sent successfully" });
      setBulkRecipients("");
      setBulkMessage("");
      setSelectedGroupId("");
      queryClient.invalidateQueries({ queryKey: ['/api/client/messages'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send bulk SMS", variant: "destructive" });
    }
  });

  // Send bulk multi SMS mutation
  const sendBulkMultiMutation = useMutation({
    mutationFn: async (data: { messages: Array<{ to: string; message: string }> }) => {
      return await apiRequest('/api/web/sms/send-bulk-multi', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Bulk multi SMS sent successfully" });
      setBulkMultiMessages([{ to: "", message: "" }]);
      queryClient.invalidateQueries({ queryKey: ['/api/client/messages'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send bulk multi SMS", variant: "destructive" });
    }
  });

  const handleSendSingle = () => {
    if (!singleTo || !singleMessage) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    sendSingleMutation.mutate({ to: singleTo, message: singleMessage });
  };

  const handleSendBulk = () => {
    let recipients: string[] = [];

    if (selectedGroupId) {
      // Use contacts from selected group
      recipients = contacts
        .filter((c: Contact) => c.groupId === selectedGroupId)
        .map((c: Contact) => c.phoneNumber);
    } else {
      // Parse manual recipients
      recipients = bulkRecipients
        .split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0);
    }

    if (recipients.length === 0 || !bulkMessage) {
      toast({ title: "Error", description: "Please provide recipients and message", variant: "destructive" });
      return;
    }

    sendBulkMutation.mutate({ recipients, message: bulkMessage });
  };

  const handleSendBulkMulti = () => {
    const validMessages = bulkMultiMessages.filter(m => m.to && m.message);
    if (validMessages.length === 0) {
      toast({ title: "Error", description: "Please provide at least one valid message", variant: "destructive" });
      return;
    }
    sendBulkMultiMutation.mutate({ messages: validMessages });
  };

  const addBulkMultiRow = () => {
    setBulkMultiMessages([...bulkMultiMessages, { to: "", message: "" }]);
  };

  const removeBulkMultiRow = (index: number) => {
    setBulkMultiMessages(bulkMultiMessages.filter((_, i) => i !== index));
  };

  const updateBulkMultiRow = (index: number, field: 'to' | 'message', value: string) => {
    const updated = [...bulkMultiMessages];
    updated[index][field] = value;
    setBulkMultiMessages(updated);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Send SMS</h1>
          <p className="text-muted-foreground">Send single or bulk SMS messages to your contacts</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="single" data-testid="tab-single">
            <Send className="h-4 w-4 mr-2" />
            Single
          </TabsTrigger>
          <TabsTrigger value="bulk" data-testid="tab-bulk">
            <Users className="h-4 w-4 mr-2" />
            Bulk
          </TabsTrigger>
          <TabsTrigger value="bulk-multi" data-testid="tab-bulk-multi">
            <List className="h-4 w-4 mr-2" />
            Bulk Multi
          </TabsTrigger>
        </TabsList>

        {/* Single SMS Tab */}
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Send Single SMS</CardTitle>
              <CardDescription>Send an SMS to a single recipient</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="single-to">Recipient Phone Number *</Label>
                <Input
                  id="single-to"
                  value={singleTo}
                  onChange={(e) => setSingleTo(e.target.value)}
                  placeholder="+1234567890"
                  data-testid="input-single-to"
                />
              </div>
              <div>
                <Label htmlFor="single-message">Message *</Label>
                <Textarea
                  id="single-message"
                  value={singleMessage}
                  onChange={(e) => setSingleMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={6}
                  data-testid="textarea-single-message"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {singleMessage.length} characters
                </p>
              </div>
              <Button
                onClick={handleSendSingle}
                disabled={sendSingleMutation.isPending}
                className="w-full"
                data-testid="button-send-single"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendSingleMutation.isPending ? "Sending..." : "Send SMS"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk SMS Tab */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Send Bulk SMS</CardTitle>
              <CardDescription>Send the same message to multiple recipients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Choose Recipients</Label>
                <Tabs defaultValue="manual" className="mt-2">
                  <TabsList>
                    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                    <TabsTrigger value="group">From Group</TabsTrigger>
                  </TabsList>
                  <TabsContent value="manual" className="space-y-2">
                    <Textarea
                      value={bulkRecipients}
                      onChange={(e) => setBulkRecipients(e.target.value)}
                      placeholder="Enter phone numbers, one per line&#10;+1234567890&#10;+0987654321"
                      rows={6}
                      data-testid="textarea-bulk-recipients"
                    />
                    <p className="text-sm text-muted-foreground">
                      {bulkRecipients.split('\n').filter(r => r.trim()).length} recipients
                    </p>
                  </TabsContent>
                  <TabsContent value="group" className="space-y-2">
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger data-testid="select-bulk-group">
                        <SelectValue placeholder="Select a contact group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group: ContactGroup) => {
                          const count = contacts.filter((c: Contact) => c.groupId === group.id).length;
                          return (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name} ({count} contacts)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedGroupId && (
                      <Badge variant="secondary">
                        {contacts.filter((c: Contact) => c.groupId === selectedGroupId).length} recipients selected
                      </Badge>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
              <div>
                <Label htmlFor="bulk-message">Message *</Label>
                <Textarea
                  id="bulk-message"
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={6}
                  data-testid="textarea-bulk-message"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {bulkMessage.length} characters
                </p>
              </div>
              <Button
                onClick={handleSendBulk}
                disabled={sendBulkMutation.isPending}
                className="w-full"
                data-testid="button-send-bulk"
              >
                <Users className="h-4 w-4 mr-2" />
                {sendBulkMutation.isPending ? "Sending..." : "Send Bulk SMS"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Multi SMS Tab */}
        <TabsContent value="bulk-multi">
          <Card>
            <CardHeader>
              <CardTitle>Send Bulk Multi SMS</CardTitle>
              <CardDescription>Send different messages to different recipients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bulkMultiMessages.map((msg, index) => (
                <Card key={index}>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Message #{index + 1}</Label>
                      {bulkMultiMessages.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBulkMultiRow(index)}
                          data-testid={`button-remove-multi-${index}`}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <Input
                      value={msg.to}
                      onChange={(e) => updateBulkMultiRow(index, 'to', e.target.value)}
                      placeholder="Recipient phone number"
                      data-testid={`input-multi-to-${index}`}
                    />
                    <Textarea
                      value={msg.message}
                      onChange={(e) => updateBulkMultiRow(index, 'message', e.target.value)}
                      placeholder="Message for this recipient"
                      rows={3}
                      data-testid={`textarea-multi-message-${index}`}
                    />
                  </CardContent>
                </Card>
              ))}
              
              <Button
                variant="outline"
                onClick={addBulkMultiRow}
                className="w-full"
                data-testid="button-add-multi-row"
              >
                + Add Another Message
              </Button>

              <Button
                onClick={handleSendBulkMulti}
                disabled={sendBulkMultiMutation.isPending}
                className="w-full"
                data-testid="button-send-bulk-multi"
              >
                <List className="h-4 w-4 mr-2" />
                {sendBulkMultiMutation.isPending ? "Sending..." : `Send ${bulkMultiMessages.filter(m => m.to && m.message).length} Messages`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
