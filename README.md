# garbled-circuits

A toy multi-party computation (MPC) implementation using [Yao’s Garbled Circuits](https://en.wikipedia.org/wiki/Garbled_circuit) and RSA-based 1-2 [Oblivious Transfer](https://en.wikipedia.org/wiki/Oblivious_transfer) in JavaScript (Node).

Boolean circuits are synthesised from Verilog using Yosys as per the Zellic blog post linked below.

The included example solves the ‘millionaire problem’ whereby two parties (Alice and Bob) want to know who is the richer of the two without revealing their own wealth to the other party.

## Usage

```
$ yarn build
$ yarn start ./verilog/millionaire/out.v
```

## Resources followed

* https://www.zellic.io/blog/mpc-from-scratch
* https://cronokirby.com/posts/2022/05/explaining-yaos-garbled-circuits
* https://crypto.stackexchange.com/questions/8839/simple-protocol-for-1-out-of-2-oblivious-transfer
