import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-12 w-12 text-red-400" />
          </div>
        </div>
        <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-3">404</h1>
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Sayfa Bulunamadı
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          Aradığınız sayfa taşınmış, silinmiş veya hiç var olmamış olabilir.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Ana Sayfaya Dön
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri Git
          </Button>
        </div>
        <p className="mt-8 text-xs text-slate-400">
          Sorun devam ederse{" "}
          <a href="mailto:info@cyberstep.io" className="text-emerald-500 hover:underline">
            info@cyberstep.io
          </a>{" "}
          adresine yazabilirsiniz.
        </p>
      </div>
    </div>
  );
}
