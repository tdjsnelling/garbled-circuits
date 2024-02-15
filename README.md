# garbled-circuits

A toy multi-party computation (MPC) implementation using [Yao’s Garbled Circuits](https://en.wikipedia.org/wiki/Garbled_circuit) and RSA-based 1-2 [Oblivious Transfer](https://en.wikipedia.org/wiki/Oblivious_transfer) in TypeScript.

Boolean circuits are synthesised from Verilog using Yosys as per the Zellic blog post linked below.

The included example solves the ‘millionaire problem’ whereby two parties (Alice and Bob) want to know who is the richer of the two without revealing their own wealth to the other party. It takes 2 32-bit numbers as input (`A_0...A_31` and `B_0...B_31`) and returns a single-bit `A_IS_GREATER` as the output.

## Usage

```
$ yarn build
$ yarn start ./verilog/millionaire/out.v
```

## Resources followed

* https://www.zellic.io/blog/mpc-from-scratch
* https://cronokirby.com/posts/2022/05/explaining-yaos-garbled-circuits
* https://crypto.stackexchange.com/questions/8839/simple-protocol-for-1-out-of-2-oblivious-transfer
