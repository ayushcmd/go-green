#pragma once

#include "gogreen/binary/binary_file.hpp"
#include <vector>
#include <string>
#include <cstdint>
#include <cstddef>

namespace gogreen::binary {

struct ExtractedString {
    size_t offset = 0;
    size_t length = 0;
    std::string value;
    std::string category; // Path, URL, Format, SymbolRef, General
};

class StringExtractor {
public:
    static std::vector<ExtractedString> extract(
        const BinaryBuffer& buffer,
        size_t min_length = 4,
        size_t max_count = 2000);
};

} // namespace gogreen::binary
