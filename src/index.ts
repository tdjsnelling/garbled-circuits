import { generateKeyPairSync } from "crypto";
import * as ot from "./oblivious-transfer";
import { getJwkInt } from "./utils";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const pubkey = publicKey.export({ format: "jwk" });
const privkey = privateKey.export({ format: "jwk" });

const m0 = Buffer.from("Hello", "utf-8");
const m1 = Buffer.from("World", "utf-8");

const e = getJwkInt(pubkey.e as string);
const N = getJwkInt(pubkey.n as string);
const d = getJwkInt(privkey.d as string);

const b = 0;

// Alice send 1
const { x0, x1 } = ot.ot_send_1();

// Bob recv 1
const { v, k } = ot.ot_recv_1(b, e, N, x0, x1);

// Alice send 2
const { m0k, m1k } = ot.ot_send_2(d, N, x0, x1, v, m0, m1);

// Bob recv 2
const m = ot.ot_recv_2(b, N, k, m0k, m1k);
console.log("->", m.toString("utf-8"));
