import StatCard from '../StatCard';
import { MessageSquare } from 'lucide-react';

export default function StatCardExample() {
  return (
    <div className="p-6 max-w-sm">
      <StatCard 
        title="Total Messages" 
        value="12,584" 
        icon={MessageSquare}
        description="Last 30 days"
      />
    </div>
  );
}
