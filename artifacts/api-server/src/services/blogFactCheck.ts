/** TPRM blog yazıları için otomatik ikinci kontrol: istem oluşturma ve çıktıyı ayrıştırma (saf fonksiyonlar). */

const SEP_CHANGES = "===DEGISIKLIKLER===";
const SEP_CONTENT = "===ICERIK===";

export function buildFactCheckPrompt(content: string, facts: string, rules: string): string {
  return `Sen titiz bir editör ve olgu denetçisisin. Aşağıdaki Türkçe blog yazısını (HTML) DOĞRULANMIŞ OLGULAR ve KESİN KURALLAR ile karşılaştır.

DOĞRULANMIŞ OLGULAR:
${facts}

KESİN KURALLAR:
${rules}

GÖREV:
- Olgularla çelişen, olgularda bulunmayan (uydurma vaka, rakam, ceza, alıntı), kesin kuralları ihlal eden veya abartılı/genelleyici cümleleri bul.
- Yalnızca bu cümleleri en az değişiklikle düzelt (olgu listesine uydur, gerekirse cümleyi çıkar). Diğer her şeyi, HTML yapısı dahil, AYNEN koru. Yazıyı yeniden yazma, kısaltma, süsleme.
- Sorun yoksa içeriği değiştirmeden döndür.

ÇIKTI FORMATI (başka hiçbir şey yazma):
${SEP_CHANGES}
- yapılan her değişiklik için bir satır (değişiklik yoksa "yok")
${SEP_CONTENT}
<düzeltilmiş tam HTML>

YAZI:
${content}`;
}

export function parseFactCheckOutput(raw: string, original: string): { content: string; changes: string[] } | null {
  const i = raw.indexOf(SEP_CHANGES);
  const j = raw.indexOf(SEP_CONTENT);
  if (i === -1 || j === -1 || j < i) return null;
  const changes = raw.slice(i + SEP_CHANGES.length, j)
    .split("\n").map(l => l.replace(/^[-•\s]+/, "").trim()).filter(l => l && l.toLowerCase() !== "yok");
  const content = raw.slice(j + SEP_CONTENT.length).trim();
  // Güvenlik: HTML değilse veya özgün içeriğe göre çok kısaldıysa kullanma
  if (!/^<[a-z]/i.test(content)) return null;
  if (content.length < original.length * 0.7) return null;
  if (!/<h2\b/i.test(content) && /<h2\b/i.test(original)) return null;
  return { content, changes };
}
