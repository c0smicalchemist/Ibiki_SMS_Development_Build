import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, Send } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TestResult {
  endpoint: string;
  status: 'success' | 'error' | 'pending';
  response?: any;
  error?: string;
  timestamp: Date;
}

export default function ApiTestUtility() {
  const [selectedEndpoint, setSelectedEndpoint] = useState("balance");
  const [testPayload, setTestPayload] = useState("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const testMutation = useMutation({
    mutationFn: async ({ endpoint, payload }: { endpoint: string; payload?: any }) => {
      return await apiRequest('/api/admin/test-endpoint', {
        method: 'POST',
        body: JSON.stringify({ endpoint, payload })
      });
    },
    onSuccess: (data, variables) => {
      setTestResults(prev => [{
        endpoint: variables.endpoint,
        status: 'success',
        response: data,
        timestamp: new Date()
      }, ...prev]);
    },
    onError: (error: any, variables) => {
      setTestResults(prev => [{
        endpoint: variables.endpoint,
        status: 'error',
        error: error.message || 'Request failed',
        timestamp: new Date()
      }, ...prev]);
    }
  });

  const endpoints = [
    {
      value: "balance",
      label: "GET /api/v2/account/balance",
      method: "GET",
      description: "Check account credit balance",
      samplePayload: null
    },
    {
      value: "sendsingle",
      label: "POST /api/v2/sms/sendsingle",
      method: "POST",
      description: "Send a single SMS",
      samplePayload: JSON.stringify({
        recipient: "+1234567890",
        message: "Test message from Ibiki SMS"
      }, null, 2)
    },
    {
      value: "sendbulk",
      label: "POST /api/v2/sms/sendbulk",
      method: "POST",
      description: "Send bulk SMS (same content)",
      samplePayload: JSON.stringify({
        recipients: ["+1234567890", "+1987654321"],
        content: "Bulk test message"
      }, null, 2)
    },
    {
      value: "sendbulkmulti",
      label: "POST /api/v2/sms/sendbulkmulti",
      method: "POST",
      description: "Send bulk SMS (different content)",
      samplePayload: JSON.stringify([
        { recipient: "+1234567890", content: "Your code is 123456" },
        { recipient: "+1987654321", content: "Order shipped" }
      ], null, 2)
    }
  ];

  const selectedEndpointData = endpoints.find(e => e.value === selectedEndpoint);

  const handleTest = () => {
    let payload = null;
    
    if (selectedEndpointData?.method === "POST" && testPayload) {
      try {
        payload = JSON.parse(testPayload);
      } catch (e) {
        setTestResults(prev => [{
          endpoint: selectedEndpoint,
          status: 'error',
          error: 'Invalid JSON payload',
          timestamp: new Date()
        }, ...prev]);
        return;
      }
    }

    testMutation.mutate({ endpoint: selectedEndpoint, payload });
  };

  const handleQuickTest = (endpoint: string) => {
    const endpointData = endpoints.find(e => e.value === endpoint);
    setSelectedEndpoint(endpoint);
    if (endpointData?.samplePayload) {
      setTestPayload(endpointData.samplePayload);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Endpoint Testing</CardTitle>
          <CardDescription>
            Test your API endpoints to verify they're working correctly using your IbikiSMS API key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              Tests use your IbikiSMS API key directly (not client keys). These tests will NOT charge clients.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Endpoint</Label>
                  <Select value={selectedEndpoint} onValueChange={(value) => {
                    setSelectedEndpoint(value);
                    const endpoint = endpoints.find(e => e.value === value);
                    if (endpoint?.samplePayload) {
                      setTestPayload(endpoint.samplePayload);
                    } else {
                      setTestPayload("");
                    }
                  }}>
                    <SelectTrigger data-testid="select-endpoint">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {endpoints.map((endpoint) => (
                        <SelectItem key={endpoint.value} value={endpoint.value}>
                          {endpoint.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedEndpointData && (
                    <p className="text-sm text-muted-foreground">
                      {selectedEndpointData.description}
                    </p>
                  )}
                </div>

                {selectedEndpointData?.method === "POST" && (
                  <div className="space-y-2">
                    <Label>Request Payload (JSON)</Label>
                    <Textarea
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      placeholder="Enter JSON payload..."
                      className="font-mono text-sm min-h-32"
                      data-testid="textarea-payload"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleTest}
                    disabled={testMutation.isPending}
                    data-testid="button-test-endpoint"
                  >
                    {testMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Test Endpoint
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setTestResults([])}
                    data-testid="button-clear-results"
                  >
                    Clear Results
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Quick Tests</h3>
                <div className="grid grid-cols-2 gap-2">
                  {endpoints.map((endpoint) => (
                    <Button
                      key={endpoint.value}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickTest(endpoint.value)}
                      data-testid={`button-quick-${endpoint.value}`}
                    >
                      {endpoint.label.split(' ')[1]}
                    </Button>
                  ))}
                </div>
              </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>Recent API test results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border border-border space-y-2"
                  data-testid={`test-result-${index}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="font-mono text-sm font-medium">
                        {endpoints.find(e => e.value === result.endpoint)?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                        {result.status === 'success' ? 'Success' : 'Error'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {result.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {result.response && (
                    <div className="mt-2">
                      <Label className="text-xs text-muted-foreground">Response:</Label>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-48">
                        {JSON.stringify(result.response, null, 2)}
                      </pre>
                    </div>
                  )}

                  {result.error && (
                    <div className="mt-2">
                      <Label className="text-xs text-destructive">Error:</Label>
                      <p className="mt-1 p-2 bg-destructive/10 rounded text-xs text-destructive">
                        {result.error}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
