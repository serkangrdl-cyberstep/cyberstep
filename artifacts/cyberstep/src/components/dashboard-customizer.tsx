import { Settings2, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { WIDGET_REGISTRY } from "@/hooks/use-dashboard-prefs";

interface Props {
  visibility: Record<string, boolean>;
  toggle: (id: string) => void;
  reset: () => void;
}

export function DashboardCustomizer({ visibility, toggle, reset }: Props) {
  const activeCount = WIDGET_REGISTRY.filter(w => visibility[w.id]).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-800 gap-1.5 shrink-0"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Ozelleştir
          <span className="text-[10px] bg-slate-700 text-slate-400 rounded-full px-1.5 py-0.5 font-mono">
            {activeCount}/{WIDGET_REGISTRY.length}
          </span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="bg-slate-900 border-slate-700 w-[320px] flex flex-col p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-slate-800">
          <SheetTitle className="text-white flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" />
            Dashboard Ozelleştir
          </SheetTitle>
          <p className="text-slate-400 text-xs leading-relaxed">
            Görmek istediğiniz bileşenleri açıp kapatın. Tercihleriniz tarayıcıda saklanır.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Varsayılan Açık
            </p>
            {WIDGET_REGISTRY.filter(w => w.defaultVisible).map(w => (
              <WidgetRow
                key={w.id}
                widget={w}
                checked={visibility[w.id] ?? w.defaultVisible}
                onToggle={() => toggle(w.id)}
              />
            ))}
          </div>

          <Separator className="bg-slate-800 my-3" />

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Eklenebilir Bileşenler
            </p>
            {WIDGET_REGISTRY.filter(w => !w.defaultVisible).map(w => (
              <WidgetRow
                key={w.id}
                widget={w}
                checked={visibility[w.id] ?? w.defaultVisible}
                onToggle={() => toggle(w.id)}
              />
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-slate-400 hover:text-white hover:bg-slate-800 gap-2"
            onClick={reset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Varsayılana Sıfırla
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WidgetRow({
  widget,
  checked,
  onToggle,
}: {
  widget: { id: string; label: string; description: string };
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className={`mt-0.5 shrink-0 ${checked ? "text-primary" : "text-slate-600"}`}>
          {checked ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-tight ${checked ? "text-white" : "text-slate-500"}`}>
            {widget.label}
          </p>
          <p className="text-xs text-slate-600 mt-0.5 leading-snug">{widget.description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onToggle}
        className="shrink-0 mt-0.5"
      />
    </div>
  );
}
