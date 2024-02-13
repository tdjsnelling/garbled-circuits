export const gates = {
  not: [[1, 0]],
  and: [
    [0, 0],
    [0, 1],
  ],
  or: [
    [0, 1],
    [1, 1],
  ],
  xor: [
    [0, 1],
    [1, 0],
  ],
  ornot: [
    [1, 0],
    [1, 1],
  ],
  andnot: [
    [0, 0],
    [1, 0],
  ],
  nand: [
    [1, 1],
    [1, 0],
  ],
  nor: [
    [1, 0],
    [0, 0],
  ],
  xnor: [
    [1, 0],
    [0, 1],
  ],
  const_0: [[0]],
  const_1: [[1]],
};

export type InputValue = 0 | 1;
export type GateName = keyof typeof gates;
export type Gate = InputValue[][];
