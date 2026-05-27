import { createContext, useContext, useState, useEffect } from "react";

export type Language = "tr" | "en";

interface LanguageContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "tr",
  setLang: () => {},
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem("cs-lang");
      if (stored === "en" || stored === "tr") return stored;
    } catch {}
    return "tr";
  });

  const setLang = (l: Language) => {
    setLangState(l);
    try { localStorage.setItem("cs-lang", l); } catch {}
  };

  const toggle = () => setLang(lang === "tr" ? "en" : "tr");

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
