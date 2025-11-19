import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ArrowLeft } from "lucide-react";
import ApiEndpointCard from "@/components/ApiEndpointCard";
import { WebhookRoutingDocs } from "@/components/WebhookRoutingDocs";
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
  -d '{"recipient": "${t('examples.phone.sample1')}", "message": "${t('examples.sms.verificationCode')}"}'`,
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
  "recipients": ["${t('examples.phone.sample1')}", "${t('examples.phone.sample2')}"],
  "content": "${t('examples.sms.orderShipped')}"
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
  {"recipient": "${t('examples.phone.sample1')}", "content": "${t('examples.sms.verificationCode')}"},
  {"recipient": "${t('examples.phone.sample2')}", "content": "${t('examples.sms.orderShipped')}"}
]'`,
      responseExample: `{
  "success": true,
  "results": [
    {"messageId": "60f1a5b3e6e7c12345678901", "recipient": "${t('examples.phone.sample1')}", "status": "queued"}
  ],
  "totalSent": 2,
  "totalFailed": 0
}`
    },
    {
      method: "GET" as const,
      path: "/api/v2/sms/messages",
      title: "Get All Sent Messages",
      description: "Retrieve all messages sent by your account with their status. Returns up to 100 messages by default. Use the 'limit' query parameter to control the number of messages returned.",
      requestExample: `curl -X GET "http://151.243.109.79/api/v2/sms/messages?limit=50" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      responseExample: `{
  "success": true,
  "messages": [
    {
      "id": "msg_abc123",
      "messageId": "60f1a5b3e6e7c12345678901",
      "endpoint": "sendsingle",
      "recipient": "${t('examples.phone.sample1')}",
      "status": "delivered",
      "totalCost": "0.05",
      "totalCharge": "0.10",
      "messageCount": 1,
      "createdAt": "2025-11-18T10:30:00.000Z"
    }
  ],
  "count": 1,
  "limit": 50
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
      "from": "${t('examples.phone.sample1')}",
      "firstname": "${t('examples.name.first')}",
      "lastname": "${t('examples.name.last')}",
      "business": "${t('examples.company')}",
      "message": "${t('examples.sms.reply')}",
      "status": "received",
      "receiver": "${t('examples.phone.sample2')}",
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
  "from": "${t('examples.phone.sample1')}",
  "firstname": "${t('examples.name.first')}",
  "lastname": "${t('examples.name.last')}",
  "business": "${t('examples.company')}",
  "message": "${t('examples.sms.stopMessage')}",
  "status": "blocked",
  "matchedBlockWord": "stop",
  "receiver": "${t('examples.phone.sample2')}",
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

      <div className="mt-12">
        <WebhookRoutingDocs />
      </div>
    </div>
  );
}
