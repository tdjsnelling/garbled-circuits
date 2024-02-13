import {
  getCombinedKey,
  decrypt,
  GarbledTable,
  Circuit,
  NamedLabel,
  Labels,
} from "./garble";
import { InputValue } from "./gates";

export type NamedInputOutput = { [key: string]: InputValue };

function evalGarbledTable(
  garbledTable: GarbledTable,
  humanInputs: NamedLabel,
  inputNames: string[],
  circuitOutputs: NamedLabel,
): string {
  const filteredHumanInputs = inputNames.reduce((inputs: NamedLabel, name) => {
    if (humanInputs[name]) inputs[name] = humanInputs[name];
    return inputs;
  }, {});

  const missingInputs = inputNames.filter(
    (name) => !Object.keys(filteredHumanInputs).includes(name),
  );

  const circuitOutputLabels = missingInputs.reduce(
    (outputs: NamedLabel, name) => {
      if (circuitOutputs[name]) outputs[name] = circuitOutputs[name];
      return outputs;
    },
    {},
  );

  const inputs = { ...filteredHumanInputs, ...circuitOutputLabels };

  console.log(`\t-> inputs:${JSON.stringify(inputs)}`);

  const { key, label0lsb, label1lsb } = getCombinedKey(Object.values(inputs));

  const row = garbledTable.find(
    (r) => r.label0lsb === label0lsb && r.label1lsb === label1lsb,
  );

  if (!row) throw new Error("Valid row not found in garbled table");

  const { encrypted, iv, tag } = row;
  return decrypt(key, iv, tag, encrypted);
}

export function evalGarbledCircuit(
  garbledCircuit: GarbledTable[],
  inputs: NamedLabel,
  circuit: Circuit,
): NamedLabel {
  const circuitOutputs: NamedLabel = {};

  for (const i in garbledCircuit) {
    console.log(`evaluate -> gate:${i}`);

    const inputNames = circuit[i].inputs;
    const outputName = circuit[i].output;

    const garbledTable = garbledCircuit[i];
    const result = evalGarbledTable(
      garbledTable,
      inputs,
      inputNames,
      circuitOutputs,
    );

    console.log(`\t-> result:${result}`);

    circuitOutputs[outputName] = result;
  }

  return circuitOutputs;
}

export function resolveOutputLabels(
  outputLabels: NamedLabel,
  outputNames: string[],
  labelledCircuit: Labels,
): NamedInputOutput {
  const outputs: NamedInputOutput = {};

  for (const outputName of outputNames) {
    const outputLabel = outputLabels[outputName];
    outputs[outputName] = labelledCircuit[outputName].indexOf(
      outputLabel,
    ) as InputValue;
  }

  return outputs;
}
