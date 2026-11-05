#include "gogreen/cpu_info.hpp"
#include <fstream>
#include <sstream>
#include <thread>
#include <cstring>
#include <unistd.h>
#include <set>

#if defined(__x86_64__) || defined(_M_X64)
#include <cpuid.h>
#endif

namespace gogreen {

CpuInfo CpuInfo::detect() {
    CpuInfo info;

#if defined(__x86_64__) || defined(_M_X64)
    info.architecture = "x86_64";

    unsigned int eax = 0, ebx = 0, ecx = 0, edx = 0;

    // 1. Leaf 0: Vendor String & Maximum Supported Basic Leaf
    if (__get_cpuid(0, &eax, &ebx, &ecx, &edx)) {
        char vendor[13] = {0};
        std::memcpy(vendor + 0, &ebx, 4);
        std::memcpy(vendor + 4, &edx, 4);
        std::memcpy(vendor + 8, &ecx, 4);
        info.vendor = vendor;
    } else {
        info.vendor = "Unknown";
    }

    // 2. Leaf 1: Family, Model, Stepping
    if (__get_cpuid(1, &eax, &ebx, &ecx, &edx)) {
        uint32_t stepping = eax & 0x0F;
        uint32_t base_model = (eax >> 4) & 0x0F;
        uint32_t base_family = (eax >> 8) & 0x0F;
        uint32_t ext_model = (eax >> 16) & 0x0F;
        uint32_t ext_family = (eax >> 20) & 0xFF;

        uint32_t family = base_family;
        if (base_family == 0x0F) {
            family += ext_family;
        }

        uint32_t model = base_model;
        if (base_family == 0x06 || base_family == 0x0F) {
            model += (ext_model << 4);
        }

        info.family = family;
        info.model = model;
        info.stepping = stepping;
    }

    // 3. Leaves 0x80000002..0x80000004: Processor Brand String
    char brand[49] = {0};
    unsigned int ext_max = 0;
    __get_cpuid(0x80000000, &ext_max, &ebx, &ecx, &edx);

    if (ext_max >= 0x80000004) {
        __get_cpuid(0x80000002, (unsigned int*)(brand + 0),  (unsigned int*)(brand + 4),  (unsigned int*)(brand + 8),  (unsigned int*)(brand + 12));
        __get_cpuid(0x80000003, (unsigned int*)(brand + 16), (unsigned int*)(brand + 20), (unsigned int*)(brand + 24), (unsigned int*)(brand + 28));
        __get_cpuid(0x80000004, (unsigned int*)(brand + 32), (unsigned int*)(brand + 36), (unsigned int*)(brand + 40), (unsigned int*)(brand + 44));

        // Trim leading spaces
        char* start = brand;
        while (*start == ' ') start++;
        info.brand_string = start;
    } else {
        info.brand_string = "Generic x86-64 Processor";
    }

#elif defined(__aarch64__)
    info.architecture = "aarch64";
    info.vendor = "ARM";
    info.brand_string = "ARM64 Processor";
#else
    info.architecture = "unknown";
    info.vendor = "Generic";
    info.brand_string = "Unknown Processor";
#endif

    // Logical processors
    long nprocs = sysconf(_SC_NPROCESSORS_ONLN);
    info.logical_cores = nprocs > 0 ? (uint32_t)nprocs : std::thread::hardware_concurrency();

    // Parse /proc/cpuinfo for physical cores & cache
    std::ifstream cpuinfo("/proc/cpuinfo");
    if (cpuinfo.is_open()) {
        std::string line;
        std::set<std::pair<int, int>> core_ids; // {physical_id, core_id}
        int cur_phys = 0;
        int cur_core = 0;

        while (std::getline(cpuinfo, line)) {
            if (line.rfind("physical id", 0) == 0) {
                auto pos = line.find(':');
                if (pos != std::string::npos) {
                    cur_phys = std::stoi(line.substr(pos + 1));
                }
            } else if (line.rfind("core id", 0) == 0) {
                auto pos = line.find(':');
                if (pos != std::string::npos) {
                    cur_core = std::stoi(line.substr(pos + 1));
                    core_ids.insert({cur_phys, cur_core});
                }
            } else if (line.rfind("model name", 0) == 0 && info.brand_string.empty()) {
                auto pos = line.find(':');
                if (pos != std::string::npos) {
                    info.brand_string = line.substr(pos + 2);
                }
            }
        }

        if (!core_ids.empty()) {
            info.physical_cores = (uint32_t)core_ids.size();
        } else {
            info.physical_cores = info.logical_cores > 1 ? info.logical_cores / 2 : 1;
        }
    } else {
        info.physical_cores = info.logical_cores > 1 ? info.logical_cores / 2 : 1;
    }

    // Cache info defaults / read from sysfs if available
    auto read_sysfs_cache = [](const std::string& index) -> size_t {
        std::ifstream file("/sys/devices/system/cpu/cpu0/cache/index" + index + "/size");
        if (file.is_open()) {
            std::string val;
            file >> val;
            size_t size = std::stoull(val);
            if (val.find('K') != std::string::npos) return size;
            if (val.find('M') != std::string::npos) return size * 1024;
            return size / 1024;
        }
        return 0;
    };

    info.cache.l1d_kb = read_sysfs_cache("0"); // L1 Data
    info.cache.l1i_kb = read_sysfs_cache("1"); // L1 Instruction
    info.cache.l2_kb  = read_sysfs_cache("2"); // L2 Unified
    info.cache.l3_kb  = read_sysfs_cache("3"); // L3 Unified

    if (info.cache.l1d_kb == 0) info.cache.l1d_kb = 32;
    if (info.cache.l1i_kb == 0) info.cache.l1i_kb = 32;
    if (info.cache.l2_kb == 0)  info.cache.l2_kb = 512;
    if (info.cache.l3_kb == 0)  info.cache.l3_kb = 16384;

    return info;
}

std::string CpuInfo::to_json() const {
    std::ostringstream ss;
    ss << "{\n"
       << "  \"vendor\": \"" << vendor << "\",\n"
       << "  \"brand\": \"" << brand_string << "\",\n"
       << "  \"architecture\": \"" << architecture << "\",\n"
       << "  \"family\": " << family << ",\n"
       << "  \"model\": " << model << ",\n"
       << "  \"stepping\": " << stepping << ",\n"
       << "  \"logical_cores\": " << logical_cores << ",\n"
       << "  \"physical_cores\": " << physical_cores << ",\n"
       << "  \"cache\": {\n"
       << "    \"l1d_kb\": " << cache.l1d_kb << ",\n"
       << "    \"l1i_kb\": " << cache.l1i_kb << ",\n"
       << "    \"l2_kb\": " << cache.l2_kb << ",\n"
       << "    \"l3_kb\": " << cache.l3_kb << "\n"
       << "  }\n"
       << "}";
    return ss.str();
}

} // namespace gogreen
