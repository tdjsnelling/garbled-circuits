import { Circuit } from "./circuit/garble";

export function parseVerilog(input: string): Circuit {
  const lines = input.split(";").map((l) => l.trim());

  const wires = [];
  const inputs = [];
  const outputs = [];

  const circuit: Circuit = [];

  for (let line of lines) {
    line = line.replaceAll(/\/\*(.*)\*\//g, "");
    line = line.replaceAll(/\/\/(.*)/g, "");
    const [keyword, ...tokens] = line.split(" ");

    if (keyword === "module" || keyword === "endmodule") continue;
    else if (keyword === "wire") wires.push(tokens[0]);
    else if (keyword === "input") inputs.push(tokens[0]);
    else if (keyword === "output") outputs.push(tokens[0]);
    else if (keyword === "assign") {
      const [target, , ...operation] = tokens;

      if (operation[1] === "&") {
        circuit.push({
          gate: "and",
          inputs: [operation[0], operation[2]],
          output: target,
        });
      }
    }
  }

  console.log(circuit);

  return circuit;
}
