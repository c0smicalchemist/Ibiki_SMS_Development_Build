import { Link } from "wouter";
import { LanguageToggle } from "./LanguageToggle";
import logoUrl from "@assets/Yubin_Dash-removebg-preview_1763444826522.png";

export function DashboardHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-center justify-between h-16 px-6">
        <Link href="/">
          <img src={logoUrl} alt="Yubin Dash" className="h-10 w-auto cursor-pointer" />
        </Link>
        <LanguageToggle />
      </div>
    </header>
  );
}
