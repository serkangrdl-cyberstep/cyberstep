import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/language-context";

interface SpecialMessage {
  id: number;
  title: string;
  messageTr: string;
  messageEn: string | null;
  imageBase64: string | null;
  bgColor: string;
  textColor: string;
  startAt: string;
  endAt: string;
}

export function SpecialDayBanner() {
  const { lang } = useLanguage();
  const [dismissed, setDismissed] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem("dismissed_special_msg");
      return v ? parseInt(v, 10) : null;
    } catch { return null; }
  });

  const { data: message } = useQuery<SpecialMessage | null>({
    queryKey: ["special-message-active"],
    queryFn: () => fetch("/api/public/special-messages/active").then(r => r.json()),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (!message || dismissed === message.id) return null;

  const text = lang === "en" && message.messageEn ? message.messageEn : message.messageTr;

  const handleDismiss = () => {
    setDismissed(message.id);
    try { localStorage.setItem("dismissed_special_msg", String(message.id)); } catch {}
  };

  return (
    <div
      role="banner"
      className="w-full relative overflow-hidden"
      style={{ backgroundColor: message.bgColor, color: message.textColor }}
    >
      <div className="container mx-auto px-4 py-4 md:py-5">
        <div className="flex items-center gap-4 max-w-5xl mx-auto">
          {message.imageBase64 && (
            <img
              src={message.imageBase64}
              alt={message.title}
              className="h-14 w-14 md:h-16 md:w-16 object-contain rounded-lg shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p
              className="font-bold text-base md:text-lg leading-tight"
              style={{ color: message.textColor }}
            >
              {message.title}
            </p>
            <p
              className="text-sm md:text-base mt-0.5 opacity-90 leading-snug"
              style={{ color: message.textColor }}
            >
              {text}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Kapat"
            className="shrink-0 p-1.5 rounded-full opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: message.textColor }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      {/* subtle bottom border line */}
      <div className="absolute bottom-0 left-0 right-0 h-px opacity-20" style={{ backgroundColor: message.textColor }} />
    </div>
  );
}
