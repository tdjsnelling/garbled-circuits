import {
  getCombinedKey,
  decrypt,
  GarbledTable,
  Circuit,
  NamedLabel,
} from "./garble";

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
