#pragma once

#include <string>
#include <vector>
#include <cstdint>
#include <functional>

namespace gogreen {

struct BenchmarkMetric {
    std::string id;
    std::string name;
    std::string category; // "Integer", "Memory", "SIMD", "Comparison"
    std::string implementation; // "Assembly (NASM)" or "C++ Fallback"
    size_t input_size_bytes{0};
    uint64_t iterations{0};
    double duration_ms{0.0};
    double throughput_ops_sec{0.0};
    double throughput_mb_sec{0.0};
    double min_ns{0.0};
    double max_ns{0.0};
    double median_ns{0.0};
    double p90_ns{0.0};
    double p99_ns{0.0};
    std::string timestamp;
    bool verified_correct{true};
};

class BenchmarkSuite {
public:
    static std::vector<BenchmarkMetric> run_all_safe(size_t scale = 1);
    static BenchmarkMetric run_integer_add(bool use_asm, uint64_t iterations = 1000000);
    static BenchmarkMetric run_memcpy_benchmark(bool use_asm, size_t buffer_bytes = 1048576, uint64_t iterations = 50);
    static BenchmarkMetric run_byte_sum_benchmark(bool use_asm, size_t buffer_bytes = 1048576, uint64_t iterations = 50);
    static BenchmarkMetric run_simd_add_benchmark(bool use_asm, size_t float_count = 262144, uint64_t iterations = 100);
};

} // namespace gogreen
