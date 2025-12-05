import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Client {
  id: string;
  name: string;
  email: string;
  credits: string;
}

interface ClientSelectorProps {
  onClientChange: (clientId: string | null) => void;
  selectedClientId: string | null;
  onAdminModeChange?: (isAdminMode: boolean) => void;
  isAdminMode?: boolean;
  modeLabel?: string;
}

export function ClientSelector({ onClientChange, selectedClientId, onAdminModeChange, isAdminMode = false, modeLabel }: ClientSelectorProps) {
  const { t } = useLanguage();
  const { data: clientsData, isLoading } = useQuery<{ 
    success: boolean; 
    clients: Client[];
  }>({
    queryKey: ['/api/admin/clients']
  });

  const clients = clientsData?.clients || [];

  // Auto-select first client if none selected and not in admin mode
  useEffect(() => {
    if (!isAdminMode && !selectedClientId && clients.length > 0) {
      onClientChange(clients[0].id);
    }
  }, [clients, selectedClientId, onClientChange, isAdminMode]);

  // Preserve selected client across admin mode toggles
  useEffect(() => {
    // No-op: keep selection so refresh retains context
  }, [isAdminMode]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Acting as Client</Label>
        <div className="h-10 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Acting as Client</Label>
        <p className="text-sm text-muted-foreground">No clients available</p>
      </div>
    );
  }

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="space-y-4">
      {onAdminModeChange && (
        <div className="flex items-center space-x-2">
          <Switch
            id="admin-mode"
            checked={isAdminMode}
            onCheckedChange={onAdminModeChange}
            data-testid="admin-mode-toggle"
          />
          <Label htmlFor="admin-mode">{modeLabel || 'Admin Direct Mode'}</Label>
        </div>
      )}
      
      {isAdminMode ? (
        <div className="space-y-2">
          <Label>Operating Mode</Label>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm font-medium text-blue-900">{modeLabel || 'Admin Direct Mode'}</p>
            <p className="text-xs text-blue-700">
              {t('clientSelector.adminDirectDesc')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="client-selector">Acting as Client</Label>
          <Select 
            value={selectedClientId ?? ''}
            onValueChange={(val) => onClientChange(val === '' ? null : val)}
          >
            <SelectTrigger id="client-selector" data-testid="select-client">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem 
                  key={client.id} 
                  value={client.id}
                  data-testid={`option-client-${client.id}`}
                  textValue={client.name}
                >
                  {`${client.name} (${client.email}) $${parseFloat(client.credits).toFixed(2)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClient && (
            <p className="text-xs text-muted-foreground">
              All actions will be performed as <span className="font-medium">{selectedClient.name}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
