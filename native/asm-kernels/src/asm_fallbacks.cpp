#include "gogreen/asm_kernels.h"
#include <cstring>

extern "C" {

int64_t fallback_add_i64(int64_t a, int64_t b) {
    return a + b;
}

void* fallback_memcpy(void* dest, const void* src, size_t count) {
    return std::memcpy(dest, src, count);
}

int fallback_memcmp(const void* s1, const void* s2, size_t n) {
    return std::memcmp(s1, s2, n);
}

uint64_t fallback_byte_sum(const uint8_t* data, size_t count) {
    uint64_t sum = 0;
    for (size_t i = 0; i < count; ++i) {
        sum += data[i];
    }
    return sum;
}

void fallback_simd_add_f32(const float* a, const float* b, float* out, size_t count) {
    for (size_t i = 0; i < count; ++i) {
        out[i] = a[i] + b[i];
    }
}

}
