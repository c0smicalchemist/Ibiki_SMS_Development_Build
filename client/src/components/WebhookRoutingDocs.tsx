import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Info, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function WebhookRoutingDocs() {
  const { t } = useLanguage();

  const extremeSmsPayload = `{
  "from": "+12345678901",
  "firstname": "John",
  "lastname": "Doe",
  "business": "ABC Company",
  "message": "Reply message text",
  "status": "received",
  "matchedBlockWord": "null",
  "receiver": "+19876543210",
  "usedmodem": "modem_id",
  "port": "port_number",
  "timestamp": "2025-11-19T10:30:00.000Z",
  "messageId": "unique_msg_id"
}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">{t('webhookDocs.title')}</h2>
        <p className="text-muted-foreground">
          {t('webhookDocs.subtitle')}
        </p>
      </div>

      {/* How ExtremeSMS Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('webhookDocs.extremeSms.title')}</CardTitle>
          <CardDescription>{t('webhookDocs.extremeSms.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">{t('webhookDocs.extremeSms.setupTitle')}</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>{t('webhookDocs.extremeSms.step1')}</li>
              <li>{t('webhookDocs.extremeSms.step2')}</li>
              <li>{t('webhookDocs.extremeSms.step3')}</li>
              <li>{t('webhookDocs.extremeSms.step4')}</li>
              <li>{t('webhookDocs.extremeSms.step5')}</li>
              <li>{t('webhookDocs.extremeSms.step6')}</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold mb-2">{t('webhookDocs.extremeSms.payloadTitle')}</h4>
            <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
              {extremeSmsPayload}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* How Ibiki Works */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {t('webhookDocs.ibiki.title')}
          </CardTitle>
          <CardDescription>{t('webhookDocs.ibiki.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-3">{t('webhookDocs.ibiki.howItWorks')}</h4>
            <div className="space-y-3">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{t('webhookDocs.ibiki.automaticTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('webhookDocs.ibiki.automaticDesc')}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{t('webhookDocs.ibiki.multipleTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('webhookDocs.ibiki.multipleDesc')}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{t('webhookDocs.ibiki.dashboardTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('webhookDocs.ibiki.dashboardDesc')}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3">{t('webhookDocs.ibiki.routingTitle')}</h4>
            <div className="bg-muted/50 p-4 rounded-lg space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="font-bold text-primary">1.</span>
                <p>{t('webhookDocs.ibiki.routing1')}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-primary">2.</span>
                <p>{t('webhookDocs.ibiki.routing2')}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-primary">3.</span>
                <p>{t('webhookDocs.ibiki.routing3')}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-primary">4.</span>
                <p>{t('webhookDocs.ibiki.routing4')}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-primary">5.</span>
                <p>{t('webhookDocs.ibiki.routing5')}</p>
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>{t('webhookDocs.ibiki.importantTitle')}</strong> {t('webhookDocs.ibiki.importantDesc')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold">{t('webhookDocs.webhook.configTitle')}</p>
            <code className="block bg-muted p-3 rounded text-sm font-mono">
              http://151.243.109.79/webhook/incoming-sms
            </code>
            <p className="text-xs text-muted-foreground">
              {t('webhookDocs.webhook.configDesc')}
            </p>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
