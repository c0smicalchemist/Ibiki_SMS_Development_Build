import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, XCircle, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";

interface ErrorLog {
  id: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  endpoint?: string;
  userId?: string;
  userName?: string;
  details?: string;
  timestamp: string;
}

export default function ErrorLogsViewer() {
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const { data: logsData, isLoading } = useQuery<{ success: boolean; logs: ErrorLog[] }>({
    queryKey: ['/api/admin/error-logs', filterLevel],
    refetchInterval: 10000 // Auto-refresh every 10 seconds
  });

  const logs = logsData?.logs || [];

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getLevelBadgeVariant = (level: string): "default" | "destructive" | "secondary" => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>System Error Logs</CardTitle>
            <CardDescription>
              Monitor system errors, warnings, and important events
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/error-logs'] })}
            data-testid="button-refresh-logs"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Filter:</span>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-32" data-testid="select-log-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Logs</SelectItem>
                <SelectItem value="error">Errors Only</SelectItem>
                <SelectItem value="warning">Warnings Only</SelectItem>
                <SelectItem value="info">Info Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline" className="text-xs">
              {logs.length} {logs.length === 1 ? 'log' : 'logs'}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {filterLevel === 'all' ? 'No logs found' : `No ${filterLevel} logs found`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              System is running smoothly
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-border hover-elevate"
                data-testid={`log-entry-${log.id}`}
              >
                <div className="flex items-start gap-3">
                  {getLevelIcon(log.level)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getLevelBadgeVariant(log.level)} className="text-xs">
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      {log.endpoint && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {log.endpoint}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium mb-1">{log.message}</p>
                    {log.userName && (
                      <p className="text-xs text-muted-foreground">
                        User: {log.userName}
                      </p>
                    )}
                    {log.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          View Details
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                          {log.details}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
