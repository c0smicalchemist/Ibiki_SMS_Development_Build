import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ArrowLeft } from "lucide-react";
import ApiEndpointCard from "@/components/ApiEndpointCard";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function ApiDocs() {
  const endpoints = [
    {
      method: "POST" as const,
      path: "/api/v2/sms/sendsingle",
      title: "Send a single SMS message",
      description: "Send a single SMS message to a recipient.",
      requestExample: `curl -X POST http://151.243.109.79/api/v2/sms/sendsingle \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"recipient": "+1234567890", "message": "Hello from Ibiki SMS!"}'`,
      responseExample: `{
  "success": true,
  "messageId": "60f1a5b3e6e7c12345678901",
  "status": "queued"
}`
    },
    {
      method: "POST" as const,
      path: "/api/v2/sms/sendbulk",
      title: "Send bulk SMS (same content)",
      description: "Send the same SMS message to multiple recipients in a single API call.",
      requestExample: `curl -X POST http://151.243.109.79/api/v2/sms/sendbulk \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "recipients": ["+1234567890", "+1987654321"],
  "content": "Hello from Ibiki SMS!"
}'`,
      responseExample: `{
  "success": true,
  "messageIds": ["60f1a5b3e6e7c12345678901", "60f1a5b3e6e7c12345678902"],
  "totalSent": 2,
  "status": "queued"
}`
    },
    {
      method: "POST" as const,
      path: "/api/v2/sms/sendbulkmulti",
      title: "Send bulk SMS (different content)",
      description: "Send different SMS messages to multiple recipients in a single API call.",
      requestExample: `curl -X POST http://151.243.109.79/api/v2/sms/sendbulkmulti \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '[
  {"recipient": "+1234567890", "content": "Your code is 123456"},
  {"recipient": "+1987654321", "content": "Order shipped"}
]'`,
      responseExample: `{
  "success": true,
  "results": [
    {"messageId": "60f1a5b3e6e7c12345678901", "recipient": "+1234567890", "status": "queued"}
  ],
  "totalSent": 2,
  "totalFailed": 0
}`
    },
    {
      method: "GET" as const,
      path: "/api/v2/sms/status/{messageId}",
      title: "Check message delivery status",
      description: "Check the delivery status of a previously sent message.",
      requestExample: `curl -X GET http://151.243.109.79/api/v2/sms/status/60f1a5b3e6e7c12345678901 \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      responseExample: `{
  "success": true,
  "messageId": "60f1a5b3e6e7c12345678901",
  "status": "delivered",
  "deliveredAt": "2025-09-17T16:30:00.000Z"
}`
    },
    {
      method: "GET" as const,
      path: "/api/v2/account/balance",
      title: "Get account credit balance",
      description: "Get the current credit balance for your account.",
      requestExample: `curl -X GET http://151.243.109.79/api/v2/account/balance \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      responseExample: `{
  "success": true,
  "balance": 250,
  "currency": "credits"
}`
    },
    {
      method: "GET" as const,
      path: "/api/v2/sms/inbox",
      title: "Get incoming messages (2-Way SMS)",
      description: "Retrieve incoming SMS messages sent to your assigned phone number. Requires phone number assignment by admin.",
      requestExample: `curl -X GET http://151.243.109.79/api/v2/sms/inbox?limit=50 \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      responseExample: `{
  "success": true,
  "messages": [
    {
      "id": "abc123",
      "from": "+1234567890",
      "firstname": "John",
      "lastname": "Doe",
      "business": "ABC Company",
      "message": "Reply to your message",
      "status": "received",
      "receiver": "+1987654321",
      "timestamp": "2025-11-18T10:30:00.000Z",
      "messageId": "ext_msg_123"
    }
  ],
  "count": 1
}`
    }
  ];

  const webhookInfo = {
    title: "Webhook Configuration (2-Way SMS)",
    description: "Configure this webhook URL in your SMS provider account to receive incoming messages:",
    webhookUrl: "http://151.243.109.79/webhook/incoming-sms",
    payloadExample: `{
  "from": "XXXXXXXXXXX",
  "firstname": "John",
  "lastname": "Doe",
  "business": "ABC Company",
  "message": "stop sending message",
  "status": "blocked",
  "matchedBlockWord": "stop",
  "receiver": "XXXXXXXXXX",
  "usedmodem": "XXXX",
  "port": "XXXX",
  "timestamp": "2025-09-23T23:23:20.887Z",
  "messageId": "68d32be5acc9914eed77720d"
}`
  };

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">API Documentation</h1>
          <p className="text-muted-foreground mt-2">
            Complete reference for the Ibiki SMS API v2.0
          </p>
        </div>
      </div>

      <Alert data-testid="alert-authentication">
        <Info className="w-4 h-4" />
        <AlertDescription>
          <strong>Authentication:</strong> All API requests require your API key in the Authorization header:
          <code className="block mt-2 bg-muted p-2 rounded text-sm font-mono">
            Authorization: Bearer YOUR_API_KEY
          </code>
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Endpoints</h2>
        {endpoints.map((endpoint, index) => (
          <ApiEndpointCard key={index} {...endpoint} />
        ))}
      </div>

      <div className="space-y-6 mt-12">
        <h2 className="text-2xl font-semibold">2-Way SMS (Webhooks)</h2>
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            <div className="space-y-3">
              <p><strong>{webhookInfo.title}</strong></p>
              <p className="text-sm">{webhookInfo.description}</p>
              <code className="block bg-muted p-3 rounded text-sm font-mono">
                {webhookInfo.webhookUrl}
              </code>
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">The system will POST this payload when you receive SMS:</p>
                <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                  {webhookInfo.payloadExample}
                </pre>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                <strong>Note:</strong> Contact admin to get a phone number assigned to your account. Incoming messages will be routed based on the receiver field.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
