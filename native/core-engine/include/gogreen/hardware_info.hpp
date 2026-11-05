#pragma once

#include <string>
#include <cstdint>

namespace gogreen {

struct MemoryStats {
    uint64_t total_bytes{0};
    uint64_t free_bytes{0};
    uint64_t available_bytes{0};
    uint64_t swap_total_bytes{0};
    uint64_t swap_free_bytes{0};
};

struct HardwareInfo {
    std::string os_name;
    std::string os_release;
    std::string kernel_version;
    std::string hostname;
    std::string runtime_environment; // "Linux WSL2", "Native Linux", etc.
    uint64_t uptime_seconds{0};
    double load_avg_1m{0.0};
    double load_avg_5m{0.0};
    double load_avg_15m{0.0};
    MemoryStats memory;
    bool perf_event_supported{false};
    std::string perf_event_status;

    static HardwareInfo detect();
    std::string to_json() const;
};

} // namespace gogreen
