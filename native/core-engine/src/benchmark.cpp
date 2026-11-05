#include "gogreen/benchmark.hpp"
#include "gogreen/cpu_features.hpp"
#include "gogreen/asm_kernels.h"
#include <chrono>
#include <vector>
#include <numeric>
#include <algorithm>
#include <cstring>
#include <ctime>
#include <sstream>
#include <iomanip>

namespace gogreen {

namespace {

std::string get_iso_timestamp() {
    auto now = std::chrono::system_clock::now();
    std::time_t now_c = std::chrono::system_clock::to_time_t(now);
    std::tm tm_buf{};
    gmtime_r(&now_c, &tm_buf);
    char buf[64];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm_buf);
    return std::string(buf);
}

void compute_percentiles(std::vector<double>& times_ns, BenchmarkMetric& metric) {
    if (times_ns.empty()) return;
    std::sort(times_ns.begin(), times_ns.end());
    metric.min_ns = times_ns.front();
    metric.max_ns = times_ns.back();

    auto pct = [&](double p) -> double {
        size_t idx = static_cast<size_t>(p * (times_ns.size() - 1));
        return times_ns[idx];
    };

    metric.median_ns = pct(0.50);
    metric.p90_ns = pct(0.90);
    metric.p99_ns = pct(0.99);
}

} // namespace

BenchmarkMetric BenchmarkSuite::run_integer_add(bool use_asm, uint64_t iterations) {
    BenchmarkMetric metric;
    metric.id = use_asm ? "asm-int-add" : "cpp-int-add";
    metric.name = "64-bit Integer Addition";
    metric.category = "Integer";
    metric.implementation = use_asm ? "Assembly (NASM)" : "C++ Fallback";
    metric.iterations = iterations;
    metric.input_size_bytes = sizeof(int64_t) * 2;
    metric.timestamp = get_iso_timestamp();

    // Verify correctness first
    int64_t test_v1 = 123456789LL;
    int64_t test_v2 = 987654321LL;
    int64_t expected = test_v1 + test_v2;
    int64_t actual = use_asm ? asm_add_i64(test_v1, test_v2) : fallback_add_i64(test_v1, test_v2);
    metric.verified_correct = (actual == expected);

    // Warmup
    volatile int64_t dummy = 0;
    for (uint64_t i = 0; i < 10000; ++i) {
        dummy = use_asm ? asm_add_i64(dummy, 1) : fallback_add_i64(dummy, 1);
    }

    // Benchmark in batches to measure timing accurately
    const size_t num_samples = 20;
    uint64_t batch_size = iterations / num_samples;
    if (batch_size == 0) batch_size = 1;

    std::vector<double> sample_ns;
    sample_ns.reserve(num_samples);

    auto start_all = std::chrono::steady_clock::now();

    for (size_t s = 0; s < num_samples; ++s) {
        auto t0 = std::chrono::steady_clock::now();
        for (uint64_t i = 0; i < batch_size; ++i) {
            dummy = use_asm ? asm_add_i64(dummy, 1) : fallback_add_i64(dummy, 1);
        }
        auto t1 = std::chrono::steady_clock::now();
        double delta_ns = std::chrono::duration<double, std::nano>(t1 - t0).count() / batch_size;
        sample_ns.push_back(delta_ns);
    }

    auto end_all = std::chrono::steady_clock::now();
    double total_sec = std::chrono::duration<double>(end_all - start_all).count();
    metric.duration_ms = total_sec * 1000.0;
    metric.throughput_ops_sec = total_sec > 0.0 ? (batch_size * num_samples) / total_sec : 0.0;
    metric.throughput_mb_sec = (metric.throughput_ops_sec * sizeof(int64_t)) / (1024.0 * 1024.0);

    compute_percentiles(sample_ns, metric);
    return metric;
}

