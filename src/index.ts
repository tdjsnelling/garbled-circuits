import { generateKeyPairSync } from "crypto";
import * as ot from "./oblivious-transfer";
import { getJwkInt } from "./utils";
import { labelWires, garbleTable, evalGarbledTable } from "./circuit/garble";

// ALICE
const { labels, labelledTable } = labelWires("and", ["A", "B"], "out");

const aliceInput = 1;
const aliceInputLabel = labels["A"][aliceInput]; // -> send to Bob

const garbledTable = garbleTable(labelledTable); // -> send to Bob

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const pubkey = publicKey.export({ format: "jwk" });
const privkey = privateKey.export({ format: "jwk" });

const m0 = Buffer.from(labels["B"][0], "utf-8");
const m1 = Buffer.from(labels["B"][1], "utf-8");

const e = getJwkInt(pubkey.e as string);
const N = getJwkInt(pubkey.n as string);
const d = getJwkInt(privkey.d as string);

const { x0, x1 } = ot.otSend1();

// BOB
const bobInput = 1;
const { v, k } = ot.otRecv1(bobInput, e, N, x0, x1);

// ALICE
const { m0k, m1k } = ot.otSend2(d, N, x0, x1, v, m0, m1);

// BOB
const m = ot.otRecv2(bobInput, N, k, m0k, m1k);
const bobInputLabel = m.toString("utf-8");

// garbledTable and aliceInputLabel received from Alice
// bobInputLabel received from Alice via oblivious transfer
const result = evalGarbledTable(garbledTable, [aliceInputLabel, bobInputLabel]); // -> send to Alice

// ALICE
const out = labels["out"].indexOf(result);
console.log(out); // -> Alice shares with Bob
