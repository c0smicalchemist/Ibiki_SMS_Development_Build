import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Activity, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import CodeBlock from "@/components/CodeBlock";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import logoUrl from "@assets/Yubin_Dash_NOBG_1763476645991.png";

export default function Landing() {
  const { t } = useLanguage();
  const [animatedCode, setAnimatedCode] = useState("");

  const features = [
    {
      icon: Shield,
      title: t('landing.features.secure'),
      description: t('landing.features.secureDesc')
    },
    {
      icon: Users,
      title: t('landing.features.flexible'),
      description: t('landing.features.flexibleDesc')
    },
    {
      icon: Activity,
      title: t('landing.features.complete'),
      description: t('landing.features.completeDesc')
    }
  ];

  const sampleCode = `curl -X POST https://api.ibikisms.com/v2/sms/sendsingle \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"recipient": "+1234567890", "message": "Hello!"}'`;

  useEffect(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+{}[]<>?";
    let i = 0;
    const steps = 15;
    const interval = setInterval(() => {
      const pct = Math.min(1, i / steps);
      const keep = Math.floor(sampleCode.length * pct);
      const scrambleLen = sampleCode.length - keep;
      let s = sampleCode.slice(0, keep);
      for (let j = 0; j < scrambleLen; j++) {
        s += chars[Math.floor(Math.random() * chars.length)];
      }
      setAnimatedCode(s);
      i++;
      if (pct >= 1) {
        clearInterval(interval);
        setAnimatedCode(sampleCode);
      }
    }, 60);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Ibiki SMS" className="h-12 w-auto" />
              <span className="text-xl font-bold"><span className="text-primary">I</span>biki SMS Aggregator</span>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <Link href="/login">
                <Button variant="ghost" data-testid="button-login">{t('landing.login')}</Button>
              </Link>
              <Link href="/signup">
                <Button data-testid="button-get-started">{t('landing.cta')}</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-primary">I</span>biki SMS Aggregator
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('landing.subtitle')}
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" data-testid="button-hero-signup">
                {t('landing.cta')}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline" data-testid="button-view-docs">
                {t('nav.docs')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 bg-card/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} data-testid={`card-feature-${index}`}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold mb-3">Simple Integration</h2>
            <p className="text-muted-foreground">Get started with just a few lines of code</p>
          </div>
          <div className="max-w-3xl mx-auto">
            <CodeBlock code={animatedCode || sampleCode} />
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12 mt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2025 Ibiki SMS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
