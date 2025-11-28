import { useState, useEffect } from "react";
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
import { Send, Users, List, ArrowLeft, Upload } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ClientSelector } from "@/components/ClientSelector";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("single");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() => {
    return localStorage.getItem('selectedClientId');
  });
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    return localStorage.getItem('isAdminMode') === 'true';
  });

  // Store selected client in localStorage
  useEffect(() => {
    if (selectedClientId) {
      localStorage.setItem('selectedClientId', selectedClientId);
    } else {
      localStorage.removeItem('selectedClientId');
    }
  }, [selectedClientId]);

  // Store admin mode in localStorage
  useEffect(() => {
    localStorage.setItem('isAdminMode', isAdminMode.toString());
  }, [isAdminMode]);

  // Single SMS state
  const [singleTo, setSingleTo] = useState("");
  const [singleMessage, setSingleMessage] = useState("");
  const countries = [
    { code: 'US', name: 'USA', dial: '+1', flag: '🇺🇸' },
    { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
    { code: 'GB', name: 'UK', dial: '+44', flag: '🇬🇧' },
    { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
    { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿' },
  ];
  const [singleCountry, setSingleCountry] = useState<string>('US');

  // Bulk SMS state
  const [bulkRecipients, setBulkRecipients] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkCountry, setBulkCountry] = useState<string>('US');
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [bulkCsvFile, setBulkCsvFile] = useState<File | null>(null);
  const [bulkCsvNumbers, setBulkCsvNumbers] = useState<string[]>([]);

  // Bulk Multi SMS state
  const [bulkMultiMessages, setBulkMultiMessages] = useState([
    { to: "", message: "" }
  ]);
  const [multiCountry, setMultiCountry] = useState<string>('US');

  // Fetch current user profile
  const { data: profile } = useQuery<{
    user: { id: string; email: string; name: string; company: string | null; role: string };
  }>({
    queryKey: ['/api/client/profile']
  });

  const isAdmin = profile?.user?.role === 'admin' || profile?.user?.email === 'ibiki_dash@proton.me';
  const isSupervisor = profile?.user?.role === 'supervisor';
  const effectiveUserId = isAdmin && !isAdminMode && selectedClientId ? selectedClientId : undefined;

  // Fetch contacts and groups
  const { data: contactsData } = useQuery({
    queryKey: ["/api/contacts", effectiveUserId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = effectiveUserId 
        ? `/api/contacts?userId=${effectiveUserId}`
        : '/api/contacts';
      const response = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(t('sendSms.error.fetchContactsFailed'));
      return response.json();
    }
  });

  const { data: groupsData } = useQuery({
    queryKey: ["/api/contact-groups", effectiveUserId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = effectiveUserId 
        ? `/api/contact-groups?userId=${effectiveUserId}`
        : '/api/contact-groups';
      const response = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(t('sendSms.error.fetchGroupsFailed'));
      return response.json();
    }
  });

  const contacts: Contact[] = (contactsData as any)?.contacts || [];
  const groups: ContactGroup[] = (groupsData as any)?.groups || [];

  // Send single SMS mutation
  const sendSingleMutation = useMutation({
    mutationFn: async (data: { to: string; message: string; userId?: string }) => {
      return await apiRequest('/api/web/sms/send-single', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('sendSms.success.sent') });
      setSingleTo("");
      setSingleMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/client/messages'] });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message || t('sendSms.error.failed'), variant: "destructive" });
    }
  });

  // Send bulk SMS mutation
  const sendBulkMutation = useMutation({
    mutationFn: async (data: { recipients: string[]; message: string; userId?: string }) => {
      return await apiRequest('/api/web/sms/send-bulk', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('sendSms.success.bulkSent') });
      setBulkRecipients("");
      setBulkMessage("");
      setSelectedGroupId("");
      queryClient.invalidateQueries({ queryKey: ['/api/client/messages'] });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message || t('sendSms.error.failed'), variant: "destructive" });
    }
  });

  // Send bulk multi SMS mutation
  const sendBulkMultiMutation = useMutation({
    mutationFn: async (data: { messages: Array<{ to: string; message: string }>; userId?: string }) => {
      return await apiRequest('/api/web/sms/send-bulk-multi', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('sendSms.success.multiSent') });
      setBulkMultiMessages([{ to: "", message: "" }]);
      queryClient.invalidateQueries({ queryKey: ['/api/client/messages'] });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message || t('sendSms.error.failed'), variant: "destructive" });
    }
  });

  const handleSendSingle = () => {
    if (!singleTo || !singleMessage) {
      toast({ title: t('common.error'), description: t('sendSms.error.fillFields'), variant: "destructive" });
      return;
    }
    const dial = countries.find(c => c.code === singleCountry)?.dial || '';
    const normalizedTo = singleTo.startsWith('+') ? singleTo : `${dial}${singleTo.replace(/^\+/, '')}`;
    const defaultDial = countries.find(c => c.code === singleCountry)?.dial || '+1';
    const payload: { to: string; message: string; userId?: string; defaultDial?: string; adminDirect?: boolean; supervisorDirect?: boolean } = {
      to: normalizedTo,
      message: singleMessage,
      defaultDial,
      adminDirect: isAdminMode,
      supervisorDirect: isSupervisor && isAdminMode
    };
    if (selectedClientId) {
      payload.userId = selectedClientId;
    } else if (effectiveUserId) {
      payload.userId = effectiveUserId;
    }
    sendSingleMutation.mutate(payload);
  };

  const handleSendBulk = () => {
    let recipients: string[] = [];

    if (selectedGroupId) {
      // Use contacts from selected group
      recipients = contacts
        .filter((c: Contact) => c.groupId === selectedGroupId)
        .map((c: Contact) => c.phoneNumber);
    } else if (bulkCsvNumbers.length > 0) {
      recipients = bulkCsvNumbers;
    } else {
      // Parse manual recipients
      recipients = bulkRecipients
        .split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0);
    }

    if (recipients.length === 0 || !bulkMessage) {
      toast({ title: t('common.error'), description: t('sendSms.error.provideRecipients'), variant: "destructive" });
      return;
    }

    const defaultDial = countries.find(c => c.code === bulkCountry)?.dial || '+1';
    const normalizedRecipients = recipients.map(r => r.startsWith('+') ? r : `${defaultDial}${r.replace(/^\+/, '')}`);
    const uniqueNormalizedRecipients = Array.from(new Set(normalizedRecipients));
    if (uniqueNormalizedRecipients.length > 3000) {
      toast({ title: t('common.error'), description: 'Maximum 3000 recipients allowed per bulk send', variant: 'destructive' });
      return;
    }
    const payload: { recipients: string[]; message: string; userId?: string; defaultDial?: string; adminDirect?: boolean; supervisorDirect?: boolean } = {
      recipients: uniqueNormalizedRecipients,
      message: bulkMessage,
      defaultDial,
      adminDirect: isAdminMode,
      supervisorDirect: isSupervisor && isAdminMode
    };
    if (selectedClientId) {
      payload.userId = selectedClientId;
    } else if (effectiveUserId) {
      payload.userId = effectiveUserId;
    }
    sendBulkMutation.mutate(payload);
  };

  const handleSendBulkMulti = () => {
    const validMessages = bulkMultiMessages.filter(m => m.to && m.message);
    if (validMessages.length === 0) {
      toast({ title: t('common.error'), description: t('sendSms.error.provideMessage'), variant: "destructive" });
      return;
    }
    const defaultDialMulti = countries.find(c => c.code === multiCountry)?.dial || '+1';
    const normalizedMulti = validMessages.map(m => ({
      to: m.to.startsWith('+') ? m.to : `${defaultDialMulti}${m.to.replace(/^\+/, '')}`,
      message: m.message
    }));
    if (normalizedMulti.length > 3000) {
      toast({ title: t('common.error'), description: 'Maximum 3000 messages allowed per bulk send', variant: 'destructive' });
      return;
    }
    const payload: { messages: Array<{ to: string; message: string }>; userId?: string; defaultDial?: string; adminDirect?: boolean; supervisorDirect?: boolean } = {
      messages: normalizedMulti,
      defaultDial: defaultDialMulti,
      adminDirect: isAdminMode,
      supervisorDirect: isSupervisor && isAdminMode
    };
    if (selectedClientId) {
      payload.userId = selectedClientId;
    } else if (effectiveUserId) {
      payload.userId = effectiveUserId;
    }
    sendBulkMultiMutation.mutate(payload);
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
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="container mx-auto p-6 space-y-6">
        {(isAdmin || isSupervisor) && (
          <Card>
            <CardHeader>
              <CardTitle>{isSupervisor ? t('sendSms.supervisorDirectMode') : t('sendSms.adminMode')}</CardTitle>
              <CardDescription>{t('sendSms.selectClient')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientSelector 
                selectedClientId={selectedClientId}
                onClientChange={setSelectedClientId}
                isAdminMode={isAdminMode}
                onAdminModeChange={setIsAdminMode}
              />
            </CardContent>
          </Card>
        )}
        
        <div className="mb-6 flex items-center gap-4">
          <Link href={isAdmin ? "/admin" : (isSupervisor ? "/adminsup" : "/dashboard")}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{t('sendSms.title')}</h1>
            <p className="text-muted-foreground">{t('sendSms.subtitle')}</p>
          </div>
        </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="single" data-testid="tab-single">
            <Send className="h-4 w-4 mr-2" />
            {t('sendSms.tabs.single')}
          </TabsTrigger>
          <TabsTrigger value="bulk" data-testid="tab-bulk">
            <Users className="h-4 w-4 mr-2" />
            {t('sendSms.tabs.bulk')}
          </TabsTrigger>
          <TabsTrigger value="bulk-multi" data-testid="tab-bulk-multi">
            <List className="h-4 w-4 mr-2" />
            {t('sendSms.tabs.bulkMulti')}
          </TabsTrigger>
          <TabsTrigger value="bulk-csv" data-testid="tab-bulk-csv">
            <Upload className="h-4 w-4 mr-2" />
            Bulk CSV
          </TabsTrigger>
        </TabsList>

        {/* Single SMS Tab */}
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>{t('sendSms.tabs.single')}</CardTitle>
              <CardDescription>{t('sendSms.single.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="single-to">{t('sendSms.single.to')} *</Label>
                <div className="flex gap-2">
                  <Select value={singleCountry} onValueChange={(val) => {
                    setSingleCountry(val);
                    if (singleTo && !/^\+/.test(singleTo)) {
                      const d = countries.find(c => c.code === val)?.dial || '';
                      setSingleTo(`${d}${singleTo}`);
                    }
                  }}>
                    <SelectTrigger className="w-40" data-testid="select-single-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="single-to"
                    value={singleTo}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSingleTo(v);
                      const match = countries.find(c => v.startsWith(c.dial));
                      if (match) setSingleCountry(match.code);
                    }}
                    placeholder="1234567890"
                    data-testid="input-single-to"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="single-message">{t('sendSms.single.message')} *</Label>
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
                {sendSingleMutation.isPending ? t('sendSms.single.sending') : t('sendSms.single.send')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk SMS Tab */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>{t('sendSms.tabs.bulk')}</CardTitle>
              <CardDescription>{t('sendSms.bulk.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('sendSms.bulk.recipients')}</Label>
                <Tabs defaultValue="manual" className="mt-2">
                  <TabsList>
                    <TabsTrigger value="manual">{t('sendSms.bulk.manualEntry')}</TabsTrigger>
                    <TabsTrigger value="group">{t('sendSms.bulk.fromGroup')}</TabsTrigger>
                    <TabsTrigger value="csv">CSV</TabsTrigger>
                  </TabsList>
                  <TabsContent value="manual" className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <Select value={bulkCountry} onValueChange={setBulkCountry}>
                        <SelectTrigger className="w-40" data-testid="select-bulk-country">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map(c => (
                            <SelectItem key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">{t('sendSms.bulk.countryHint')}</span>
                    </div>
                    <Textarea
                      value={bulkRecipients}
                      onChange={(e) => setBulkRecipients(e.target.value)}
                      placeholder="Enter phone numbers, one per line&#10;1234567890&#10;0987654321"
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
                  <TabsContent value="csv" className="space-y-2">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setBulkCsvFile(file);
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const text = String(event.target?.result || '');
                            const lines = text.split('\n').filter(l => l.trim());
                            // Try to parse headers if present
                            const firstLine = lines[0] || '';
                            const hasHeader = /phone|recipient/i.test(firstLine);
                            const dataLines = hasHeader ? lines.slice(1) : lines;
                            const nums = dataLines.map(l => {
                              const parts = l.split(',').map(p => p.trim());
                              // phone might be first column; fallback to whole line
                              const candidate = parts[0] || l.trim();
                              return candidate;
                            }).filter(n => n);
                            setBulkCsvNumbers(nums);
                          };
                          reader.readAsText(file);
                        } else {
                          setBulkCsvNumbers([]);
                        }
                      }}
                      data-testid="input-bulk-csv"
                    />
                    <p className="text-sm text-muted-foreground">
                      {bulkCsvNumbers.length} recipients from CSV
                    </p>
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
                {sendBulkMutation.isPending ? t('sendSms.bulk.sending') : t('sendSms.bulk.send')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Multi SMS Tab */}
        <TabsContent value="bulk-multi">
          <Card>
            <CardHeader>
              <CardTitle>{t('sendSms.bulkMulti.title')}</CardTitle>
              <CardDescription>{t('sendSms.bulkMulti.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center mb-2">
                <Select value={multiCountry} onValueChange={setMultiCountry}>
                  <SelectTrigger className="w-40" data-testid="select-multi-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{t('sendSms.bulkMulti.countryHint')}</span>
              </div>
              {bulkMultiMessages.map((msg, index) => (
                <Card key={index}>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t('sendSms.bulkMulti.messageNumber')}{index + 1}</Label>
                      {bulkMultiMessages.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBulkMultiRow(index)}
                          data-testid={`button-remove-multi-${index}`}
                        >
                          {t('sendSms.bulkMulti.remove')}
                        </Button>
                      )}
                    </div>
                    <Input
                      value={msg.to}
                      onChange={(e) => updateBulkMultiRow(index, 'to', e.target.value)}
                      placeholder={t('sendSms.bulkMulti.recipientPlaceholder')}
                      data-testid={`input-multi-to-${index}`}
                    />
                    <Textarea
                      value={msg.message}
                      onChange={(e) => updateBulkMultiRow(index, 'message', e.target.value)}
                      placeholder={t('sendSms.bulkMulti.messagePlaceholder')}
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
                {t('sendSms.bulkMulti.addAnother')}
              </Button>

              <Button
                onClick={handleSendBulkMulti}
                disabled={sendBulkMultiMutation.isPending}
                className="w-full"
                data-testid="button-send-bulk-multi"
              >
                <List className="h-4 w-4 mr-2" />
                {sendBulkMultiMutation.isPending ? t('sendSms.bulkMulti.sending') : `${t('sendSms.bulkMulti.send')} ${bulkMultiMessages.filter(m => m.to && m.message).length} ${t('sendSms.bulkMulti.messages')}`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk CSV (top-level) */}
        <TabsContent value="bulk-csv">
          <Card>
            <CardHeader>
              <CardTitle>{t('sendSms.bulkCsv.title')}</CardTitle>
              <CardDescription>{t('sendSms.bulkCsv.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center">
                <Select value={bulkCountry} onValueChange={setBulkCountry}>
                  <SelectTrigger className="w-40" data-testid="select-bulk-csv-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">Applied to recipients without + prefix</span>
              </div>
              <div>
                <Label>{t('sendSms.bulkCsv.file')}</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setBulkCsvFile(file);
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = String(event.target?.result || '');
                        const lines = text.split('\n').filter(l => l.trim());
                        const firstLine = lines[0] || '';
                        const hasHeader = /phone|recipient/i.test(firstLine);
                        const dataLines = hasHeader ? lines.slice(1) : lines;
                        const nums = dataLines.map(l => {
                          const parts = l.split(',').map(p => p.trim());
                          return parts[0] || l.trim();
                        }).filter(n => n);
                        setBulkCsvNumbers(nums);
                      };
                      reader.readAsText(file);
                    } else {
                      setBulkCsvNumbers([]);
                    }
                  }}
                  data-testid="input-bulk-csv-top"
                />
                <p className="text-sm text-muted-foreground mt-1">{bulkCsvNumbers.length} {t('sendSms.bulkCsv.recipientsFromCsv')}</p>
              </div>
              <div>
                <Label htmlFor="bulk-csv-message">Message *</Label>
                <Textarea
                  id="bulk-csv-message"
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={6}
                  data-testid="textarea-bulk-csv-message"
                />
              </div>
              <Button
                onClick={handleSendBulk}
                disabled={sendBulkMutation.isPending}
                className="w-full"
                data-testid="button-send-bulk-csv"
              >
                <Upload className="h-4 w-4 mr-2" />
                {sendBulkMutation.isPending ? t('sendSms.bulk.sending') : t('sendSms.bulk.send')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
