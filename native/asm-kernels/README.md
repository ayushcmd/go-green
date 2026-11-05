# GoGreen Assembly Kernels (x86-64 NASM)

This module provides bare-metal, high-performance assembly routines implemented in NASM targeting the **System V AMD64 ABI**.

## System V AMD64 ABI Specifications
- **Argument Registers:** `RDI`, `RSI`, `RDX`, `RCX`, `R8`, `R9`
- **Return Register:** `RAX` (64-bit integers and pointers), `XMM0` (floating-point)
- **Callee-Saved Registers:** `RBX`, `RSP`, `RBP`, `R12`, `R13`, `R14`, `R15`
- **Volatile / Scratch:** `RAX`, `RCX`, `RDX`, `RSI`, `RDI`, `R8`-`R11`, `XMM0`-`XMM15`

## Implemented Kernels
1. **`asm_add_i64`**: Fast 64-bit integer addition.
2. **`asm_memcpy`**: 64-bit quadword block memory copy with byte-remainder loop.
3. **`asm_memcmp`**: Constant-time lexical byte comparison.
4. **`asm_byte_sum`**: Byte accumulation loop over memory blocks.
5. **`asm_simd_add_f32`**: 128-bit SSE2/AVX single-precision floating point vector addition (`out[i] = a[i] + b[i]`).

## Portable C++ Fallbacks
For every assembly kernel, a matching portable C++ implementation is provided in `src/asm_fallbacks.cpp` with the `fallback_` prefix for non-x86 architectures and differential validation.

## Building and Testing
```bash
mkdir build && cd build
cmake ..
make
./test_asm_kernels
```
