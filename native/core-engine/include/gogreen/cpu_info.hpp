#pragma once

#include <string>
#include <vector>
#include <cstdint>

namespace gogreen {

struct CacheInfo {
    size_t l1d_kb{0};
    size_t l1i_kb{0};
    size_t l2_kb{0};
    size_t l3_kb{0};
};

struct CpuInfo {
    std::string vendor;
    std::string brand_string;
    std::string architecture;
    uint32_t family{0};
    uint32_t model{0};
    uint32_t stepping{0};
    uint32_t logical_cores{0};
    uint32_t physical_cores{0};
    CacheInfo cache;

    static CpuInfo detect();
    std::string to_json() const;
};

} // namespace gogreen
