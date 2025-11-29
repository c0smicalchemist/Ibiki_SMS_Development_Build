import { useEffect, useState } from "react";

export default function SlidingCaptcha({ onSolved }: { onSolved: (token: string) => void }) {
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done && value >= 100) {
      setDone(true);
      onSolved('slider_ok');
    }
  }, [value, done, onSolved]);
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={0} max={100} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-64" />
      <span className={`text-sm ${done ? 'text-green-600' : 'text-muted-foreground'}`}>{done ? 'Verified' : 'Slide to verify'}</span>
    </div>
  );
}
