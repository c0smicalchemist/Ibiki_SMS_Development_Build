import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileJson,
  Settings,
  Filter,
  Eye,
  Copy,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExportField {
  key: string;
  label: string;
  description: string;
  selected: boolean;
}

interface ContactExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: string, fields: string[], filters: any) => void;
  totalContacts: number;
  filteredContacts: number;
  currentFilters: any;
}

const EXPORT_FIELDS: ExportField[] = [
  { key: 'username', label: 'Username', description: 'Social media handle', selected: true },
  { key: 'displayName', label: 'Display Name', description: 'Full name or display name', selected: true },
  { key: 'platform', label: 'Platform', description: 'Social media platform', selected: true },
  { key: 'profileUrl', label: 'Profile URL', description: 'Link to social media profile', selected: true },
  { key: 'avatarUrl', label: 'Avatar URL', description: 'Profile picture URL', selected: false },
  { key: 'bio', label: 'Bio', description: 'Profile biography', selected: false },
  { key: 'email', label: 'Email', description: 'Email address if available', selected: true },
  { key: 'phone', label: 'Phone', description: 'Phone number if available', selected: false },
  { key: 'location', label: 'Location', description: 'Geographic location', selected: false },
  { key: 'followerCount', label: 'Followers', description: 'Number of followers', selected: true },
  { key: 'followingCount', label: 'Following', description: 'Number of accounts following', selected: false },
  { key: 'engagementRate', label: 'Engagement Rate', description: 'Average engagement rate', selected: true },
  { key: 'isVerified', label: 'Verified', description: 'Account verification status', selected: false },
  { key: 'isBusiness', label: 'Business Account', description: 'Business account indicator', selected: false },
  { key: 'category', label: 'Category', description: 'Primary category or niche', selected: true },
  { key: 'tags', label: 'Tags', description: 'Associated tags and keywords', selected: true },
  { key: 'validationStatus', label: 'Validation Status', description: 'Contact validation status', selected: false },
  { key: 'scrapedAt', label: 'Scraped Date', description: 'Date when contact was scraped', selected: false }
];

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV (Excel Compatible)', icon: FileSpreadsheet, description: 'Best for Excel and data analysis' },
  { value: 'json', label: 'JSON', icon: FileJson, description: 'Best for API integration and development' },
  { value: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet, description: 'Formatted Excel spreadsheet' },
  { value: 'txt', label: 'Plain Text', icon: FileText, description: 'Simple text format for lists' }
];

