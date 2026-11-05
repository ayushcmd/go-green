#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * GoGreen Native Assembly Kernels
 * System V AMD64 ABI Calling Convention:
 * Arguments: RDI, RSI, RDX, RCX, R8, R9
 * Return: RAX (integer/pointer), XMM0 (float)
 * Callee-saved registers: RBX, RSP, RBP, R12, R13, R14, R15
 */

// 1. Integer addition: returns a + b
int64_t asm_add_i64(int64_t a, int64_t b);
int64_t fallback_add_i64(int64_t a, int64_t b);

// 2. Memory copy: copies count bytes from src to dest, returns dest
void* asm_memcpy(void* dest, const void* src, size_t count);
void* fallback_memcpy(void* dest, const void* src, size_t count);

// 3. Memory comparison: compares n bytes of s1 and s2, returns <0, 0, or >0
int asm_memcmp(const void* s1, const void* s2, size_t n);
int fallback_memcmp(const void* s1, const void* s2, size_t n);

// 4. Byte summation: sums all unsigned bytes in buffer
uint64_t asm_byte_sum(const uint8_t* data, size_t count);
uint64_t fallback_byte_sum(const uint8_t* data, size_t count);

// 5. SIMD single-precision float addition: out[i] = a[i] + b[i]
void asm_simd_add_f32(const float* a, const float* b, float* out, size_t count);
void fallback_simd_add_f32(const float* a, const float* b, float* out, size_t count);

#ifdef __cplusplus
}
#endif
