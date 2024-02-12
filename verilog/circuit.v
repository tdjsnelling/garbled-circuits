module mycircuit(A, B, C, out);
  input wire A;
  input wire B;
  input wire C;

  wire temp;
  assign temp = (A & B) & C;

  output wire out = ~temp;
endmodule
