import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Users, UserPlus, Upload, Trash2, Edit, FolderPlus, Folder, ArrowLeft, Download, CloudUpload, AlertCircle, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClientSelector } from "@/components/ClientSelector";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useLanguage } from "@/contexts/LanguageContext";

interface Contact {
  id: string;
  userId: string;
  phoneNumber: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  groupId: string | null;
  syncedToExtremeSMS: boolean;
  lastExportedAt: string | null;
  createdAt: string;
  updatedAt: string;
  business?: string | null;
}

interface ContactGroup {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  businessUnitPrefix: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Contacts() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState<string>('');
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [businessUnitPrefix, setBusinessUnitPrefix] = useState("");
  const [contactData, setContactData] = useState({
    phoneNumber: "",
    name: "",
    email: "",
    notes: "",
    groupId: ""
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [importStep, setImportStep] = useState(1);
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

  // Fetch current user profile
  const { data: profile } = useQuery<{
    user: { id: string; email: string; name: string; company: string | null; role: string };
  }>({
    queryKey: ['/api/client/profile']
  });

  const isAdmin = profile?.user?.role === 'admin';
  const effectiveUserId = isAdmin && !isAdminMode && selectedClientId ? selectedClientId : undefined;
  const [includeBusiness, setIncludeBusiness] = useState(false);

  // Fetch contact groups
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
      if (!response.ok) throw new Error(t('contacts.error.fetchGroupsFailed'));
      return response.json();
    }
  });

  // Fetch contacts
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
      if (!response.ok) throw new Error(t('contacts.error.fetchFailed'));
      return response.json();
    }
  });

  const groups: ContactGroup[] = (groupsData as any)?.groups || [];
  const contacts: Contact[] = (contactsData as any)?.contacts || [];

  // Fetch sync stats
  const { data: syncStatsData } = useQuery({
    queryKey: ["/api/contacts/sync-stats", effectiveUserId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const url = effectiveUserId 
        ? `/api/contacts/sync-stats?userId=${effectiveUserId}`
        : '/api/contacts/sync-stats';
      const response = await fetch(url, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Failed to fetch sync stats');
      return response.json();
    }
  });

  const syncStats = syncStatsData || { total: 0, synced: 0, unsynced: 0 };

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; businessUnitPrefix?: string }) => {
      const payload = effectiveUserId ? { ...data, userId: effectiveUserId } : data;
      return await apiRequest('/api/contact-groups', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contact-groups', effectiveUserId] });
      toast({ title: t('common.success'), description: t('contacts.success.groupCreated') });
      setShowGroupDialog(false);
      setGroupName("");
      setGroupDescription("");
      setBusinessUnitPrefix("");
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    }
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: typeof contactData) => {
      // auto-assign business from client profile
      const payload = effectiveUserId ? { ...data, userId: effectiveUserId } : data;
      return await apiRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', effectiveUserId] });
      toast({ title: t('common.success'), description: t('contacts.success.contactCreated') });
      setShowContactDialog(false);
      setContactData({ phoneNumber: "", name: "", email: "", notes: "", groupId: "" });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    }
  });

  // Import contacts mutation
  const importContactsMutation = useMutation({
    mutationFn: async (data: { contacts: any[]; groupId: string | null }) => {
      const payload = effectiveUserId ? { ...data, userId: effectiveUserId } : data;
      return await apiRequest('/api/contacts/import-csv', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', effectiveUserId] });
      toast({ title: t('common.success'), description: `${data.count} ${t('contacts.success.imported')}` });
      setShowImportDialog(false);
      setCsvFile(null);
      setCsvData([]);
      setImportStep(1);
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
    }
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const url = effectiveUserId 
        ? `/api/contacts/${id}?userId=${effectiveUserId}`
        : `/api/contacts/${id}`;
      return await apiRequest(url, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', effectiveUserId] });
      toast({ title: t('common.success'), description: t('contacts.success.contactDeleted') });
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',').map(v => v.trim());
          return headers.reduce((obj: any, header, index) => {
            obj[header] = values[index] || "";
            return obj;
          }, {});
        });
        setCsvData(data);
        setImportStep(2);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = () => {
    const contacts = csvData.map(row => ({
      phoneNumber: row.phone || row.phoneNumber || row.Phone || row.PhoneNumber || "",
      name: row.name || row.Name || "",
      email: row.email || row.Email || "",
      notes: row.notes || row.Notes || ""
    })).filter(c => c.phoneNumber);

    importContactsMutation.mutate({
      contacts,
      groupId: selectedGroup
    });
  };

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const base = effectiveUserId 
        ? `/api/contacts/export/csv?userId=${effectiveUserId}`
        : '/api/contacts/export/csv';
      const apiUrl = includeBusiness ? `${base}${base.includes('?') ? '&' : '?'}includeBusiness=true` : base;
      const response = await fetch(apiUrl, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      
      if (!response.ok) {
        throw new Error(t('contacts.error.exportFailed'));
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts-export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Invalidate sync stats after export
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/sync-stats', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', effectiveUserId] });
      
      toast({ title: t('common.success'), description: t('contacts.success.exported') });
    } catch (error) {
      toast({ title: t('common.error'), description: t('contacts.error.exportFailed'), variant: "destructive" });
    }
  };

  const filteredContacts = selectedGroup
    ? contacts.filter((c: Contact) => c.groupId === selectedGroup)
    : contacts;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="container mx-auto p-6 space-y-6">
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>{t('contacts.adminMode')}</CardTitle>
              <CardDescription>{t('contacts.selectClient')}</CardDescription>
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

        {syncStats.unsynced > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  {syncStats.unsynced} {syncStats.unsynced === 1 ? 'contact needs' : 'contacts need'} to be exported and uploaded to ExtremeSMS
                </p>
                <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                  Export as CSV, then upload to ExtremeSMS to enable incoming message routing
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportCSV}
                className="border-yellow-300 dark:border-yellow-700 hover-elevate"
                data-testid="button-export-warning"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardContent>
          </Card>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={isAdmin ? "/admin" : "/dashboard"}>
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{t('contacts.title')}</h1>
              <p className="text-muted-foreground">{t('contacts.subtitle')}</p>
            </div>
          </div>
          <div className="flex gap-2">
          <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-create-group">
                <FolderPlus className="h-4 w-4 mr-2" />
                {t('contacts.newGroup')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('contacts.dialog.newGroup')}</DialogTitle>
                <DialogDescription>
                  Organize your contacts into groups for easier management
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="group-name">Group Name *</Label>
                  <Input
                    id="group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., Customers, VIP Clients"
                    data-testid="input-group-name"
                  />
                </div>
                <div>
                  <Label htmlFor="group-description">Description (Optional)</Label>
                  <Textarea
                    id="group-description"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="Add a description..."
                    data-testid="input-group-description"
                  />
                </div>
                <div>
                  <Label htmlFor="business-prefix">Business Unit Prefix (Optional)</Label>
                  <Input
                    id="business-prefix"
                    value={businessUnitPrefix}
                    onChange={(e) => setBusinessUnitPrefix(e.target.value.toUpperCase())}
                    placeholder="e.g., IBS, SALES, VIP"
                    data-testid="input-business-prefix"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for internal organization. CSV exports will use the client Business name from Admin.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowGroupDialog(false)}>{t('common.cancel')}</Button>
                <Button
                  onClick={() => createGroupMutation.mutate({ name: groupName, description: groupDescription, businessUnitPrefix: businessUnitPrefix || undefined })}
                  disabled={!groupName || createGroupMutation.isPending}
                  data-testid="button-save-group"
                >
                  {t('contacts.newGroup')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            {t('contacts.export')}
          </Button>

          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-import-csv">
                <Upload className="h-4 w-4 mr-2" />
                {t('contacts.import')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Contacts</DialogTitle>
                <DialogDescription>
                  Upload a CSV file containing your contacts. File should have columns for phone numbers and optionally names and emails.
                </DialogDescription>
              </DialogHeader>
              
              {importStep === 1 && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <Label htmlFor="csv-upload" className="cursor-pointer">
                      <span className="text-primary hover:underline">Select CSV File</span>
                      <Input
                        id="csv-upload"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileUpload}
                        data-testid="input-csv-file"
                      />
                    </Label>
                    <p className="text-sm text-muted-foreground mt-2">
                      File should contain columns: phone, name, email
                    </p>
                  </div>
                </div>
              )}

              {importStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label>{t("contacts.import.selectGroup")} ({t("contacts.dialog.optional")})</Label>
                    <Select value={selectedGroup || "ungrouped"} onValueChange={(val) => setSelectedGroup(val === "ungrouped" ? null : val)}>
                      <SelectTrigger data-testid="select-import-group">
                        <SelectValue placeholder={`${t("contacts.noGroup")} (${t("contacts.ungrouped")})`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ungrouped">{t("contacts.noGroup")}</SelectItem>
                        {groups.map((group: ContactGroup) => (
                          <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Preview ({csvData.length} contacts)</p>
                    <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                      <pre className="text-xs">{JSON.stringify(csvData.slice(0, 5), null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowImportDialog(false);
                  setImportStep(1);
                  setCsvData([]);
                  setCsvFile(null);
                }}>
                  {t('common.cancel')}
                </Button>
                {importStep === 2 && (
                  <Button
                    onClick={handleImport}
                    disabled={csvData.length === 0 || importContactsMutation.isPending}
                    data-testid="button-confirm-import"
                  >
                    Import {csvData.length} Contacts
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-contact">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("contacts.dialog.phoneNumber")} *</Label>
                  <Input
                    value={contactData.phoneNumber}
                    onChange={(e) => setContactData({ ...contactData, phoneNumber: e.target.value })}
                    placeholder="+1234567890"
                    data-testid="input-contact-phone"
                  />
                </div>
                <div>
                  <Label>{t("contacts.dialog.contactName")}</Label>
                  <Input
                    value={contactData.name}
                    onChange={(e) => setContactData({ ...contactData, name: e.target.value })}
                    placeholder="John Doe"
                    data-testid="input-contact-name"
                  />
                </div>
                <div>
                  <Label>{t("contacts.table.email")}</Label>
                  <Input
                    value={contactData.email}
                    onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                    placeholder="john@example.com"
                    data-testid="input-contact-email"
                  />
                </div>
                <div>
                  <Label>{t("contacts.table.group")}</Label>
                  <Select value={contactData.groupId || "ungrouped"} onValueChange={(value) => setContactData({ ...contactData, groupId: value === "ungrouped" ? "" : value })}>
                    <SelectTrigger data-testid="select-contact-group">
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ungrouped">{t("contacts.noGroup")}</SelectItem>
                      {groups.map((group: ContactGroup) => (
                        <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("contacts.table.notes")}</Label>
                  <Textarea
                    value={contactData.notes}
                    onChange={(e) => setContactData({ ...contactData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    data-testid="input-contact-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowContactDialog(false)}>{t('common.cancel')}</Button>
                <Button
                  onClick={() => createContactMutation.mutate(contactData)}
                  disabled={!contactData.phoneNumber || createContactMutation.isPending}
                  data-testid="button-save-contact"
                >
                  {t('contacts.addContact')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-2">
            <Button
              variant="outline"
              className={`text-xs ${includeBusiness ? 'bg-muted' : ''}`}
              onClick={() => setIncludeBusiness((v) => !v)}
              data-testid="toggle-include-business"
            >
              <span className="mr-2 inline-block h-3 w-3 rounded-sm border border-muted-foreground align-middle bg-background">
                {includeBusiness && <span className="block h-3 w-3 rounded-sm bg-muted" />}
              </span>
              {t('contacts.includeBusiness')}
            </Button>
          </div>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Groups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="mb-2">
              <Input placeholder="Search groups" value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} />
            </div>
            <Button
              variant={selectedGroup === null ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedGroup(null)}
              data-testid="button-group-all"
            >
              <Users className="h-4 w-4 mr-2" />
              All Contacts ({contacts.length})
            </Button>
            {(groups.filter((g: ContactGroup) => !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase()))).map((group: ContactGroup) => (
              <div key={group.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Button
                    variant={selectedGroup === group.id ? "secondary" : "ghost"}
                    className="flex-1 justify-start"
                    onClick={() => setSelectedGroup(group.id)}
                    data-testid={`button-group-${group.id}`}
                  >
                    <Folder className="h-4 w-4 mr-2" />
                    <span className="flex-1 text-left">{group.name} ({contacts.filter((c: Contact) => c.groupId === group.id).length})</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => apiRequest(`/api/contact-groups/${group.id}${effectiveUserId ? `?userId=${effectiveUserId}` : ''}` , { method: 'DELETE' }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/contact-groups', effectiveUserId] });
                      queryClient.invalidateQueries({ queryKey: ['/api/contacts', effectiveUserId] });
                      toast({ title: t('common.success'), description: 'Group deleted' });
                    })}
                    data-testid={`button-delete-group-${group.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t('common.delete')}
                  </Button>
                </div>
                {group.businessUnitPrefix && (
                  <div className="pl-6 text-[10px] text-muted-foreground">Business: {group.businessUnitPrefix}</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>
              {selectedGroup
                ? groups.find((g: ContactGroup) => g.id === selectedGroup)?.name
                : t("contacts.allContacts")}
            </CardTitle>
            <CardDescription>
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[65vh] overflow-y-auto rounded border">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="sticky top-0 bg-background z-10">
                  <TableHead>{t("contacts.table.name")}</TableHead>
                  <TableHead>{t("contacts.table.phone")}</TableHead>
                  <TableHead>{t("contacts.table.email")}</TableHead>
                  <TableHead>{t("contacts.table.group")}</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Sync Status</TableHead>
                  <TableHead>{t("contacts.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact: Contact) => (
                  <TableRow key={contact.id} data-testid={`contact-row-${contact.id}`}>
                    <TableCell>{contact.name || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{contact.phoneNumber}</TableCell>
                    <TableCell>{contact.email || "-"}</TableCell>
                    <TableCell>
                      {contact.groupId && (
                        <Badge variant="secondary">
                          {groups.find((g: ContactGroup) => g.id === contact.groupId)?.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      { (contact as any).business ? (
                        <Badge variant="outline">{(contact as any).business}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.syncedToExtremeSMS ? (
                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs">Synced</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-500">
                          <CloudUpload className="h-4 w-4" />
                          <span className="text-xs">Pending</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteContactMutation.mutate(contact.id)}
                        data-testid={`button-delete-${contact.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
