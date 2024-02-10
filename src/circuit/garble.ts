import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "crypto";
import { gates, InputValue, GateName, Gate } from "./gates";
import { cartesianProduct, secureShuffle } from "../utils";

type Labels = { [key: string]: string[] };
type LabelledTable = (string | string[])[][];
type EncryptedRow = { encrypted: Buffer; iv: Buffer; tag: Buffer };
type GarbledTable = EncryptedRow[];

const INPUT_VALUES: InputValue[] = [0, 1];

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

  const inputLabels = inNames.map(() => [
    randomBytes(size / 8).toString("hex"),
    randomBytes(size / 8).toString("hex"),
  ]);

  const outputLabels = [
    randomBytes(size / 8).toString("hex"),
    randomBytes(size / 8).toString("hex"),
  ];

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

function getCombinedKey(labels: string[]): string {
  const hash = createHash("SHA3-256");
  for (const label of labels) {
    hash.update(label);
  }
  return hash.digest("hex");
}

function encrypt(key: string, data: string): EncryptedRow {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const encrypted = cipher.update(data, "utf8");
  return {
    encrypted: Buffer.concat([encrypted, cipher.final()]),
    iv,
    tag: cipher.getAuthTag(),
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
    const key = getCombinedKey(inputLabels);
    const result = encrypt(key, outputLabel);
    garbledTable.push(result);
  }

  secureShuffle(garbledTable);

  return garbledTable;
}

export function evalGarbledTable(garbledTable: GarbledTable, inputs: string[]) {
  for (const row of garbledTable) {
    const { encrypted, iv, tag } = row;
    try {
      const key = getCombinedKey(inputs);
      return decrypt(key, iv, tag, encrypted);
    } catch (e) {
      continue;
    }
  }
}
