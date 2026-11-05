#pragma once

#include "gogreen/binary/binary_file.hpp"
#include <vector>
#include <array>
#include <cstdint>
#include <cstddef>
#include <string>

namespace gogreen::binary {

struct EntropyBlock {
    size_t offset = 0;
    size_t size = 0;
    double entropy = 0.0;
};

struct EntropyReport {
    double overall_entropy = 0.0;
    double chi_square = 0.0;
    double mean_byte_value = 0.0;
    std::array<uint64_t, 256> byte_distribution{};
    std::vector<EntropyBlock> block_profile;
    std::string assessment; // Standard uncompressed, packed/compressed, high randomness
};

class EntropyAnalyzer {
public:
    static double calculate_entropy(const uint8_t* data, size_t size);
    static EntropyReport analyze(const BinaryBuffer& buffer, size_t block_size = 512);
};

} // namespace gogreen::binary
