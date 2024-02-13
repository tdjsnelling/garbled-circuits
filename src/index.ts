import { generateKeyPairSync } from "crypto";
import fs from "fs";
import path from "path";
import * as ot from "./oblivious-transfer";
import { getJwkInt, getNthBit } from "./utils";
import { InputValue } from "./circuit/gates";
import { garbleCircuit, Labels, NamedLabel } from "./circuit/garble";
import {
  evalGarbledCircuit,
  resolveOutputLabels,
  NamedInputOutput,
} from "./circuit/evaluate";
import { parseVerilog } from "./verilog";

// In practice this would be multiple steps as only Alice knows labelledCircuit
// and only Bob knows his input
function doObliviousTransfer(
  labelledCircuit: Labels, // Alice
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

  const m0 = Buffer.from(labelledCircuit[inputName][0], "utf-8");
  const m1 = Buffer.from(labelledCircuit[inputName][1], "utf-8");

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

const [, , verilogFile] = process.argv;

// Both parties are aware of circuit configuration
const verilog = fs.readFileSync(path.resolve(verilogFile), "utf-8");
const { circuit, outputNames } = parseVerilog(verilog);

// ALICE
const {
  labelledCircuit,
  garbledCircuit, // -> Alice will send to Bob
} = garbleCircuit(circuit);

const aliceWealth = 2e6;
const aliceInputs: NamedInputOutput = {};
for (let i = 0; i < 32; i++) {
  aliceInputs[`A_${i}`] = getNthBit(aliceWealth, i);
}

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
const bobWealth = 1e6;
const bobInputs: NamedInputOutput = {};
for (let i = 0; i < 32; i++) {
  bobInputs[`B_${i}`] = getNthBit(bobWealth, i);
}

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
const outputLabels = evalGarbledCircuit(
  garbledCircuit,
  { ...aliceInputLabels, ...bobInputLabels },
  circuit,
); // -> Bob will send to Alice

console.log("output labels ->", JSON.stringify(outputLabels));

// ALICE
const outputs = resolveOutputLabels(outputLabels, outputNames, labelledCircuit);
console.log(`output => ${JSON.stringify(outputs)}`); // -> Alice shares with Bob
