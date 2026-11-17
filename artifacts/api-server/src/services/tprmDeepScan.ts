/**
 * TPRM derin tarama yardımcıları: alt alan adlarında sahipsiz (dangling) CNAME tespiti.
 * Yöntem: alt alanın CNAME hedefi NXDOMAIN ise (hedef hizmet silinmiş) alt alan devralınabilir (subdomain takeover).
 * Yalnızca kesin NXDOMAIN/ENOTFOUND "sahipsiz" sayılır; zaman aşımı/SERVFAIL ölçülemedi olarak ayrı raporlanır.
 */
import dns from "dns/promises";

export interface DanglingResult { dangling: string[]; checked: number; failed: number }

export async function findDanglingCnames(
  subdomains: string[],
  resolver: Pick<typeof dns, "resolveCname" | "resolve4" | "resolve6"> = dns,
  limit = 40,
): Promise<DanglingResult> {
  const subs = subdomains.slice(0, limit);
  const dangling: string[] = [];
  let failed = 0;
  let checked = 0;
  const queue = [...subs];
  const worker = async () => {
    for (let sub = queue.shift(); sub; sub = queue.shift()) {
      try {
        const cnames = await resolver.resolveCname(sub);
        if (cnames.length === 0) { checked++; continue; }
        const target = cnames[0]!;
        const [a, aaaa] = await Promise.all([
          resolver.resolve4(target).then(() => "ok", (e: NodeJS.ErrnoException) => e.code ?? "ERR"),
          resolver.resolve6(target).then(() => "ok", (e: NodeJS.ErrnoException) => e.code ?? "ERR"),
        ]);
        checked++;
        const gone = (c: string) => c === "ENOTFOUND";
        if (gone(a) && gone(aaaa)) dangling.push(`${sub} → ${target}`);
        else if (a !== "ok" && aaaa !== "ok" && !(a === "ENODATA" || aaaa === "ENODATA" || gone(a) || gone(aaaa))) failed++;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code === "ENODATA" || code === "ENOTFOUND") checked++; // CNAME yok → normal kayıt
        else failed++;
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { dangling, checked, failed };
}
