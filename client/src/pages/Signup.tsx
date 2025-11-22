import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ApiKeyDialog } from "@/components/ApiKeyDialog";
import logoUrl from "@assets/Yubin_Dash_NOBG_1763476645991.png";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const signupMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; confirmPassword: string }) => {
      return await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      setApiKey(data.apiKey);
      setShowApiKey(true);
    },
    onError: (error: any) => {
      toast({
        title: "Signup failed",
        description: error.message || t('auth.signup.error'),
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }
    signupMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <img src={logoUrl} alt="Yubin Dash" className="h-12 w-auto cursor-pointer" />
          </Link>
          <LanguageToggle />
        </div>

        <Card data-testid="card-signup">
          <CardHeader>
            <CardTitle>{t('auth.signup.title')}</CardTitle>
            <CardDescription>{t('auth.signup.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.signup.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="input-email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.signup.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  data-testid="input-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.signup.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  data-testid="input-confirm-password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={signupMutation.isPending} data-testid="button-signup">
                {signupMutation.isPending ? t('common.loading') : t('auth.signup.submit')}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">{t('auth.signup.hasAccount')} </span>
              <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
                {t('auth.signup.loginLink')}
              </Link>
            </div>
          </CardContent>
        </Card>

        <ApiKeyDialog
          open={showApiKey}
          onOpenChange={(open) => {
            setShowApiKey(open);
            if (!open) setLocation('/dashboard');
          }}
          apiKey={apiKey}
          title="Account Created!"
        />
      </div>
    </div>
  );
}
