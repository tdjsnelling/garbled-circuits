import { Circuit } from "./circuit/garble";
import { GateName } from "./circuit/gates";

const operationRegex: { [key in GateName]: RegExp } = {
  not: /^~(?<in0>[a-z0-9_]+)$/i,
  and: /^(?<in0>[a-z0-9_]+) & (?<in1>[a-z0-9_]+)$/i,
  or: /^(?<in0>[a-z0-9_]+) \| (?<in1>[a-z0-9_]+)$/i,
  xor: /^(?<in0>[a-z0-9_]+) \^ (?<in1>[a-z0-9_]+)$/i,
  ornot: /^(?<in0>[a-z0-9_]+) \| ~\((?<in1>[a-z0-9_]+)\)$/i,
  andnot: /^(?<in0>[a-z0-9_]+) & ~\((?<in1>[a-z0-9_]+)\)$/i,
  nand: /^~\((?<in0>[a-z0-9_]+) & (?<in1>[a-z0-9_]+)\)$/i,
  nor: /^~\((?<in0>[a-z0-9_]+) \| (?<in1>[a-z0-9_]+)\)$/i,
  xnor: /^~\((?<in0>[a-z0-9_]+) \^ (?<in1>[a-z0-9_]+)\)$/i,
  const_0: /^1'h0$/i,
  const_1: /^1'h1$/i,
};

export function parseVerilog(input: string): {
  circuit: Circuit;
  outputNames: string[];
} {
  const lines = input.split(";").map((l) => l.trim());

  const outputNames: string[] = [];

  const circuit: Circuit = [];

  for (let line of lines) {
    line = line.replaceAll(/\/\*(.*)\*\//g, "");
    line = line.replaceAll(/\/\/(.*)/g, "");
    const [keyword, ...tokens] = line.split(" ").map((tok) => tok.trim());

    if (
      keyword === "module" ||
      keyword === "endmodule" ||
      keyword === "wire" ||
      keyword === "input"
    ) {
      continue;
    } else if (keyword === "output") {
      outputNames.push(tokens[0]);
    } else if (keyword === "assign") {
      const [target, , ...operation] = tokens;
      const operationString = operation.join(" ");

      for (const [gateName, regex] of Object.entries(operationRegex)) {
        const match = operationString.match(regex);
        if (!match) continue;

        const inputs =
          gateName === "const_0"
            ? ["0"]
            : gateName === "const_1"
              ? ["1"]
              : Object.values(match.groups ?? {});

        circuit.push({
          gate: gateName as GateName,
          inputs,
          output: target,
        });

        break;
      }
    } else if (keyword) {
      throw new Error(`Unrecognised keyword: ${keyword}`);
    }
  }

  for (const gate in circuit) {
    console.log(
      `parse verilog -> gate:${gate} ${JSON.stringify(circuit[gate])}`,
    );
  }

  return { circuit, outputNames };
}
