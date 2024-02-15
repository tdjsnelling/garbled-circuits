module millionaire(
  input [31:0] A,
  input [31:0] B,
  output A_IS_GREATER
);
  assign A_IS_GREATER = A > B;
endmodule
