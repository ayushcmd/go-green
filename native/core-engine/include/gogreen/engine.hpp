#pragma once

#include "cpu_info.hpp"
#include "cpu_features.hpp"
#include "hardware_info.hpp"
#include "benchmark.hpp"
#include <vector>
#include <mutex>
#include <memory>

namespace gogreen {

class Engine {
public:
    static Engine& instance();

    bool initialize();
    void shutdown();
    bool is_initialized() const { return initialized_; }

    const CpuInfo& get_cpu_info() const { return cpu_info_; }
    const std::vector<FeatureDetail>& get_features() const { return features_; }
    HardwareInfo get_current_hardware_info() const;

    std::vector<BenchmarkMetric> get_benchmark_history() const;
    BenchmarkMetric run_single_benchmark(const std::string& type, bool use_asm);
    std::vector<BenchmarkMetric> run_full_suite();

    std::string get_health_json() const;
    std::string get_status_json() const;
    std::string get_telemetry_json() const;

private:
    Engine() = default;
    ~Engine() = default;

    bool initialized_{false};
    uint64_t start_time_{0};
    CpuInfo cpu_info_;
    std::vector<FeatureDetail> features_;
    mutable std::mutex benchmark_mutex_;
    std::vector<BenchmarkMetric> benchmark_history_;
};

} // namespace gogreen