BenchmarkMetric BenchmarkSuite::run_memcpy_benchmark(bool use_asm, size_t buffer_bytes, uint64_t iterations) {
    BenchmarkMetric metric;
    metric.id = use_asm ? "asm-memcpy" : "cpp-memcpy";
    metric.name = "Memory Copy (1MB Buffer)";
    metric.category = "Memory";
    metric.implementation = use_asm ? "Assembly (NASM)" : "C++ Fallback";
    metric.iterations = iterations;
    metric.input_size_bytes = buffer_bytes;
    metric.timestamp = get_iso_timestamp();

    std::vector<uint8_t> src(buffer_bytes);
    std::vector<uint8_t> dst(buffer_bytes, 0);

    // Fill source with pattern
    for (size_t i = 0; i < buffer_bytes; ++i) {
        src[i] = static_cast<uint8_t>(i & 0xFF);
    }

    // Verify correctness
    if (use_asm) {
        asm_memcpy(dst.data(), src.data(), buffer_bytes);
    } else {
        fallback_memcpy(dst.data(), src.data(), buffer_bytes);
    }
    metric.verified_correct = (std::memcmp(src.data(), dst.data(), buffer_bytes) == 0);

    // Warmup
    for (int w = 0; w < 3; ++w) {
        if (use_asm) {
            asm_memcpy(dst.data(), src.data(), buffer_bytes);
        } else {
            fallback_memcpy(dst.data(), src.data(), buffer_bytes);
        }
    }

    std::vector<double> sample_ns;
    sample_ns.reserve(iterations);

    auto start_all = std::chrono::steady_clock::now();

    for (uint64_t i = 0; i < iterations; ++i) {
        auto t0 = std::chrono::steady_clock::now();
        if (use_asm) {
            asm_memcpy(dst.data(), src.data(), buffer_bytes);
        } else {
            fallback_memcpy(dst.data(), src.data(), buffer_bytes);
        }
        auto t1 = std::chrono::steady_clock::now();
        sample_ns.push_back(std::chrono::duration<double, std::nano>(t1 - t0).count());
    }

    auto end_all = std::chrono::steady_clock::now();
    double total_sec = std::chrono::duration<double>(end_all - start_all).count();
    metric.duration_ms = total_sec * 1000.0;
    metric.throughput_ops_sec = total_sec > 0.0 ? iterations / total_sec : 0.0;
    double total_bytes = static_cast<double>(buffer_bytes) * iterations;
    metric.throughput_mb_sec = total_sec > 0.0 ? (total_bytes / (1024.0 * 1024.0)) / total_sec : 0.0;

    compute_percentiles(sample_ns, metric);
    return metric;
}

BenchmarkMetric BenchmarkSuite::run_byte_sum_benchmark(bool use_asm, size_t buffer_bytes, uint64_t iterations) {
    BenchmarkMetric metric;
    metric.id = use_asm ? "asm-byte-sum" : "cpp-byte-sum";
    metric.name = "Byte Array Summation";
    metric.category = "Memory";
    metric.implementation = use_asm ? "Assembly (NASM)" : "C++ Fallback";
    metric.iterations = iterations;
    metric.input_size_bytes = buffer_bytes;
    metric.timestamp = get_iso_timestamp();

    std::vector<uint8_t> data(buffer_bytes);
    for (size_t i = 0; i < buffer_bytes; ++i) {
        data[i] = static_cast<uint8_t>((i % 251) + 1);
    }

    uint64_t expected = fallback_byte_sum(data.data(), buffer_bytes);
    uint64_t actual = use_asm ? asm_byte_sum(data.data(), buffer_bytes) : expected;
    metric.verified_correct = (actual == expected);

    // Warmup
    volatile uint64_t dummy = 0;
    for (int w = 0; w < 3; ++w) {
        dummy = use_asm ? asm_byte_sum(data.data(), buffer_bytes) : fallback_byte_sum(data.data(), buffer_bytes);
    }

    std::vector<double> sample_ns;
    sample_ns.reserve(iterations);

    auto start_all = std::chrono::steady_clock::now();

    for (uint64_t i = 0; i < iterations; ++i) {
        auto t0 = std::chrono::steady_clock::now();
        dummy = use_asm ? asm_byte_sum(data.data(), buffer_bytes) : fallback_byte_sum(data.data(), buffer_bytes);
        auto t1 = std::chrono::steady_clock::now();
        sample_ns.push_back(std::chrono::duration<double, std::nano>(t1 - t0).count());
    }

    auto end_all = std::chrono::steady_clock::now();
    double total_sec = std::chrono::duration<double>(end_all - start_all).count();
    metric.duration_ms = total_sec * 1000.0;
    metric.throughput_ops_sec = total_sec > 0.0 ? iterations / total_sec : 0.0;
    double total_bytes = static_cast<double>(buffer_bytes) * iterations;
    metric.throughput_mb_sec = total_sec > 0.0 ? (total_bytes / (1024.0 * 1024.0)) / total_sec : 0.0;

    compute_percentiles(sample_ns, metric);
    return metric;
}

