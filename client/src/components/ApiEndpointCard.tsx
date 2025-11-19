import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import CodeBlock from "./CodeBlock";
import { useLanguage } from "@/contexts/LanguageContext";

interface ApiEndpointCardProps {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  title: string;
  description: string;
  requestExample?: string;
  responseExample?: string;
}

export default function ApiEndpointCard({
  method,
  path,
  title,
  description,
  requestExample,
  responseExample
}: ApiEndpointCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  const methodColors = {
    GET: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    POST: "bg-green-500/10 text-green-600 dark:text-green-400",
    PUT: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    DELETE: "bg-red-500/10 text-red-600 dark:text-red-400"
  };

  return (
    <Card data-testid={`card-endpoint-${method.toLowerCase()}-${path.replace(/\//g, '-')}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full" data-testid={`button-toggle-${method.toLowerCase()}-${path.replace(/\//g, '-')}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div className="flex items-center gap-3 flex-1">
              <Badge className={methodColors[method]} data-testid={`badge-method-${method.toLowerCase()}`}>
                {method}
              </Badge>
              <code className="font-mono text-sm flex-1 text-left">{path}</code>
            </div>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </CardHeader>
        </CollapsibleTrigger>
        <CardContent className="pt-0">
          <CardTitle className="text-lg mb-2">{title}</CardTitle>
          <CardDescription className="mb-4">{description}</CardDescription>
          
          <CollapsibleContent>
            {requestExample && (
              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium">{t('api.requestExample')}</p>
                <CodeBlock code={requestExample} />
              </div>
            )}
            
            {responseExample && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('api.responseExample')}</p>
                <CodeBlock code={responseExample} language="json" />
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
