import { test } from "node:test";
import assert from "node:assert/strict";
import { findDanglingCnames } from "./tprmDeepScan";

const err = (code: string) => Object.assign(new Error(code), { code });

test("CNAME hedefi NXDOMAIN ise sahipsiz sayılır; çözülen hedef ve CNAME'siz alt alan sayılmaz", async () => {
  const r = await findDanglingCnames(["old.x.com", "ok.x.com", "plain.x.com", "slow.x.com"], {
    resolveCname: async (h: string) => {
      if (h === "old.x.com") return ["gone.herokuapp.com"];
      if (h === "ok.x.com") return ["live.example.net"];
      if (h === "slow.x.com") throw err("ETIMEOUT");
      throw err("ENODATA");
    },
    resolve4: async (h: string) => { if (h === "gone.herokuapp.com") throw err("ENOTFOUND"); return ["1.2.3.4"]; },
    resolve6: async (h: string) => { if (h === "gone.herokuapp.com") throw err("ENOTFOUND"); throw err("ENODATA"); },
  } as never);
  assert.deepEqual(r.dangling, ["old.x.com → gone.herokuapp.com"]);
  assert.equal(r.failed, 1);
});
