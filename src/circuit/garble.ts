import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "crypto";
import { gates, InputValue, GateName, Gate } from "./gates";
import { cartesianProduct, secureShuffle } from "../utils";

type Bit = InputValue;
export type Labels = { [key: string]: string[] };
type LabelledTable = (string | string[])[][];
type EncryptedRow = {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
  label0lsb: Bit;
  label1lsb: Bit;
};
type GarbledTable = EncryptedRow[];
export type Circuit = { gate: GateName; inputs: string[]; output: string }[];
export type NamedLabel = { [key: string]: string };

const INPUT_VALUES: InputValue[] = [0, 1];

function getLeastSignificantBit(buffer: Buffer, index = 0): Bit {
  const lastByte = buffer[buffer.byteLength - 1];
  return ((lastByte >> index) & 1) as Bit;
}

// generate 2 random labels with different LSBs
function generateLabelPair(size: number): string[] {
  const l0 = randomBytes(size / 8);
  const l1 = randomBytes(size / 8);

  const lsb0 = getLeastSignificantBit(l0);
  const lsb1 = getLeastSignificantBit(l1);

  if (lsb0 === lsb1) {
    let lastByte = l1[l1.byteLength - 1];
    lastByte = lastByte ^= 1;
    l1[l1.byteLength - 1] = lastByte;
  }

  return [l0.toString("hex"), l1.toString("hex")];
}

function labelWires(
  gateName: GateName,
  inNames: string[],
  outName: string,
  gateIndex: number,
  labelledCircuit: Labels[],
  size: number = 256,
): { labels: Labels; labelledTable: LabelledTable } {
  console.log(
    `garble -> gate:${gateIndex} type:${gateName} in:${inNames} out:${outName}`,
  );

  const inputValues: InputValue[][] | InputValue[] = cartesianProduct(
    ...Array(inNames.length).fill(INPUT_VALUES),
  );

  const gate = gates[gateName] as Gate;

  const truthTable = inputValues.reduce((table: InputValue[], input) => {
    if (gate.length === 2) {
      const binaryInput = input as InputValue[];
      table.push(gate[binaryInput[0]][binaryInput[1]]);
    } else if (gate.length === 1) {
      const unaryInput = input as InputValue;
      table.push(gate[0][unaryInput]);
    }

    return table;
  }, []);

  const prevGates = labelledCircuit.slice(0, gateIndex);

  const inputLabels = inNames.map((name) => {
    const prevOutputGate = prevGates.find((labels) => !!labels[name]);
    if (prevOutputGate) return prevOutputGate[name];
    return generateLabelPair(size);
  });
  const labels = inNames.reduce((labelsObj: Labels, name, i) => {
    labelsObj[name] = inputLabels[i];
    return labelsObj;
  }, {});

  const outputLabels = generateLabelPair(size);
  labels[outName] = outputLabels;

  for (const [name, values] of Object.entries(labels)) {
    for (const value in values) {
      console.log(`label -> name:${name} label:${value}=${values[value]}`);
    }
  }

  const labelledTable = truthTable.map((outValue, i) => {
    const result = [];

    if (gate.length === 2) {
      const binaryInputValues = inputValues as InputValue[][];
      result.push(
        binaryInputValues[i].map((inValue, j) => inputLabels[j][inValue]),
      );
    } else if (gate.length === 1) {
      const unaryInputValues = inputValues as InputValue[];
      result.push(inputLabels[0][unaryInputValues[i]]);
    }

    result.push(outputLabels[outValue]);

    return result;
  });

  return { labels, labelledTable };
}

function getCombinedKey(labels: string[]): {
  key: string;
  label0lsb: Bit;
  label1lsb: Bit;
} {
  const hash = createHash("SHA3-256");
  for (const label of labels) {
    hash.update(label);
  }

  const label0lsb = getLeastSignificantBit(Buffer.from(labels[0], "hex"));
  const label1lsb = getLeastSignificantBit(Buffer.from(labels[1], "hex"));

  return { key: hash.digest("hex"), label0lsb, label1lsb };
}

function encrypt(
  key: string,
  data: string,
  label0lsb: Bit,
  label1lsb: Bit,
): EncryptedRow {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  let encrypted = cipher.update(data, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return {
    encrypted,
    iv,
    tag: cipher.getAuthTag(),
    label0lsb,
    label1lsb,
  };
}

function decrypt(
  key: string,
  iv: Buffer,
  tag: Buffer,
  encrypted: Buffer,
): string {
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  decipher.setAuthTag(tag);
  let data = decipher.update(encrypted, undefined, "utf8");
  data += decipher.final("utf8");
  return data;
}

function garbleTable(labelledTable: LabelledTable): GarbledTable {
  const garbledTable: GarbledTable = [];

  for (const row of labelledTable) {
    const [inputLabels, outputLabel] = row as [string[], string];
    const { key, label0lsb, label1lsb } = getCombinedKey(inputLabels);
    const result = encrypt(key, outputLabel, label0lsb, label1lsb);
    garbledTable.push(result);
  }

  secureShuffle(garbledTable);

  return garbledTable;
}

function evalGarbledTable(
  garbledTable: GarbledTable,
  humanInputs: NamedLabel,
  inputNames: string[],
  circuitOutputs: NamedLabel[],
): string {
  const missingInputs = inputNames.filter(
    (name) => !Object.keys(humanInputs).includes(name),
  );

  const circuitOutputLabels = missingInputs.reduce(
    (outputs: NamedLabel, name) => {
      const outputLabel = circuitOutputs.find((output) => !!output[name]);
      if (outputLabel) outputs[name] = outputLabel[name];
      return outputs;
    },
    {},
  );

  const inputs = { ...humanInputs, ...circuitOutputLabels };

  console.log(`\t-> inputs:${JSON.stringify(inputs)}`);

  const { key, label0lsb, label1lsb } = getCombinedKey(Object.values(inputs));

  const row = garbledTable.find(
    (r) => r.label0lsb === label0lsb && r.label1lsb === label1lsb,
  );

  if (!row) throw new Error("Valid row not found in garbled table");

  const { encrypted, iv, tag } = row;
  return decrypt(key, iv, tag, encrypted);
}

export function garbleCircuit(circuit: Circuit) {
  const labelledCircuit: Labels[] = [];
  const garbledCircuit = [];

  for (const gateIndex in circuit) {
    const gate = circuit[gateIndex];
    const { labels, labelledTable } = labelWires(
      gate.gate,
      gate.inputs,
      gate.output,
      Number(gateIndex),
      labelledCircuit,
    );

    labelledCircuit.push(labels);
    garbledCircuit.push(garbleTable(labelledTable));
  }

  return { labelledCircuit, garbledCircuit };
}

export function evalGarbledCircuit(
  garbledCircuit: GarbledTable[],
  inputs: NamedLabel[],
  circuit: Circuit,
) {
  const circuitOutputs: NamedLabel[] = [];

  for (const i in garbledCircuit) {
    console.log(`evaluate -> gate:${i}`);

    const inputNames = circuit[i].inputs;
    const outputName = circuit[i].output;

    const garbledTable = garbledCircuit[i];
    const result = evalGarbledTable(
      garbledTable,
      inputs[i],
      inputNames,
      circuitOutputs,
    );

    console.log(`\t-> result:${result}`);

    circuitOutputs.push({ [outputName]: result });
  }

  return circuitOutputs;
}
