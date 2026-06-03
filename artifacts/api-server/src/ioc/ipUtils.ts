export function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  if (!range || !bitsStr) return false;
  const bits = parseInt(bitsStr, 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~(0) << (32 - bits)) >>> 0;

  const toNum = (s: string) =>
    s.split(".").reduce((acc, oct) => ((acc << 8) + parseInt(oct, 10)) >>> 0, 0);

  return (toNum(ip) & mask) === (toNum(range) & mask);
}

export function isValidIP(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

export function isValidCIDR(value: string): boolean {
  if (!value.includes("/")) return isValidIP(value);
  const [ip, bitsStr] = value.split("/");
  const bits = parseInt(bitsStr, 10);
  return !!ip && isValidIP(ip) && !isNaN(bits) && bits >= 0 && bits <= 32;
}
