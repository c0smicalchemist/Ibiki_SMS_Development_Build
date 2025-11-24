import { Switch, Route, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { apiRequest } from "./lib/queryClient";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Signup from "@/pages/Signup";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ClientDashboard from "@/pages/ClientDashboard";
import ApiDocs from "@/pages/ApiDocs";
import AdminDashboard from "@/pages/AdminDashboard";
import Contacts from "@/pages/Contacts";
import SendSMS from "@/pages/SendSMS";
import Inbox from "@/pages/Inbox";
import MessageHistory from "@/pages/MessageHistory";

function ProtectedAdmin() {
  const [location, setLocation] = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLocation('/login');
      setAllowed(false);
      return;
    }
    (async () => {
      try {
        const me = await apiRequest('/api/auth/me');
        if (me?.user?.role === 'admin') {
          setAllowed(true);
        } else {
          setLocation('/login');
          setAllowed(false);
        }
      } catch {
        setLocation('/login');
        setAllowed(false);
      }
    })();
  }, [setLocation]);

  if (allowed === null) return null;
  return <AdminDashboard />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={ClientDashboard} />
      <Route path="/docs" component={ApiDocs} />
      <Route path="/admin" component={ProtectedAdmin} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/send-sms" component={SendSMS} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/message-history" component={MessageHistory} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
