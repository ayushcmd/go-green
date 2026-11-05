#include "gogreen/engine.hpp"
#include <chrono>
#include <sstream>
#include <iomanip>
#include <ctime>

namespace gogreen {

namespace {

std::string get_iso_now() {
    auto now = std::chrono::system_clock::now();
    std::time_t now_c = std::chrono::system_clock::to_time_t(now);
    std::tm tm_buf{};
    gmtime_r(&now_c, &tm_buf);
    char buf[64];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm_buf);
    return std::string(buf);
}

} // namespace

Engine& Engine::instance() {
    static Engine engine_instance;
    return engine_instance;
}

bool Engine::initialize() {
    if (initialized_) {
        return true;
    }

    start_time_ = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();

    // 1. Detect CPU properties & hardware architecture
    cpu_info_ = CpuInfo::detect();

    // 2. Detect all ISA features and OS extended register states
    features_ = CpuFeatureDetector::detect_all();

    initialized_ = true;
    return true;
}

void Engine::shutdown() {
    initialized_ = false;
}

HardwareInfo Engine::get_current_hardware_info() const {
    return HardwareInfo::detect();
}

std::vector<BenchmarkMetric> Engine::get_benchmark_history() const {
    std::lock_guard<std::mutex> lock(benchmark_mutex_);
    return benchmark_history_;
}

BenchmarkMetric Engine::run_single_benchmark(const std::string& type, bool use_asm) {
    BenchmarkMetric result;
    if (type == "int-add" || type == "integer") {
        result = BenchmarkSuite::run_integer_add(use_asm);
    } else if (type == "memcpy" || type == "memory") {
        result = BenchmarkSuite::run_memcpy_benchmark(use_asm);
    } else if (type == "byte-sum" || type == "bytesum") {
        result = BenchmarkSuite::run_byte_sum_benchmark(use_asm);
    } else if (type == "simd-add" || type == "simd") {
        result = BenchmarkSuite::run_simd_add_benchmark(use_asm);
    } else {
        // Default to integer add
        result = BenchmarkSuite::run_integer_add(use_asm);
    }

    {
        std::lock_guard<std::mutex> lock(benchmark_mutex_);
        benchmark_history_.push_back(result);
    }
    return result;
}

std::vector<BenchmarkMetric> Engine::run_full_suite() {
    auto results = BenchmarkSuite::run_all_safe(1);
    {
        std::lock_guard<std::mutex> lock(benchmark_mutex_);
        for (const auto& r : results) {
            benchmark_history_.push_back(r);
        }
    }
    return results;
}

std::string Engine::get_health_json() const {
    uint64_t now_sec = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
    uint64_t uptime = initialized_ ? (now_sec - start_time_) : 0;

    std::ostringstream ss;
    ss << "{\n"
       << "  \"status\": \"" << (initialized_ ? "healthy" : "initializing") << "\",\n"
       << "  \"initialized\": " << (initialized_ ? "true" : "false") << ",\n"
       << "  \"uptime_seconds\": " << uptime << ",\n"
       << "  \"engine_version\": \"2.0.0-phase2\",\n"
       << "  \"timestamp\": \"" << get_iso_now() << "\"\n"
       << "}";
    return ss.str();
}

std::string Engine::get_status_json() const {
    uint64_t now_sec = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
    uint64_t uptime = initialized_ ? (now_sec - start_time_) : 0;

    size_t active_features = 0;
    for (const auto& f : features_) {
        if (f.active) active_features++;
    }

    size_t history_count = 0;
    {
        std::lock_guard<std::mutex> lock(benchmark_mutex_);
        history_count = benchmark_history_.size();
    }

    HardwareInfo hw = HardwareInfo::detect();

    std::ostringstream ss;
    ss << "{\n"
       << "  \"status\": \"" << (initialized_ ? "ONLINE" : "OFFLINE") << "\",\n"
       << "  \"engine_version\": \"2.0.0-phase2\",\n"
       << "  \"uptime_seconds\": " << uptime << ",\n"
       << "  \"runtime_environment\": \"" << hw.runtime_environment << "\",\n"
       << "  \"os\": \"" << hw.os_name << " " << hw.os_release << "\",\n"
       << "  \"kernel\": \"" << hw.kernel_version << "\",\n"
       << "  \"hostname\": \"" << hw.hostname << "\",\n"
       << "  \"cpu\": {\n"
       << "    \"vendor\": \"" << cpu_info_.vendor << "\",\n"
       << "    \"brand\": \"" << cpu_info_.brand_string << "\",\n"
       << "    \"architecture\": \"" << cpu_info_.architecture << "\",\n"
       << "    \"family\": " << cpu_info_.family << ",\n"
       << "    \"model\": " << cpu_info_.model << ",\n"
       << "    \"stepping\": " << cpu_info_.stepping << ",\n"
       << "    \"logical_cores\": " << cpu_info_.logical_cores << ",\n"
       << "    \"physical_cores\": " << cpu_info_.physical_cores << "\n"
       << "  },\n"
       << "  \"features\": {\n"
       << "    \"total_detected\": " << features_.size() << ",\n"
       << "    \"active\": " << active_features << "\n"
       << "  },\n"
       << "  \"benchmark_runs_recorded\": " << history_count << ",\n"
       << "  \"perf_event_status\": \"" << hw.perf_event_status << "\",\n"
       << "  \"timestamp\": \"" << get_iso_now() << "\"\n"
       << "}";
    return ss.str();
}

std::string Engine::get_telemetry_json() const {
    HardwareInfo hw = HardwareInfo::detect();
    uint64_t now_sec = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
    uint64_t uptime = initialized_ ? (now_sec - start_time_) : 0;

    uint64_t used_bytes = 0;
    double used_pct = 0.0;
    if (hw.memory.total_bytes > 0) {
        if (hw.memory.available_bytes > 0 && hw.memory.available_bytes <= hw.memory.total_bytes) {
            used_bytes = hw.memory.total_bytes - hw.memory.available_bytes;
        } else if (hw.memory.free_bytes <= hw.memory.total_bytes) {
            used_bytes = hw.memory.total_bytes - hw.memory.free_bytes;
        }
        used_pct = (static_cast<double>(used_bytes) / hw.memory.total_bytes) * 100.0;
    }

    std::ostringstream ss;
    ss << "{\n"
       << "  \"timestamp\": \"" << get_iso_now() << "\",\n"
       << "  \"uptime_seconds\": " << uptime << ",\n"
       << "  \"system\": {\n"
       << "    \"load_1m\": " << std::fixed << std::setprecision(2) << hw.load_avg_1m << ",\n"
       << "    \"load_5m\": " << hw.load_avg_5m << ",\n"
       << "    \"load_15m\": " << hw.load_avg_15m << ",\n"
       << "    \"memory\": {\n"
       << "      \"total_bytes\": " << hw.memory.total_bytes << ",\n"
       << "      \"available_bytes\": " << hw.memory.available_bytes << ",\n"
       << "      \"free_bytes\": " << hw.memory.free_bytes << ",\n"
       << "      \"used_bytes\": " << used_bytes << ",\n"
       << "      \"used_percent\": " << std::fixed << std::setprecision(1) << used_pct << "\n"
       << "    },\n"
       << "    \"perf_event_supported\": " << (hw.perf_event_supported ? "true" : "false") << "\n"
       << "  }\n"
       << "}";
    return ss.str();
}

} // namespace gogreen
