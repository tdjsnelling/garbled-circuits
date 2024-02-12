module mycircuit(A, B, C, out);
  input wire A;
  input wire B;
  input wire C;
  output wire out = (A & B) & C;
endmodule
