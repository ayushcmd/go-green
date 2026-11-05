#include "gogreen/hardware_info.hpp"
#include <fstream>
#include <sstream>
#include <iomanip>
#include <cstring>
#include <unistd.h>
#include <sys/utsname.h>
#include <cstdlib>

namespace gogreen {

HardwareInfo HardwareInfo::detect() {
    HardwareInfo info;

    // 1. OS & Kernel Details via uname
    struct utsname uts;
    if (uname(&uts) == 0) {
        info.os_name = uts.sysname;
        info.os_release = uts.release;
        info.kernel_version = uts.version;
    } else {
        info.os_name = "Linux";
        info.os_release = "Unknown";
        info.kernel_version = "Unknown";
    }

    // 2. Hostname
    char host[256] = {0};
    if (gethostname(host, sizeof(host) - 1) == 0) {
        info.hostname = host;
    } else {
        info.hostname = "localhost";
    }

    // 3. Detect WSL2 vs Native Linux
    info.runtime_environment = "Native Linux";
    std::ifstream proc_version("/proc/version");
    if (proc_version.is_open()) {
        std::string vline;
        std::getline(proc_version, vline);
        if (vline.find("microsoft") != std::string::npos || vline.find("WSL") != std::string::npos) {
            info.runtime_environment = "Linux (WSL2)";
        }
    }

    // 4. System Uptime
    std::ifstream uptime_file("/proc/uptime");
    if (uptime_file.is_open()) {
        double uptime_sec = 0.0;
        uptime_file >> uptime_sec;
        info.uptime_seconds = static_cast<uint64_t>(uptime_sec);
    }

    // 5. Load Averages
    double load[3] = {0.0, 0.0, 0.0};
    if (getloadavg(load, 3) != -1) {
        info.load_avg_1m = load[0];
        info.load_avg_5m = load[1];
        info.load_avg_15m = load[2];
    }

    // 6. Memory Stats via /proc/meminfo
    std::ifstream meminfo("/proc/meminfo");
    if (meminfo.is_open()) {
        std::string key;
        uint64_t val_kb = 0;
        std::string unit;

        while (meminfo >> key >> val_kb) {
            // Read optional unit (e.g. "kB")
            if (meminfo.peek() != '\n') {
                meminfo >> unit;
            }

            if (key == "MemTotal:") {
                info.memory.total_bytes = val_kb * 1024;
            } else if (key == "MemFree:") {
                info.memory.free_bytes = val_kb * 1024;
            } else if (key == "MemAvailable:") {
                info.memory.available_bytes = val_kb * 1024;
            } else if (key == "SwapTotal:") {
                info.memory.swap_total_bytes = val_kb * 1024;
            } else if (key == "SwapFree:") {
                info.memory.swap_free_bytes = val_kb * 1024;
            }
        }
    }

    // 7. Hardware Performance Monitor Counter (PMC) / perf_event Status
    std::ifstream perf_file("/proc/sys/kernel/perf_event_paranoid");
    if (perf_file.is_open()) {
        int paranoid = 3;
        if (perf_file >> paranoid) {
            if (paranoid <= 1) {
                info.perf_event_supported = true;
                info.perf_event_status = "Available (kernel and user PMC sampling permitted)";
            } else if (paranoid == 2) {
                info.perf_event_supported = true;
                info.perf_event_status = "Restricted (user-space PMC permitted; kernel sampling restricted)";
            } else {
                info.perf_event_supported = false;
                info.perf_event_status = "Restricted (unprivileged PMC access disabled, paranoid >= 3)";
            }
        } else {
            info.perf_event_supported = false;
            info.perf_event_status = "Unable to read perf_event_paranoid level";
        }
    } else {
        info.perf_event_supported = false;
        info.perf_event_status = "Unavailable (perf_event_paranoid not present in container/WSL2)";
    }

    return info;
}

std::string HardwareInfo::to_json() const {
    std::ostringstream ss;
    ss << "{\n"
       << "  \"os_name\": \"" << os_name << "\",\n"
       << "  \"os_release\": \"" << os_release << "\",\n"
       << "  \"kernel_version\": \"" << kernel_version << "\",\n"
       << "  \"hostname\": \"" << hostname << "\",\n"
       << "  \"runtime_environment\": \"" << runtime_environment << "\",\n"
       << "  \"uptime_seconds\": " << uptime_seconds << ",\n"
       << "  \"load_avg\": {\n"
       << "    \"1m\": " << std::fixed << std::setprecision(2) << load_avg_1m << ",\n"
       << "    \"5m\": " << load_avg_5m << ",\n"
       << "    \"15m\": " << load_avg_15m << "\n"
       << "  },\n"
       << "  \"memory\": {\n"
       << "    \"total_bytes\": " << memory.total_bytes << ",\n"
       << "    \"free_bytes\": " << memory.free_bytes << ",\n"
       << "    \"available_bytes\": " << memory.available_bytes << ",\n"
       << "    \"swap_total_bytes\": " << memory.swap_total_bytes << ",\n"
       << "    \"swap_free_bytes\": " << memory.swap_free_bytes << "\n"
       << "  },\n"
       << "  \"perf_event_supported\": " << (perf_event_supported ? "true" : "false") << ",\n"
       << "  \"perf_event_status\": \"" << perf_event_status << "\"\n"
       << "}";
    return ss.str();
}

} // namespace gogreen