BenchmarkMetric BenchmarkSuite::run_simd_add_benchmark(bool use_asm, size_t float_count, uint64_t iterations) {
    BenchmarkMetric metric;
    metric.id = use_asm ? "asm-simd-add" : "cpp-simd-add";
    metric.name = "SIMD Vector Float Add";
    metric.category = "SIMD";
    metric.implementation = use_asm ? "Assembly (NASM SSE2)" : "C++ Fallback";
    metric.iterations = iterations;
    metric.input_size_bytes = float_count * sizeof(float);
    metric.timestamp = get_iso_timestamp();

    std::vector<float> a(float_count);
    std::vector<float> b(float_count);
    std::vector<float> out(float_count, 0.0f);

    for (size_t i = 0; i < float_count; ++i) {
        a[i] = static_cast<float>(i * 0.5f);
        b[i] = static_cast<float>(i * 1.5f);
    }

    // Verify correctness
    if (use_asm && CpuFeatureDetector::has_sse2()) {
        asm_simd_add_f32(a.data(), b.data(), out.data(), float_count);
    } else {
        fallback_simd_add_f32(a.data(), b.data(), out.data(), float_count);
    }

    bool correct = true;
    for (size_t i = 0; i < 100 && i < float_count; ++i) {
        float diff = std::abs(out[i] - (a[i] + b[i]));
        if (diff > 0.001f) {
            correct = false;
            break;
        }
    }
    metric.verified_correct = correct;

    // Warmup
    for (int w = 0; w < 3; ++w) {
        if (use_asm && CpuFeatureDetector::has_sse2()) {
            asm_simd_add_f32(a.data(), b.data(), out.data(), float_count);
        } else {
            fallback_simd_add_f32(a.data(), b.data(), out.data(), float_count);
        }
    }

    std::vector<double> sample_ns;
    sample_ns.reserve(iterations);

    auto start_all = std::chrono::steady_clock::now();

    for (uint64_t i = 0; i < iterations; ++i) {
        auto t0 = std::chrono::steady_clock::now();
        if (use_asm && CpuFeatureDetector::has_sse2()) {
            asm_simd_add_f32(a.data(), b.data(), out.data(), float_count);
        } else {
            fallback_simd_add_f32(a.data(), b.data(), out.data(), float_count);
        }
        auto t1 = std::chrono::steady_clock::now();
        sample_ns.push_back(std::chrono::duration<double, std::nano>(t1 - t0).count());
    }

    auto end_all = std::chrono::steady_clock::now();
    double total_sec = std::chrono::duration<double>(end_all - start_all).count();
    metric.duration_ms = total_sec * 1000.0;
    metric.throughput_ops_sec = total_sec > 0.0 ? iterations / total_sec : 0.0;
    double total_bytes = static_cast<double>(float_count * sizeof(float) * 3) * iterations; // 2 reads, 1 write
    metric.throughput_mb_sec = total_sec > 0.0 ? (total_bytes / (1024.0 * 1024.0)) / total_sec : 0.0;

    compute_percentiles(sample_ns, metric);
    return metric;
}

std::vector<BenchmarkMetric> BenchmarkSuite::run_all_safe(size_t scale) {
    if (scale == 0) scale = 1;
    std::vector<BenchmarkMetric> results;

    // 1. Integer Add (Asm vs C++)
    results.push_back(run_integer_add(true, 500000 * scale));
    results.push_back(run_integer_add(false, 500000 * scale));

    // 2. Memcpy (Asm vs C++)
    results.push_back(run_memcpy_benchmark(true, 524288 * scale, 30));
    results.push_back(run_memcpy_benchmark(false, 524288 * scale, 30));

    // 3. Byte Sum (Asm vs C++)
    results.push_back(run_byte_sum_benchmark(true, 524288 * scale, 30));
    results.push_back(run_byte_sum_benchmark(false, 524288 * scale, 30));

    // 4. SIMD Add (Asm vs C++)
    results.push_back(run_simd_add_benchmark(true, 131072 * scale, 50));
    results.push_back(run_simd_add_benchmark(false, 131072 * scale, 50));

    return results;
}

} // namespace gogreen
