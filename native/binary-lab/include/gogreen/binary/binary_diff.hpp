#pragma once

#include "gogreen/binary/binary_file.hpp"
#include "gogreen/binary/format_detector.hpp"
#include <vector>
#include <string>
#include <cstdint>
#include <cstddef>

namespace gogreen::binary {

struct ByteDiffChunk {
    size_t offset = 0;
    size_t length = 0;
    std::string hex_a;
    std::string hex_b;
};

struct SectionDiff {
    std::string name;
    std::string status; // IDENTICAL, MODIFIED, ADDED, REMOVED
    uint64_t size_a = 0;
    uint64_t size_b = 0;
    double entropy_a = 0.0;
    double entropy_b = 0.0;
};

struct SymbolDiff {
    std::string name;
    std::string change_type; // ADDED, REMOVED, MODIFIED
    uint64_t address_a = 0;
    uint64_t address_b = 0;
};

struct BinaryDiffReport {
    std::string file_a_name;
    std::string file_b_name;
    size_t size_a = 0;
    size_t size_b = 0;
    int64_t size_delta = 0;
    std::string sha256_a;
    std::string sha256_b;
    std::string format_a;
    std::string format_b;
    double similarity_percent = 0.0;
    size_t identical_bytes = 0;
    size_t different_bytes = 0;

    std::vector<ByteDiffChunk> byte_differences;
    std::vector<SectionDiff> section_differences;
    std::vector<SymbolDiff> symbol_differences;
    std::vector<std::string> added_imports;
    std::vector<std::string> removed_imports;
};

class BinaryDiff {
public:
    static BinaryDiffReport compare(
        const BinaryBuffer& buf_a, const std::string& name_a,
        const BinaryBuffer& buf_b, const std::string& name_b);
};

} // namespace gogreen::binary
