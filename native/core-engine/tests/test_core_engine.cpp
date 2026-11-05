#include "gogreen/cpu_info.hpp"
#include "gogreen/cpu_features.hpp"
#include "gogreen/hardware_info.hpp"
#include "gogreen/benchmark.hpp"
#include "gogreen/engine.hpp"
#include <iostream>
#include <cassert>
#include <cmath>

#define ASSERT_TRUE(cond) \
    do { \
        if (!(cond)) { \
            std::cerr << "Assertion FAILED: " #cond " at " << __FILE__ << ":" << __LINE__ << std::endl; \
            std::exit(1); \
        } \
    } while (0)

#define ASSERT_FALSE(cond) ASSERT_TRUE(!(cond))

void test_cpu_info() {
    std::cout << "[TEST] Running test_cpu_info...\n";
    auto cpu = gogreen::CpuInfo::detect();

    ASSERT_FALSE(cpu.vendor.empty());
    ASSERT_TRUE(cpu.architecture == "x86_64" || cpu.architecture == "aarch64");
    ASSERT_TRUE(cpu.logical_cores >= 1);
    ASSERT_TRUE(cpu.physical_cores >= 1);
    ASSERT_FALSE(cpu.brand_string.empty());
    ASSERT_TRUE(cpu.cache.l1d_kb > 0);

    std::string json = cpu.to_json();
    ASSERT_TRUE(json.find("\"vendor\"") != std::string::npos);
    ASSERT_TRUE(json.find("\"logical_cores\"") != std::string::npos);

    std::cout << "  -> CPU: " << cpu.brand_string << " (" << cpu.physical_cores << "P/" << cpu.logical_cores << "L cores)\n";
    std::cout << "[PASS] test_cpu_info passed.\n";
}

void test_cpu_features() {
    std::cout << "[TEST] Running test_cpu_features...\n";
    auto features = gogreen::CpuFeatureDetector::detect_all();
    ASSERT_FALSE(features.empty());

    bool found_sse2 = false;
    for (const auto& f : features) {
        if (f.name == "SSE2") {
            found_sse2 = true;
            ASSERT_TRUE(f.hw_supported);
            ASSERT_TRUE(f.active);
        }
    }
    ASSERT_TRUE(found_sse2);

    // If AVX is active, OSXSAVE and XCR0 must be enabled
    if (gogreen::CpuFeatureDetector::has_avx()) {
        ASSERT_TRUE(gogreen::CpuFeatureDetector::check_os_xsave());
        uint64_t xcr0 = gogreen::CpuFeatureDetector::read_xcr0();
        ASSERT_TRUE((xcr0 & 0x06) == 0x06);
    }

    std::cout << "  -> Detected " << features.size() << " feature flags\n";
    std::cout << "[PASS] test_cpu_features passed.\n";
}

void test_hardware_info() {
    std::cout << "[TEST] Running test_hardware_info...\n";
    auto hw = gogreen::HardwareInfo::detect();

    ASSERT_TRUE(hw.os_name == "Linux");
    ASSERT_FALSE(hw.hostname.empty());
    ASSERT_TRUE(hw.memory.total_bytes > 0);
    ASSERT_TRUE(hw.memory.free_bytes <= hw.memory.total_bytes);

    std::string json = hw.to_json();
    ASSERT_TRUE(json.find("\"runtime_environment\"") != std::string::npos);
    ASSERT_TRUE(json.find("\"memory\"") != std::string::npos);

    std::cout << "  -> Environment: " << hw.runtime_environment << " on kernel " << hw.os_release << "\n";
    std::cout << "  -> Total RAM: " << (hw.memory.total_bytes / (1024 * 1024)) << " MB\n";
    std::cout << "[PASS] test_hardware_info passed.\n";
}

void test_benchmarks() {
    std::cout << "[TEST] Running test_benchmarks...\n";

    // 1. Integer Add
    auto asm_add_m = gogreen::BenchmarkSuite::run_integer_add(true, 10000);
    auto cpp_add_m = gogreen::BenchmarkSuite::run_integer_add(false, 10000);
    ASSERT_TRUE(asm_add_m.verified_correct);
    ASSERT_TRUE(cpp_add_m.verified_correct);
    ASSERT_TRUE(asm_add_m.duration_ms > 0.0);

    // 2. Memcpy
    auto asm_cpy = gogreen::BenchmarkSuite::run_memcpy_benchmark(true, 65536, 10);
    auto cpp_cpy = gogreen::BenchmarkSuite::run_memcpy_benchmark(false, 65536, 10);
    ASSERT_TRUE(asm_cpy.verified_correct);
    ASSERT_TRUE(cpp_cpy.verified_correct);
    ASSERT_TRUE(asm_cpy.throughput_mb_sec > 0.0);

    // 3. Byte Sum
    auto asm_sum = gogreen::BenchmarkSuite::run_byte_sum_benchmark(true, 65536, 10);
    auto cpp_sum = gogreen::BenchmarkSuite::run_byte_sum_benchmark(false, 65536, 10);
    ASSERT_TRUE(asm_sum.verified_correct);
    ASSERT_TRUE(cpp_sum.verified_correct);

    // 4. SIMD Add
    auto asm_simd = gogreen::BenchmarkSuite::run_simd_add_benchmark(true, 16384, 10);
    auto cpp_simd = gogreen::BenchmarkSuite::run_simd_add_benchmark(false, 16384, 10);
    ASSERT_TRUE(asm_simd.verified_correct);
    ASSERT_TRUE(cpp_simd.verified_correct);

    std::cout << "  -> Asm Memcpy Throughput: " << asm_cpy.throughput_mb_sec << " MB/s\n";
    std::cout << "  -> C++ Memcpy Throughput: " << cpp_cpy.throughput_mb_sec << " MB/s\n";
    std::cout << "[PASS] test_benchmarks passed.\n";
}

void test_engine_lifecycle() {
    std::cout << "[TEST] Running test_engine_lifecycle...\n";
    auto& engine = gogreen::Engine::instance();

    ASSERT_TRUE(engine.initialize());
    ASSERT_TRUE(engine.is_initialized());

    std::string health = engine.get_health_json();
    ASSERT_TRUE(health.find("\"healthy\"") != std::string::npos);

    std::string status = engine.get_status_json();
    ASSERT_TRUE(status.find("\"ONLINE\"") != std::string::npos);

    std::string telemetry = engine.get_telemetry_json();
    ASSERT_TRUE(telemetry.find("\"load_1m\"") != std::string::npos);

    auto metric = engine.run_single_benchmark("memcpy", true);
    ASSERT_TRUE(metric.verified_correct);
    ASSERT_TRUE(engine.get_benchmark_history().size() >= 1);

    std::cout << "[PASS] test_engine_lifecycle passed.\n";
}

int main() {
    std::cout << "========================================\n";
    std::cout << "  RUNNING GOGREEN NATIVE ENGINE TESTS   \n";
    std::cout << "========================================\n";

    test_cpu_info();
    test_cpu_features();
    test_hardware_info();
    test_benchmarks();
    test_engine_lifecycle();

    std::cout << "\n>>> ALL NATIVE ENGINE TESTS PASSED! <<<\n";
    return 0;
}
