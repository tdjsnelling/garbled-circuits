import { generateKeyPairSync } from "crypto";
import fs from "fs";
import * as ot from "./oblivious-transfer";
import { getJwkInt } from "./utils";
import { InputValue } from "./circuit/gates";
import { garbleCircuit, Labels, NamedLabel } from "./circuit/garble";
import { evalGarbledCircuit } from "./circuit/evaluate";
import { parseVerilog } from "./verilog";

type Inputs = { [key: string]: InputValue };

// In practice this would be multiple steps as only Alice knows allLabels and
// only Bob knows his input
function doObliviousTransfer(
  flattenedLabels: Labels, // Alice
  inputName: string, // Bob
  inputValue: InputValue, // Bob
) {
  console.log(`oblivious transfer -> value:${inputName}=${inputValue}`);

  // ALICE
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const pubkey = publicKey.export({ format: "jwk" });
  const privkey = privateKey.export({ format: "jwk" });

  const m0 = Buffer.from(flattenedLabels[inputName][0], "utf-8");
  const m1 = Buffer.from(flattenedLabels[inputName][1], "utf-8");

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

// Both parties are aware of circuit configuration
const verilog = fs.readFileSync("./verilog/out.v", "utf-8");
const circuit = parseVerilog(verilog);
const outputNames = ["sum_0", "sum_1", "sum_2", "sum_3", "C_out"];

// ALICE
const {
  labelledCircuit,
  garbledCircuit, // -> Alice will send to Bob
} = garbleCircuit(circuit);

const aliceInputs: Inputs = { A_0: 1, A_1: 0, A_2: 0, A_3: 0, C_in: 0 };
const aliceInputLabels = Object.entries(aliceInputs).reduce(
  (inputs: NamedLabel, [name, value]) => {
    inputs[name] = labelledCircuit[name][value];
    return inputs;
  },
  {},
);

console.log(`alice inputs -> ${JSON.stringify(aliceInputs)}`);
console.log(`alice input labels -> ${JSON.stringify(aliceInputLabels)}`);

// BOB
const bobInputs: Inputs = { B_0: 1, B_1: 0, B_2: 0, B_3: 0 };
const bobInputLabels = Object.entries(bobInputs).reduce(
  (inputs: NamedLabel, [name, value]) => {
    inputs[name] = doObliviousTransfer(labelledCircuit, name, value);
    return inputs;
  },
  {},
);

console.log(`bob inputs -> ${JSON.stringify(bobInputs)}`);
console.log(`bob input labels -> ${JSON.stringify(bobInputLabels)}`);

// garbledCircuit and aliceInputLabels received from Alice
// bobInputLabels received from Alice via oblivious transfer
const inputs = { ...aliceInputLabels, ...bobInputLabels };
const outputs = evalGarbledCircuit(garbledCircuit, inputs, circuit); // -> Bob will send to Alice

console.log("-> output", JSON.stringify(outputs));

// ALICE
for (const outputName of outputNames) {
  const outputLabel = outputs[outputName];
  const outputValue = labelledCircuit[outputName].indexOf(outputLabel);
  console.log(`=> ${outputName}=${outputValue}`); // -> Alice shares with Bob
}
