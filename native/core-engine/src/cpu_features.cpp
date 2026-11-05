#include "gogreen/cpu_features.hpp"
#include <algorithm>

#if defined(__x86_64__) || defined(_M_X64)
#include <cpuid.h>
#include <immintrin.h>
#endif

namespace gogreen {

bool CpuFeatureDetector::check_os_xsave() {
#if defined(__x86_64__) || defined(_M_X64)
    unsigned int eax = 0, ebx = 0, ecx = 0, edx = 0;
    if (__get_cpuid(1, &eax, &ebx, &ecx, &edx)) {
        // Bit 27 of ECX indicates OSXSAVE support
        return (ecx & (1 << 27)) != 0;
    }
#endif
    return false;
}

uint64_t CpuFeatureDetector::read_xcr0() {
#if defined(__x86_64__) || defined(_M_X64)
    if (!check_os_xsave()) {
        return 0;
    }
    uint32_t eax = 0, edx = 0;
    __asm__ volatile("xgetbv" : "=a"(eax), "=d"(edx) : "c"(0));
    return (static_cast<uint64_t>(edx) << 32) | eax;
#else
    return 0;
#endif
}

std::vector<FeatureDetail> CpuFeatureDetector::detect_all() {
    std::vector<FeatureDetail> features;

#if defined(__x86_64__) || defined(_M_X64)
    unsigned int eax1 = 0, ebx1 = 0, ecx1 = 0, edx1 = 0;
    bool has_leaf1 = __get_cpuid(1, &eax1, &ebx1, &ecx1, &edx1) != 0;

    unsigned int eax7 = 0, ebx7 = 0, ecx7 = 0, edx7 = 0;
    bool has_leaf7 = false;
    unsigned int max_basic = 0, dummy = 0;
    if (__get_cpuid(0, &max_basic, &dummy, &dummy, &dummy) && max_basic >= 7) {
        __cpuid_count(7, 0, eax7, ebx7, ecx7, edx7);
        has_leaf7 = true;
    }

    uint64_t xcr0 = read_xcr0();
    bool os_avx_supported = (xcr0 & 0x06) == 0x06;         // XMM (bit 1) and YMM (bit 2)
    bool os_avx512_supported = (xcr0 & 0xE6) == 0xE6;     // XMM, YMM, opmask (5), ZMM_Hi256 (6), Hi16_ZMM (7)

    // 1. SSE2
    {
        bool hw = has_leaf1 && ((edx1 & (1 << 26)) != 0);
        features.push_back({
            "SSE2",
            "SIMD",
            hw,
            true, // OS enabled by default on 64-bit systems
            hw,
            "Streaming SIMD Extensions 2 (128-bit integer and double precision)"
        });
    }

    // 2. SSE4.2
    {
        bool hw = has_leaf1 && ((ecx1 & (1 << 20)) != 0);
        features.push_back({
            "SSE4.2",
            "SIMD",
            hw,
            true,
            hw,
            "Streaming SIMD Extensions 4.2 (String and text processing, CRC32)"
        });
    }

    // 3. AVX
    {
        bool hw = has_leaf1 && ((ecx1 & (1 << 28)) != 0);
        bool active = hw && os_avx_supported;
        features.push_back({
            "AVX",
            "Vector",
            hw,
            os_avx_supported,
            active,
            "Advanced Vector Extensions (256-bit floating point registers YMM)"
        });
    }

    // 4. AVX2
    {
        bool hw = has_leaf7 && ((ebx7 & (1 << 5)) != 0);
        bool active = hw && os_avx_supported;
        features.push_back({
            "AVX2",
            "Vector",
            hw,
            os_avx_supported,
            active,
            "Advanced Vector Extensions 2 (256-bit integer and vector gather)"
        });
    }

    // 5. AVX-512 Foundation
    {
        bool hw = has_leaf7 && ((ebx7 & (1 << 16)) != 0);
        bool active = hw && os_avx512_supported;
        features.push_back({
            "AVX-512F",
            "Vector",
            hw,
            os_avx512_supported,
            active,
            "AVX-512 Foundation (512-bit vector register file ZMM0-ZMM31)"
        });
    }

    // 6. AVX-512 DQ (Doubleword and Quadword)
    {
        bool hw = has_leaf7 && ((ebx7 & (1 << 17)) != 0);
        bool active = hw && os_avx512_supported;
        features.push_back({
            "AVX-512DQ",
            "Vector",
            hw,
            os_avx512_supported,
            active,
            "AVX-512 Doubleword and Quadword Instructions"
        });
    }

    // 7. AVX-512 BW (Byte and Word)
    {
        bool hw = has_leaf7 && ((ebx7 & (1 << 30)) != 0);
        bool active = hw && os_avx512_supported;
        features.push_back({
            "AVX-512BW",
            "Vector",
            hw,
            os_avx512_supported,
            active,
            "AVX-512 Byte and Word Instructions"
        });
    }

    // 8. FMA3
    {
        bool hw = has_leaf1 && ((ecx1 & (1 << 12)) != 0);
        bool active = hw && os_avx_supported;
        features.push_back({
            "FMA3",
            "SIMD",
            hw,
            os_avx_supported,
            active,
            "Fused Multiply-Add 3-operand instructions"
        });
    }

    // 9. AES-NI
    {
        bool hw = has_leaf1 && ((ecx1 & (1 << 25)) != 0);
        features.push_back({
            "AES-NI",
            "Cryptography",
            hw,
            true,
            hw,
            "Advanced Encryption Standard New Instructions"
        });
    }

    // 10. SHA-NI
    {
        bool hw = has_leaf7 && ((ebx7 & (1 << 29)) != 0);
        features.push_back({
            "SHA-NI",
            "Cryptography",
            hw,
            true,
            hw,
            "Secure Hash Algorithm Extensions"
        });
    }

    // 11. BMI1
    {
        bool hw = has_leaf7 && ((ebx7 & (1 << 3)) != 0);
        features.push_back({
            "BMI1",
            "Base",
            hw,
            true,
            hw,
            "Bit Manipulation Instruction Set 1 (ANDN, BEXTR, BLSI, BLSMSK, BLSR, TZCNT)"
        });
    }

    // 12. BMI2
    {
        bool hw = has_leaf7 && ((ebx7 & (1 << 8)) != 0);
        features.push_back({
            "BMI2",
            "Base",
            hw,
            true,
            hw,
            "Bit Manipulation Instruction Set 2 (BZHI, MULX, PDEP, PEXT, RORX, SARX, SHLX, SHRX)"
        });
    }

#endif

    return features;
}

bool CpuFeatureDetector::is_supported_and_enabled(const std::string& feature_name) {
    auto all = detect_all();
    for (const auto& f : all) {
        if (f.name == feature_name) {
            return f.active;
        }
    }
    return false;
}

bool CpuFeatureDetector::has_sse2() {
    return is_supported_and_enabled("SSE2");
}

bool CpuFeatureDetector::has_sse4_2() {
    return is_supported_and_enabled("SSE4.2");
}

bool CpuFeatureDetector::has_avx() {
    return is_supported_and_enabled("AVX");
}

bool CpuFeatureDetector::has_avx2() {
    return is_supported_and_enabled("AVX2");
}

bool CpuFeatureDetector::has_avx512f() {
    return is_supported_and_enabled("AVX-512F");
}

bool CpuFeatureDetector::has_fma3() {
    return is_supported_and_enabled("FMA3");
}

bool CpuFeatureDetector::has_aes_ni() {
    return is_supported_and_enabled("AES-NI");
}

bool CpuFeatureDetector::has_sha_ni() {
    return is_supported_and_enabled("SHA-NI");
}

bool CpuFeatureDetector::has_bmi1() {
    return is_supported_and_enabled("BMI1");
}

bool CpuFeatureDetector::has_bmi2() {
    return is_supported_and_enabled("BMI2");
}

} // namespace gogreen
