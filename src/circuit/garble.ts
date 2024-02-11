import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "crypto";
import { gates, InputValue, GateName, Gate } from "./gates";
import { cartesianProduct, secureShuffle } from "../utils";

type Bit = InputValue;
type Labels = { [key: string]: string[] };
type LabelledTable = (string | string[])[][];
type EncryptedRow = {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
  label0lsb: Bit;
  label1lsb: Bit;
};
type GarbledTable = EncryptedRow[];

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

export function labelWires(
  gateName: GateName,
  inNames: string[],
  outName: string,
  size: number = 256,
): { labels: Labels; labelledTable: LabelledTable } {
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

  const inputLabels = inNames.map(() => generateLabelPair(size));

  const outputLabels = generateLabelPair(size);

  const labels = inNames.reduce((labelsObj: Labels, name, i) => {
    labelsObj[name] = inputLabels[i];
    return labelsObj;
  }, {});

  labels[outName] = outputLabels;

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

export function garbleTable(labelledTable: LabelledTable): GarbledTable {
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

export function evalGarbledTable(
  garbledTable: GarbledTable,
  inputs: string[],
): string {
  const { key, label0lsb, label1lsb } = getCombinedKey(inputs);

  const row = garbledTable.find(
    (r) => r.label0lsb === label0lsb && r.label1lsb === label1lsb,
  );

  if (!row) throw new Error("Valid row not found in garbled table");

  const { encrypted, iv, tag } = row;
  return decrypt(key, iv, tag, encrypted);
}
