#pragma once

#include <string>
#include <vector>
#include <cstdint>

namespace gogreen {

struct FeatureDetail {
    std::string name;
    std::string category;     // "SIMD", "Vector", "Cryptography", "Virtualization", "Base"
    bool hw_supported{false}; // Hardware CPUID support
    bool os_supported{false}; // OS register state enabled (XCR0)
    bool active{false};       // hw_supported && os_supported
    std::string description;
};

class CpuFeatureDetector {
public:
    static std::vector<FeatureDetail> detect_all();
    static bool is_supported_and_enabled(const std::string& feature_name);
    static uint64_t read_xcr0();
    static bool check_os_xsave();

    // Specific capability gates
    static bool has_sse2();
    static bool has_sse4_2();
    static bool has_avx();
    static bool has_avx2();
    static bool has_avx512f();
    static bool has_fma3();
    static bool has_aes_ni();
    static bool has_sha_ni();
    static bool has_bmi1();
    static bool has_bmi2();
};

} // namespace gogreen
