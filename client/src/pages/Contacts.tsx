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
import { Users, UserPlus, Upload, Trash2, Edit, FolderPlus, Folder, ArrowLeft, Download } from "lucide-react";
import { Link } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClientSelector } from "@/components/ClientSelector";
import { DashboardHeader } from "@/components/DashboardHeader";

interface Contact {
  id: string;
  userId: string;
  phoneNumber: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
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
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
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

  // Store selected client in localStorage
  useEffect(() => {
    if (selectedClientId) {
      localStorage.setItem('selectedClientId', selectedClientId);
    } else {
      localStorage.removeItem('selectedClientId');
    }
  }, [selectedClientId]);

  // Fetch current user profile
  const { data: profile } = useQuery<{
    user: { id: string; email: string; name: string; company: string | null; role: string };
  }>({
    queryKey: ['/api/client/profile']
  });

  const isAdmin = profile?.user?.role === 'admin';
  const effectiveUserId = isAdmin && selectedClientId ? selectedClientId : undefined;

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
      if (!response.ok) throw new Error('Failed to fetch groups');
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
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    }
  });

  const groups: ContactGroup[] = (groupsData as any)?.groups || [];
  const contacts: Contact[] = (contactsData as any)?.contacts || [];

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
      toast({ title: "Success", description: "Contact group created" });
      setShowGroupDialog(false);
      setGroupName("");
      setGroupDescription("");
      setBusinessUnitPrefix("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: typeof contactData) => {
      const payload = effectiveUserId ? { ...data, userId: effectiveUserId } : data;
      return await apiRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', effectiveUserId] });
      toast({ title: "Success", description: "Contact created" });
      setShowContactDialog(false);
      setContactData({ phoneNumber: "", name: "", email: "", notes: "", groupId: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({ title: "Success", description: `Imported ${data.count} contacts` });
      setShowImportDialog(false);
      setCsvFile(null);
      setCsvData([]);
      setImportStep(1);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({ title: "Success", description: "Contact deleted" });
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
      const apiUrl = effectiveUserId 
        ? `/api/contacts/export/csv?userId=${effectiveUserId}`
        : '/api/contacts/export/csv';
      const response = await fetch(apiUrl, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      
      if (!response.ok) {
        throw new Error('Failed to export contacts');
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
      
      toast({ title: "Success", description: "Contacts exported successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export contacts", variant: "destructive" });
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
              <CardTitle>Admin Mode</CardTitle>
              <CardDescription>Select which client's contacts to manage</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientSelector 
                selectedClientId={selectedClientId}
                onClientChange={setSelectedClientId}
              />
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
              <h1 className="text-3xl font-bold">Contacts</h1>
              <p className="text-muted-foreground">Manage your contact list and groups</p>
            </div>
          </div>
          <div className="flex gap-2">
          <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-create-group">
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Contact Group</DialogTitle>
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
                    Used for CSV export. Contacts will be numbered sequentially (e.g., IBS_1, IBS_2, IBS_3)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowGroupDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => createGroupMutation.mutate({ name: groupName, description: groupDescription, businessUnitPrefix: businessUnitPrefix || undefined })}
                  disabled={!groupName || createGroupMutation.isPending}
                  data-testid="button-save-group"
                >
                  Create Group
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>

          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-import-csv">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
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
                    <Label>Select Group (Optional)</Label>
                    <Select value={selectedGroup || "ungrouped"} onValueChange={(val) => setSelectedGroup(val === "ungrouped" ? null : val)}>
                      <SelectTrigger data-testid="select-import-group">
                        <SelectValue placeholder="No group (ungrouped)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ungrouped">No group</SelectItem>
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
                  Cancel
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
                  <Label>Phone Number *</Label>
                  <Input
                    value={contactData.phoneNumber}
                    onChange={(e) => setContactData({ ...contactData, phoneNumber: e.target.value })}
                    placeholder="+1234567890"
                    data-testid="input-contact-phone"
                  />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input
                    value={contactData.name}
                    onChange={(e) => setContactData({ ...contactData, name: e.target.value })}
                    placeholder="John Doe"
                    data-testid="input-contact-name"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={contactData.email}
                    onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                    placeholder="john@example.com"
                    data-testid="input-contact-email"
                  />
                </div>
                <div>
                  <Label>Group</Label>
                  <Select value={contactData.groupId || "ungrouped"} onValueChange={(value) => setContactData({ ...contactData, groupId: value === "ungrouped" ? "" : value })}>
                    <SelectTrigger data-testid="select-contact-group">
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ungrouped">No group</SelectItem>
                      {groups.map((group: ContactGroup) => (
                        <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={contactData.notes}
                    onChange={(e) => setContactData({ ...contactData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    data-testid="input-contact-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowContactDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => createContactMutation.mutate(contactData)}
                  disabled={!contactData.phoneNumber || createContactMutation.isPending}
                  data-testid="button-save-contact"
                >
                  Add Contact
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Groups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant={selectedGroup === null ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedGroup(null)}
              data-testid="button-group-all"
            >
              <Users className="h-4 w-4 mr-2" />
              All Contacts ({contacts.length})
            </Button>
            {groups.map((group: ContactGroup) => (
              <div key={group.id} className="space-y-1">
                <Button
                  variant={selectedGroup === group.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedGroup(group.id)}
                  data-testid={`button-group-${group.id}`}
                >
                  <Folder className="h-4 w-4 mr-2" />
                  <span className="flex-1 text-left">{group.name} ({contacts.filter((c: Contact) => c.groupId === group.id).length})</span>
                </Button>
                {group.businessUnitPrefix && (
                  <div className="pl-6 text-xs text-muted-foreground">
                    Business: {group.businessUnitPrefix}_*
                  </div>
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
                : "All Contacts"}
            </CardTitle>
            <CardDescription>
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Actions</TableHead>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