export default function ContactExportDialog({
  open,
  onOpenChange,
  onExport,
  totalContacts,
  filteredContacts,
  currentFilters
}: ContactExportDialogProps) {
  const { toast } = useToast();
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [fields, setFields] = useState<ExportField[]>(EXPORT_FIELDS);
  const [exportOnlyFiltered, setExportOnlyFiltered] = useState(true);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [customDelimiter, setCustomDelimiter] = useState(',');
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  const selectedFields = fields.filter(field => field.selected);
  const exportCount = exportOnlyFiltered ? filteredContacts : totalContacts;

  const handleFieldToggle = (fieldKey: string) => {
    setFields(prev => prev.map(field => 
      field.key === fieldKey ? { ...field, selected: !field.selected } : field
    ));
  };

  const handleSelectAll = () => {
    setFields(prev => prev.map(field => ({ ...field, selected: true })));
  };

  const handleDeselectAll = () => {
    setFields(prev => prev.map(field => ({ ...field, selected: false })));
  };

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one field to export',
        variant: 'destructive'
      });
      return;
    }

    if (exportCount === 0) {
      toast({
        title: 'Error',
        description: 'No contacts to export',
        variant: 'destructive'
      });
      return;
    }

    setExporting(true);
    try {
      const fieldKeys = selectedFields.map(field => field.key);
      const filters = exportOnlyFiltered ? currentFilters : {};
      
      await onExport(selectedFormat, fieldKeys, {
        ...filters,
        includeHeaders,
        customDelimiter: selectedFormat === 'csv' ? customDelimiter : undefined
      });
      
      toast({
        title: 'Success',
        description: `${exportCount.toLocaleString()} contacts exported successfully`
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export contacts',
        variant: 'destructive'
      });
    } finally {
      setExporting(false);
    }
  };

  const generatePreview = () => {
    const sampleData = [
      {
        username: 'john_doe',
        displayName: 'John Doe',
        platform: 'instagram',
        profileUrl: 'https://instagram.com/john_doe',
        email: 'john@example.com',
        followerCount: 15000,
        engagementRate: 3.5,
        category: 'Lifestyle',
        tags: ['travel', 'photography', 'lifestyle']
      },
      {
        username: 'jane_smith',
        displayName: 'Jane Smith',
        platform: 'tiktok',
        profileUrl: 'https://tiktok.com/@jane_smith',
        email: 'jane@example.com',
        followerCount: 25000,
        engagementRate: 5.2,
        category: 'Fashion',
        tags: ['fashion', 'style', 'beauty']
      }
    ];

    const selectedData = sampleData.map(contact => {
      const filteredContact: any = {};
      selectedFields.forEach(field => {
        if (contact.hasOwnProperty(field.key)) {
          filteredContact[field.key] = contact[field.key as keyof typeof contact];
        }
      });
      return filteredContact;
    });

    switch (selectedFormat) {
      case 'csv':
        const headers = selectedFields.map(field => field.label).join(customDelimiter);
        const rows = selectedData.map(row => 
          Object.values(row).map(value => 
            typeof value === 'string' && value.includes(customDelimiter) ? `"${value}"` : value
          ).join(customDelimiter)
        );
        return includeHeaders ? [headers, ...rows].join('\n') : rows.join('\n');
      
      case 'json':
        return JSON.stringify(selectedData, null, 2);
      
      case 'txt':
        return selectedData.map(row => 
          selectedFields.map(field => `${field.label}: ${row[field.key] || 'N/A'}`).join('\n')
        ).join('\n\n---\n\n');
      
      default:
        return JSON.stringify(selectedData, null, 2);
    }
  };

  const copyPreviewToClipboard = async () => {
    const text = generatePreview();
    const copyText = async (t: string) => {
      try {
        if (navigator.clipboard && window.isSecureContext && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(t);
          return true;
        }
      } catch {}
      const textarea = document.createElement('textarea');
      textarea.value = t;
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
          e.clipboardData?.setData('text/plain', t);
        };
        document.addEventListener('copy', handler);
        try { success = document.execCommand('copy'); } catch {}
        document.removeEventListener('copy', handler);
      }
      document.body.removeChild(textarea);
      return success;
    };
    const ok = await copyText(text);
    if (ok) {
      toast({ title: 'Copied', description: 'Preview copied to clipboard' });
    } else {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Contacts
          </DialogTitle>
          <DialogDescription>
            Customize your contact export with specific fields and formats
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {EXPORT_FORMATS.map((format) => {
                const Icon = format.icon;
                return (
                  <div
                    key={format.value}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedFormat === format.value 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedFormat(format.value)}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-medium">{format.label}</div>
                        <div className="text-sm text-gray-600">{format.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export Scope */}
          <div className="space-y-3">
            <Label>Export Scope</Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="export-filtered"
                  checked={exportOnlyFiltered}
                  onCheckedChange={(checked) => setExportOnlyFiltered(checked as boolean)}
                />
                <Label htmlFor="export-filtered" className="cursor-pointer">
                  Export only filtered contacts ({filteredContacts.toLocaleString()})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="export-all"
                  checked={!exportOnlyFiltered}
                  onCheckedChange={(checked) => setExportOnlyFiltered(!checked as boolean)}
                />
                <Label htmlFor="export-all" className="cursor-pointer">
                  Export all contacts ({totalContacts.toLocaleString()})
                </Label>
              </div>
            </div>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Select Fields to Export</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    field.selected 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleFieldToggle(field.key)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={field.selected}
                      onChange={() => {}} // Handled by parent click
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{field.label}</div>
                      <div className="text-sm text-gray-600">{field.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Format Options */}
          {selectedFormat === 'csv' && (
            <div className="space-y-3">
              <Label>CSV Options</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-headers"
                    checked={includeHeaders}
                    onCheckedChange={(checked) => setIncludeHeaders(checked as boolean)}
                  />
                  <Label htmlFor="include-headers">Include column headers</Label>
                </div>
                <div>
                  <Label htmlFor="delimiter">Custom delimiter</Label>
                  <Select value={customDelimiter} onValueChange={setCustomDelimiter}>
                    <SelectTrigger id="delimiter" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value=";">Semicolon (;)</SelectItem>
                      <SelectItem value="\t">Tab</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Preview</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {showPreview ? 'Hide' : 'Show'} Preview
                </Button>
                {showPreview && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyPreviewToClipboard}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                )}
              </div>
            </div>
            
            {showPreview && (
              <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                <Textarea
                  value={generatePreview()}
                  readOnly
                  className="font-mono text-sm min-h-[200px]"
                  placeholder="Preview will appear here..."
                />
                <div className="text-xs text-gray-600 mt-2">
                  Showing sample data with {selectedFields.length} selected fields
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-900 dark:text-blue-100">Export Summary</span>
            </div>
            <div className="text-sm space-y-1">
              <div>• Format: <span className="font-medium">{EXPORT_FORMATS.find(f => f.value === selectedFormat)?.label}</span></div>
              <div>• Contacts: <span className="font-medium">{exportCount.toLocaleString()}</span></div>
              <div>• Fields: <span className="font-medium">{selectedFields.length}</span></div>
              <div>• Estimated size: <span className="font-medium">~{(exportCount * selectedFields.length * 50 / 1024).toFixed(1)} KB</span></div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={exporting || selectedFields.length === 0 || exportCount === 0}
            className="min-w-[120px]"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export {exportCount.toLocaleString()} Contacts
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
