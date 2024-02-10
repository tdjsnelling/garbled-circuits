export const gates = {
  and: [
    [0, 0],
    [0, 1],
  ],
  or: [
    [0, 1],
    [1, 1],
  ],
  not: [[1, 0]],
};

export type InputValue = 0 | 1;
export type GateName = keyof typeof gates;
export type Gate = InputValue[][];
