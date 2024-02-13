module fulladd(
  input [3:0] A,
  input [3:0] B,
  input C_in,
  output C_out,
  output [3:0] sum
);
  assign {C_out, sum} = A + B + C_in;
endmodule
