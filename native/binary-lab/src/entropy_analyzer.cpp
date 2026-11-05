#include "gogreen/binary/entropy_analyzer.hpp"
#include <cmath>
#include <numeric>

namespace gogreen::binary {

double EntropyAnalyzer::calculate_entropy(const uint8_t* data, size_t size) {
    if (data == nullptr || size == 0) {
        return 0.0;
    }

    std::array<uint64_t, 256> counts{};
    for (size_t i = 0; i < size; ++i) {
        counts[data[i]]++;
    }

    double entropy = 0.0;
    const double total = static_cast<double>(size);
    for (size_t i = 0; i < 256; ++i) {
        if (counts[i] > 0) {
            double p = static_cast<double>(counts[i]) / total;
            entropy -= p * (std::log(p) / std::log(2.0));
        }
    }
    return entropy;
}

EntropyReport EntropyAnalyzer::analyze(const BinaryBuffer& buffer, size_t block_size) {
    EntropyReport report;
    if (buffer.empty()) {
        report.assessment = "Empty Buffer";
        return report;
    }

    const uint8_t* data = buffer.data();
    size_t size = buffer.size();

    // 1. Overall Entropy and Distribution
    uint64_t byte_sum = 0;
    for (size_t i = 0; i < size; ++i) {
        report.byte_distribution[data[i]]++;
        byte_sum += data[i];
    }

    double entropy = 0.0;
    const double total = static_cast<double>(size);
    double expected_per_byte = total / 256.0;
    double chi_sq = 0.0;

    for (size_t i = 0; i < 256; ++i) {
        if (report.byte_distribution[i] > 0) {
            double p = static_cast<double>(report.byte_distribution[i]) / total;
            entropy -= p * (std::log(p) / std::log(2.0));
        }
        double diff = static_cast<double>(report.byte_distribution[i]) - expected_per_byte;
        if (expected_per_byte > 0.0) {
            chi_sq += (diff * diff) / expected_per_byte;
        }
    }

    report.overall_entropy = entropy;
    report.chi_square = chi_sq;
    report.mean_byte_value = static_cast<double>(byte_sum) / total;

    // 2. Sliding Block Profile
    if (block_size == 0) {
        block_size = 512;
    }
    for (size_t offset = 0; offset < size; offset += block_size) {
        size_t current_block_size = std::min(block_size, size - offset);
        double block_ent = calculate_entropy(data + offset, current_block_size);
        report.block_profile.push_back(EntropyBlock{
            .offset = offset,
            .size = current_block_size,
            .entropy = block_ent
        });
    }

    // 3. Assessment based on standard information theory
    if (report.overall_entropy > 7.3) {
        report.assessment = "High Entropy (Consistent with compressed resources or dense byte blocks)";
    } else if (report.overall_entropy >= 5.0) {
        report.assessment = "Standard Density (Typical compiled machine code, symbol tables & metadata)";
    } else {
        report.assessment = "Low Entropy (Sparse data, text sections, or zero-padded regions)";
    }

    return report;
}

} // namespace gogreen::binary
