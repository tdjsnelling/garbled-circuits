import { generateKeyPairSync } from "crypto";
import * as ot from "./oblivious-transfer";
import { getJwkInt } from "./utils";
import {
  labelWires,
  garbleTable,
  evalGarbledTable,
  Labels,
} from "./circuit/garble";
import { GateName, InputValue } from "./circuit/gates";

type Inputs = { [key: string]: InputValue }[];

// in practice this would be multiple steps as only Alice knows allLabels and
// only Bob knows his input
function doObliviousTransfer(
  allLabels: Labels[], // Alice
  gateIndex: number, // Bob
  inputName: string, // Bob
  inputValue: InputValue, // Bob
) {
  console.log(`OT gate ${gateIndex} : ${inputName}=${inputValue}`);
  // ALICE
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const pubkey = publicKey.export({ format: "jwk" });
  const privkey = privateKey.export({ format: "jwk" });

  const m0 = Buffer.from(allLabels[gateIndex][inputName][0], "utf-8");
  const m1 = Buffer.from(allLabels[gateIndex][inputName][1], "utf-8");

  const e = getJwkInt(pubkey.e as string);
  const N = getJwkInt(pubkey.n as string);
  const d = getJwkInt(privkey.d as string);

  const { x0, x1 } = ot.otSend1();

  // BOB
  const { v, k } = ot.otRecv1(inputValue, e, N, x0, x1);

  // ALICE
  const { m0k, m1k } = ot.otSend2(d, N, x0, x1, v, m0, m1);

  // BOB
  const m = ot.otRecv2(inputValue, N, k, m0k, m1k);
  return m.toString("utf-8");
}

type Circuit = { gate: GateName; inputs: string[]; output: string }[];

// Alice has A, Bob has B
const circuit: Circuit = [{ gate: "and", inputs: ["A", "B"], output: "out" }];

const allLabels: Labels[] = [];
const garbledCircuit = []; // -> Alice will send to Bob

// ALICE
for (const gate of circuit) {
  const { labels, labelledTable } = labelWires(
    gate.gate,
    gate.inputs,
    gate.output,
  );
  allLabels.push(labels);
  garbledCircuit.push(garbleTable(labelledTable));
}

const aliceInputs: Inputs = [{ A: 1 }];
const aliceInputLabels = aliceInputs.map((values, i) =>
  values !== undefined
    ? Object.entries(values).map(([name, input]) => allLabels[i][name][input])
    : undefined,
);

// BOB
const bobInputs: Inputs = [{ B: 1 }];
const bobInputLabels = bobInputs.map((values, i) =>
  values !== undefined
    ? Object.entries(values).map(([name, input]) =>
        doObliviousTransfer(allLabels, i, name, input),
      )
    : undefined,
);

const results = [];

// garbledCircuit and aliceInputLabels received from Alice
// bobInputLabels received from Alice via oblivious transfer
for (const i in garbledCircuit) {
  const index = Number(i);
  const garbledTable = garbledCircuit[index];

  // map input names to work out who has which input?
  let inputs: string[] = [];
  if (Array.isArray(aliceInputLabels[i]))
    inputs = aliceInputLabels[i] as string[];
  if (Array.isArray(bobInputLabels[i]))
    inputs = inputs.concat(bobInputLabels[i] as string[]);

  results.push(evalGarbledTable(garbledTable, inputs)); // -> send to Alice
}

// ALICE
const out = allLabels[allLabels.length - 1]["out"].indexOf(
  results[results.length - 1],
);
console.log("=>", out); // -> Alice shares with Bob
