import { MessageSquare, DollarSign, Activity } from "lucide-react";
import StatCard from "@/components/StatCard";
import ApiKeyDisplay from "@/components/ApiKeyDisplay";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function ClientDashboard() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Monitor your SMS API usage and performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Messages Sent"
          value="12,584"
          icon={MessageSquare}
          description="Last 30 days"
        />
        <StatCard
          title="Available Credits"
          value="$250.00"
          icon={DollarSign}
          description="Current balance • $0.02 per SMS"
        />
        <StatCard
          title="API Status"
          value="Online"
          icon={Activity}
          description="All systems operational"
        />
      </div>

      <ApiKeyDisplay 
        apiKey="ibk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
        title="Your API Credentials"
        description="Use this key to authenticate all API requests to Ibiki SMS"
      />

      <div className="flex gap-3">
        <Link href="/docs">
          <Button data-testid="button-view-docs">View API Documentation</Button>
        </Link>
        <Button variant="outline" data-testid="button-usage-details">View Usage Details</Button>
      </div>
    </div>
  );
}
