#include "gogreen/binary/string_extractor.hpp"

namespace gogreen::binary {

namespace {

bool is_printable(uint8_t b) noexcept {
    return (b >= 0x20 && b <= 0x7E) || b == '\t';
}

std::string classify_string(const std::string& str) {
    if (str.starts_with("http://") || str.starts_with("https://") || str.starts_with("ftp://")) {
        return "URL";
    }
    if (str.find('/') != std::string::npos || str.find('\\') != std::string::npos) {
        return "Path";
    }
    if (str.find("%s") != std::string::npos || str.find("%d") != std::string::npos ||
        str.find("%x") != std::string::npos || str.find("%p") != std::string::npos) {
        return "Format String";
    }
    if (str.starts_with("_Z") || str.starts_with("?") || str.starts_with("__")) {
        return "Symbol Identifier";
    }
    return "General";
}

} // namespace

std::vector<ExtractedString> StringExtractor::extract(
    const BinaryBuffer& buffer,
    size_t min_length,
    size_t max_count) {

    std::vector<ExtractedString> results;
    if (buffer.empty() || min_length == 0) {
        return results;
    }

    const uint8_t* data = buffer.data();
    size_t size = buffer.size();

    std::string current;
    size_t start_offset = 0;

    for (size_t i = 0; i < size; ++i) {
        uint8_t byte = data[i];
        if (is_printable(byte)) {
            if (current.empty()) {
                start_offset = i;
            }
            current.push_back(static_cast<char>(byte));
        } else {
            if (current.length() >= min_length) {
                results.push_back(ExtractedString{
                    .offset = start_offset,
                    .length = current.length(),
                    .value = current,
                    .category = classify_string(current)
                });
                if (results.size() >= max_count) {
                    break;
                }
            }
            current.clear();
        }
    }

    // Capture trailing string if buffer ended
    if (current.length() >= min_length && results.size() < max_count) {
        results.push_back(ExtractedString{
            .offset = start_offset,
            .length = current.length(),
            .value = current,
            .category = classify_string(current)
        });
    }

    return results;
}

} // namespace gogreen::binary
