import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ArrowLeft } from "lucide-react";
import ApiEndpointCard from "@/components/ApiEndpointCard";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ApiDocs() {
  const { t } = useLanguage();
  const endpoints = [
    {
      method: "POST" as const,
      path: "/api/v2/sms/sendsingle",
      title: t('docs.sendSingle.title'),
      description: t('docs.sendSingle.description'),
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
      title: t('docs.sendBulk.title'),
      description: t('docs.sendBulk.description'),
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
      title: t('docs.sendBulkMulti.title'),
      description: t('docs.sendBulkMulti.description'),
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
      title: t('docs.checkDelivery.title'),
      description: t('docs.checkDelivery.description'),
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
      title: t('docs.checkBalance.title'),
      description: t('docs.checkBalance.description'),
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
      title: t('docs.inbox.title'),
      description: t('docs.inbox.description'),
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
    title: t('docs.webhook.title'),
    description: t('docs.webhook.description'),
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
          <h1 className="text-4xl font-bold tracking-tight">{t('docs.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('docs.subtitle')}
          </p>
        </div>
      </div>

      <Alert data-testid="alert-authentication">
        <Info className="w-4 h-4" />
        <AlertDescription>
          <strong>{t('docs.authentication.strong')}</strong> {t('docs.authentication.description')}
          <code className="block mt-2 bg-muted p-2 rounded text-sm font-mono">
            Authorization: Bearer YOUR_API_KEY
          </code>
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">{t('docs.endpoints.title')}</h2>
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
                <p className="text-sm font-medium mb-2">{t('docs.webhook.payloadInfo')}</p>
                <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                  {webhookInfo.payloadExample}
                </pre>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                <strong>{t('docs.webhook.note')}</strong> {t('docs.webhook.noteText')}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
