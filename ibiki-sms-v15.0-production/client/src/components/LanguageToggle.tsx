import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2 bg-muted rounded-md p-1">
      <Button
        variant={language === 'en' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('en')}
        className="h-8 px-3 gap-2"
        data-testid="button-language-en"
      >
        <span className="text-base">🇺🇸</span>
        <span className="text-xs font-medium">EN</span>
      </Button>
      <Button
        variant={language === 'zh' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('zh')}
        className="h-8 px-3 gap-2"
        data-testid="button-language-zh"
      >
        <span className="text-base">🇨🇳</span>
        <span className="text-xs font-medium">中文</span>
      </Button>
    </div>
  );
}
