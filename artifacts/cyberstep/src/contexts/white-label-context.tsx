import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

export interface WhiteLabelPartner {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  contactEmail: string | null;
  description: string | null;
  isActive: boolean;
}

const WhiteLabelContext = createContext<WhiteLabelPartner | null>(null);

export function WhiteLabelProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { data } = useQuery<WhiteLabelPartner | null>({
    queryKey: ["whitelabel", slug],
    queryFn: () =>
      fetch(`/api/public/whitelabel/${slug}`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <WhiteLabelContext.Provider value={data ?? null}>
      {children}
    </WhiteLabelContext.Provider>
  );
}

export function useWhiteLabel() {
  return useContext(WhiteLabelContext);
}
