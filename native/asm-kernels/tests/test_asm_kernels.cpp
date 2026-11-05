#include "gogreen/asm_kernels.h"
#include <iostream>
#include <vector>
#include <numeric>
#include <cstring>
#include <cassert>
#include <chrono>

#define ASSERT_EQUAL(a, b, msg) \
    do { \
        if ((a) != (b)) { \
            std::cerr << "FAILED: " << msg << " (" << (a) << " != " << (b) << ")\n"; \
            return false; \
        } \
    } while(0)

#define ASSERT_TRUE(cond, msg) \
    do { \
        if (!(cond)) { \
            std::cerr << "FAILED: " << msg << "\n"; \
            return false; \
        } \
    } while(0)

bool test_asm_add() {
    std::cout << "[TEST] Running asm_add_i64...\n";

    ASSERT_EQUAL(asm_add_i64(0, 0), 0, "0 + 0");
    ASSERT_EQUAL(asm_add_i64(10, 20), 30, "10 + 20");
    ASSERT_EQUAL(asm_add_i64(-50, 20), -30, "-50 + 20");
    ASSERT_EQUAL(asm_add_i64(1000000000LL, 2000000000LL), 3000000000LL, "Large integer addition");
    ASSERT_EQUAL(asm_add_i64(-100, -200), -300, "Negative addition");

    // Match with fallback
    ASSERT_EQUAL(asm_add_i64(12345, 67890), fallback_add_i64(12345, 67890), "Add fallback parity");

    std::cout << "  ✓ asm_add_i64 passed.\n";
    return true;
}

bool test_asm_memcpy() {
    std::cout << "[TEST] Running asm_memcpy...\n";

    // 1. Boundary: 0 bytes
    char src0[16] = "HelloWorld";
    char dst0[16] = {0};
    void* ret0 = asm_memcpy(dst0, src0, 0);
    ASSERT_EQUAL(ret0, (void*)dst0, "Return value matches dest on 0 bytes");
    ASSERT_EQUAL((int)dst0[0], 0, "0 bytes does not write");

    // 2. Small unaligned bytes (3 bytes)
    char src1[] = "XYZ";
    char dst1[8] = {0};
    asm_memcpy(dst1, src1, 3);
    ASSERT_EQUAL(std::memcmp(dst1, "XYZ", 3), 0, "3-byte copy");

    // 3. Medium buffer (64 bytes)
    std::vector<uint8_t> src(1024);
    std::vector<uint8_t> dst(1024, 0);
    for (size_t i = 0; i < src.size(); ++i) src[i] = (uint8_t)(i & 0xFF);

    void* ret = asm_memcpy(dst.data(), src.data(), src.size());
    ASSERT_EQUAL(ret, (void*)dst.data(), "Return value matches dest pointer");
    ASSERT_EQUAL(std::memcmp(dst.data(), src.data(), src.size()), 0, "1024-byte copy correctness");

    // 4. Parity with C++ fallback
    std::vector<uint8_t> fallbackDst(1024, 0);
    fallback_memcpy(fallbackDst.data(), src.data(), src.size());
    ASSERT_EQUAL(std::memcmp(dst.data(), fallbackDst.data(), dst.size()), 0, "Memcpy fallback parity");

    std::cout << "  ✓ asm_memcpy passed.\n";
    return true;
}

bool test_asm_memcmp() {
    std::cout << "[TEST] Running asm_memcmp...\n";

    // 1. Identical buffers
    char b1[] = "SystemsEngineering";
    char b2[] = "SystemsEngineering";
    ASSERT_EQUAL(asm_memcmp(b1, b2, sizeof(b1)), 0, "Equal buffers return 0");

    // 2. Difference
    char b3[] = "SystemsEngineerinA";
    ASSERT_TRUE(asm_memcmp(b1, b3, sizeof(b1)) > 0, "'g' > 'A' returns positive");
    ASSERT_TRUE(asm_memcmp(b3, b1, sizeof(b1)) < 0, "'A' < 'g' returns negative");

    // 3. Parity with fallback
    int asmRes = asm_memcmp(b1, b3, sizeof(b1));
    int fallRes = fallback_memcmp(b1, b3, sizeof(b1));
    ASSERT_TRUE((asmRes > 0 && fallRes > 0) || (asmRes < 0 && fallRes < 0) || (asmRes == 0 && fallRes == 0),
                "Sign parity between asm and fallback memcmp");

    std::cout << "  ✓ asm_memcmp passed.\n";
    return true;
}

bool test_asm_byte_sum() {
    std::cout << "[TEST] Running asm_byte_sum...\n";

    // 1. Boundary: 0 count
    ASSERT_EQUAL(asm_byte_sum(nullptr, 0), 0ULL, "0 bytes returns 0");

    // 2. Small array
    uint8_t smallArr[] = { 1, 2, 3, 4, 5 };
    ASSERT_EQUAL(asm_byte_sum(smallArr, 5), 15ULL, "1+2+3+4+5 = 15");

    // 3. 256 bytes with all 1s
    std::vector<uint8_t> ones(256, 1);
    ASSERT_EQUAL(asm_byte_sum(ones.data(), ones.size()), 256ULL, "256 ones = 256");

    // 4. Large buffer (16KB)
    std::vector<uint8_t> large(16384);
    for (size_t i = 0; i < large.size(); ++i) large[i] = (uint8_t)(i % 256);
    uint64_t expected = fallback_byte_sum(large.data(), large.size());
    ASSERT_EQUAL(asm_byte_sum(large.data(), large.size()), expected, "16KB byte sum parity");

    std::cout << "  ✓ asm_byte_sum passed.\n";
    return true;
}

bool test_asm_simd() {
    std::cout << "[TEST] Running asm_simd_add_f32...\n";

    const size_t count = 37; // Non-multiple of 4 to test both vector & scalar remainder paths
    std::vector<float> a(count);
    std::vector<float> b(count);
    std::vector<float> outAsm(count, 0.0f);
    std::vector<float> outFallback(count, 0.0f);

    for (size_t i = 0; i < count; ++i) {
        a[i] = (float)i * 1.5f;
        b[i] = 100.0f - (float)i;
    }

    asm_simd_add_f32(a.data(), b.data(), outAsm.data(), count);
    fallback_simd_add_f32(a.data(), b.data(), outFallback.data(), count);

    for (size_t i = 0; i < count; ++i) {
        float diff = std::abs(outAsm[i] - outFallback[i]);
        ASSERT_TRUE(diff < 1e-5f, "SIMD float add matches scalar fallback within epsilon");
    }

    std::cout << "  ✓ asm_simd_add_f32 passed.\n";
    return true;
}

int main() {
    std::cout << "========================================\n";
    std::cout << " GoGreen Assembly Kernel Correctness Test\n";
    std::cout << " System V AMD64 ABI Verification Suite\n";
    std::cout << "========================================\n";

    bool pass = true;
    pass &= test_asm_add();
    pass &= test_asm_memcpy();
    pass &= test_asm_memcmp();
    pass &= test_asm_byte_sum();
    pass &= test_asm_simd();

    if (pass) {
        std::cout << "\n>>> ALL ASSEMBLY KERNEL TESTS PASSED <<<\n";
        return 0;
    } else {
        std::cerr << "\n>>> TEST FAILURES DETECTED <<<\n";
        return 1;
    }
}
