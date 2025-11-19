import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimeZoneConfig {
  name: string;
  nameZh: string;
  timezone: string;
  offset: string;
}

const timeZones: TimeZoneConfig[] = [
  { name: "Chicago", nameZh: "芝加哥", timezone: "America/Chicago", offset: "GMT-6" },
  { name: "Denver", nameZh: "丹佛", timezone: "America/Denver", offset: "GMT-7" },
  { name: "Los Angeles", nameZh: "洛杉矶", timezone: "America/Los_Angeles", offset: "GMT-8" },
  { name: "Anchorage", nameZh: "安克雷奇", timezone: "America/Anchorage", offset: "GMT-9" },
  { name: "Honolulu", nameZh: "檀香山", timezone: "Pacific/Honolulu", offset: "GMT-10" },
];

export function WorldClock() {
  const { language, t } = useLanguage();
  const [times, setTimes] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const updateTimes = () => {
      const newTimes = new Map<string, string>();
      const now = new Date();
      
      timeZones.forEach((tz) => {
        const timeString = now.toLocaleTimeString('en-US', {
          timeZone: tz.timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        newTimes.set(tz.timezone, timeString);
      });
      
      setTimes(newTimes);
    };

    // Update immediately
    updateTimes();
    
    // Update every second
    const interval = setInterval(updateTimes, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          {t('worldClock.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {timeZones.map((tz) => (
            <div
              key={tz.timezone}
              className="flex flex-col items-center p-2 rounded-md border border-border hover-elevate"
              data-testid={`clock-${tz.timezone}`}
            >
              <div className="text-lg font-bold font-mono tabular-nums" data-testid={`time-${tz.timezone}`}>
                {times.get(tz.timezone) || "00:00:00"}
              </div>
              <div className="text-xs text-muted-foreground mt-1 text-center">
                {language === 'zh' ? tz.nameZh : tz.name}
              </div>
              <div className="text-xs text-muted-foreground/60">
                {tz.offset}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
