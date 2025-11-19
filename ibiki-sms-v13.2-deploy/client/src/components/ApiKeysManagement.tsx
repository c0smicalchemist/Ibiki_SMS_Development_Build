import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ApiKeyDialog } from "./ApiKeyDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ApiKey {
  id: string;
  displayKey: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ApiKeysManagementProps {
  apiKeys: ApiKey[];
}

export function ApiKeysManagement({ apiKeys }: ApiKeysManagementProps) {
  const { toast } = useToast();
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/client/generate-key', {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      setNewApiKey(data.apiKey);
      setShowApiKeyDialog(true);
      queryClient.invalidateQueries({ queryKey: ['/api/client/profile'] });
      toast({
        title: "New API Key Generated",
        description: "Save your new key now - it won't be shown again!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Generate Key",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest('/api/client/revoke-key', {
        method: 'POST',
        body: JSON.stringify({ keyId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/profile'] });
      toast({
        title: "API Key Revoked",
        description: "The key has been deactivated and can no longer be used."
      });
      setRevokeKeyId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Revoke Key",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage your API keys for accessing the Ibiki SMS API
              </CardDescription>
            </div>
            <Button
              onClick={() => generateKeyMutation.mutate()}
              disabled={generateKeyMutation.isPending}
              data-testid="button-generate-key"
            >
              <Plus className="w-4 h-4 mr-2" />
              Generate New Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No API keys found. Generate one to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border"
                  data-testid={`api-key-${key.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono">{key.displayKey}</code>
                      <Badge variant={key.isActive ? "default" : "secondary"}>
                        {key.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                      {key.lastUsedAt && (
                        <span className="ml-4">
                          Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRevokeKeyId(key.id)}
                      disabled={!key.isActive}
                      data-testid={`button-revoke-${key.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Important:</strong> For security, the full API key is only shown once when generated. 
              If you lost your key, you must revoke it and generate a new one. The masked version shown here 
              is for reference only and cannot be used for API requests.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* New API Key Dialog */}
      {newApiKey && (
        <ApiKeyDialog
          open={showApiKeyDialog}
          onOpenChange={(open) => {
            setShowApiKeyDialog(open);
            if (!open) setNewApiKey(null);
          }}
          apiKey={newApiKey}
          title="New API Key Generated"
        />
      )}

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!revokeKeyId} onOpenChange={() => setRevokeKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately deactivate the API key. Any applications using this key will stop working.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeKeyId && revokeKeyMutation.mutate(revokeKeyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
