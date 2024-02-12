import { generateKeyPairSync } from "crypto";
import * as ot from "./oblivious-transfer";
import { getJwkInt } from "./utils";
import {
  garbleCircuit,
  evalGarbledCircuit,
  Labels,
  Circuit,
  NamedLabel,
} from "./circuit/garble";
import { InputValue } from "./circuit/gates";

type Inputs = { [key: string]: InputValue }[];

// In practice this would be multiple steps as only Alice knows allLabels and
// only Bob knows his input
function doObliviousTransfer(
  allLabels: Labels[], // Alice
  gateIndex: number, // Bob
  inputName: string, // Bob
  inputValue: InputValue, // Bob
) {
  console.log(
    `oblivious transfer -> gate:${gateIndex} value:${inputName}=${inputValue}`,
  );
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

// Alice has A and C, Bob has B
// Both parties know the circuit configuration
const circuit: Circuit = [
  { gate: "and", inputs: ["A", "B"], output: "X" },
  { gate: "and", inputs: ["C", "X"], output: "out" },
];

// ALICE
const {
  labelledCircuit,
  garbledCircuit, // -> Alice will send to Bob
} = garbleCircuit(circuit);

const aliceInputs: Inputs = [{ A: 1 }];
const aliceInputLabels = aliceInputs.map((values, i) =>
  values !== undefined
    ? Object.entries(values).reduce((inputs: NamedLabel, [name, value]) => {
        inputs[name] = labelledCircuit[i][name][value];
        return inputs;
      }, {})
    : undefined,
);

console.log(`alice inputs -> ${JSON.stringify(aliceInputs)}`);
console.log(`alice input labels -> ${JSON.stringify(aliceInputLabels)}`);

// BOB
const bobInputs: Inputs = [{ B: 1 }, { C: 1 }];
const bobInputLabels = bobInputs.map((values, i) =>
  values !== undefined
    ? Object.entries(values).reduce((inputs: NamedLabel, [name, input]) => {
        inputs[name] = doObliviousTransfer(labelledCircuit, i, name, input);
        return inputs;
      }, {})
    : undefined,
);

console.log(`bob inputs -> ${JSON.stringify(bobInputs)}`);
console.log(`bob input labels -> ${JSON.stringify(bobInputLabels)}`);

// garbledCircuit and aliceInputLabels received from Alice
// bobInputLabels received from Alice via oblivious transfer
const inputs = garbledCircuit.map((garbledTable, i) => {
  return { ...(aliceInputLabels[i] ?? {}), ...(bobInputLabels[i] ?? {}) };
});
const results = evalGarbledCircuit(garbledCircuit, inputs, circuit); // -> Bob will send to Alice

console.log("-> output", JSON.stringify(results));

// ALICE
const out = labelledCircuit[labelledCircuit.length - 1]["out"].indexOf(
  results[results.length - 1]["out"],
);
console.log(`=> out=${out}`); // -> Alice shares with Bob
