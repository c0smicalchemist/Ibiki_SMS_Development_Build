import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, ArrowLeft } from "lucide-react";
import ApiEndpointCard from "@/components/ApiEndpointCard";
import { WebhookRoutingDocs } from "@/components/WebhookRoutingDocs";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";

export default function ApiDocs() {
  const { t } = useLanguage();
  const { data: profile } = useQuery<{ user: { role: string } }>({ queryKey: ['/api/client/profile'] });
  const isAdmin = profile?.user?.role === 'admin';
  const endpoints = [
    {
      method: "POST" as const,
      path: "/api/web/sms/send-single",
      title: 'Send Single',
      description: 'Send a single SMS to one recipient',
      requestExample: `curl -X POST https://ibiki.run.place/api/web/sms/send-single \\
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
      path: "/api/v2/sms/reply",
      title: 'Reply (Helper)',
      description: 'Reply to a conversation; modem/port mapped from last inbound',
      requestExample: `curl -X POST https://ibiki.run.place/api/v2/sms/reply \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "to": "${t('examples.phone.sample1')}",
  "message": "${t('examples.sms.verificationCode')}"
}'`,
      responseExample: `{
  "success": true,
  "provider": { "status": "queued" }
}`
    },
    {
      method: "POST" as const,
      path: "/api/web/sms/send-bulk",
      title: 'Send Bulk',
      description: 'Send the same SMS to multiple recipients',
      requestExample: `curl -X POST https://ibiki.run.place/api/web/sms/send-bulk \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "recipients": ["${t('examples.phone.sample1')}", "${t('examples.phone.sample2')}"],
  "message": "${t('examples.sms.orderShipped')}"
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
      path: "/api/web/sms/send-bulk-multi",
      title: 'Send Bulk Multi',
      description: 'Send different messages to multiple recipients in one request',
      requestExample: `curl -X POST https://ibiki.run.place/api/web/sms/send-bulk-multi \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '[
  {"to": "${t('examples.phone.sample1')}", "message": "${t('examples.sms.verificationCode')}"},
  {"to": "${t('examples.phone.sample2')}", "message": "${t('examples.sms.orderShipped')}"}
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
      path: "/api/web/sms/messages",
      title: "Get All Sent Messages",
      description: "Retrieve all messages sent by your account with their status. Returns up to 100 messages by default. Use the 'limit' query parameter to control the number of messages returned.",
      requestExample: `curl -X GET "https://ibiki.run.place/api/web/sms/messages?limit=50" \\
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
      path: "/api/web/sms/status/{messageId}",
      title: 'Check Delivery',
      description: 'Get the delivery status for a specific messageId',
      requestExample: `curl -X GET https://ibiki.run.place/api/web/sms/status/60f1a5b3e6e7c12345678901 \\
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
      path: "/api/web/account/balance",
      title: 'Check Balance',
      description: 'Get your current credits balance',
      requestExample: `curl -X GET https://ibiki.run.place/api/web/account/balance \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      responseExample: `{
  "success": true,
  "balance": 250,
  "currency": "credits"
}`
    },
    {
      method: "GET" as const,
      path: "/api/web/sms/inbox",
      title: 'Inbox',
      description: 'Retrieve recent inbound messages to your account',
      requestExample: `curl -X GET https://ibiki.run.place/api/web/sms/inbox?limit=50 \\
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
    webhookUrl: "https://ibiki.run.place/api/webhook/extreme-sms",
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
          <Button size="icon" data-testid="button-back" className="bg-blue-600 text-white hover:bg-blue-700 font-bold">
            <ArrowLeft className="h-5 w-5" strokeWidth={3} />
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

      {isAdmin ? (
        <div className="mt-12">
          <WebhookRoutingDocs />
        </div>
      ) : (
        <div className="mt-12">
          <h2 className="text-2xl font-semibold">API Error Codes</h2>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { code: 200, status: 'OK' },
              { code: 400, status: 'Bad Request' },
              { code: 401, status: 'Unauthorized' },
              { code: 402, status: 'Payment Required' },
              { code: 404, status: 'Not Found' },
              { code: 429, status: 'Too Many Requests' },
              { code: 500, status: 'Internal Server Error' }
            ].map(item => (
              <Card key={item.code} className="border border-border/60">
                <CardHeader className="py-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="font-mono text-lg">{item.code}</span>
                    <span className="text-sm text-muted-foreground">{item.status}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-0" />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
