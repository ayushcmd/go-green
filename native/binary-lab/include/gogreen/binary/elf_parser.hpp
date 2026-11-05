#pragma once

#include "gogreen/binary/binary_file.hpp"
#include "gogreen/binary/format_detector.hpp"
#include <vector>
#include <string>
#include <cstdint>

namespace gogreen::binary {

struct ElfProgramHeader {
    uint32_t type = 0;
    std::string type_name;
    uint32_t flags = 0;
    std::string flags_string;
    uint64_t offset = 0;
    uint64_t virtual_address = 0;
    uint64_t physical_address = 0;
    uint64_t file_size = 0;
    uint64_t memory_size = 0;
    uint64_t alignment = 0;
};

struct ElfSectionHeader {
    uint32_t index = 0;
    std::string name;
    uint32_t type = 0;
    std::string type_name;
    uint64_t flags = 0;
    uint64_t virtual_address = 0;
    uint64_t offset = 0;
    uint64_t size = 0;
    uint32_t link = 0;
    uint32_t info = 0;
    uint64_t alignment = 0;
    uint64_t entry_size = 0;
    double entropy = 0.0;
    bool is_executable = false;
    bool is_writable = false;
    bool is_allocated = false;
};

struct ElfDynamicEntry {
    int64_t tag = 0;
    std::string tag_name;
    uint64_t value = 0;
    std::string string_value;
};

struct ElfAnalysisReport {
    bool valid = false;
    std::string error_message;
    bool is_64bit = true;
    Endianness endianness = Endianness::LITTLE;
    std::string os_abi;
    uint32_t elf_type = 0;
    std::string elf_type_name;
    uint32_t machine = 0;
    std::string machine_name;
    uint64_t entry_point = 0;
    uint64_t program_header_offset = 0;
    uint16_t program_header_count = 0;
    uint64_t section_header_offset = 0;
    uint16_t section_header_count = 0;
    uint16_t string_table_index = 0;

    std::vector<ElfProgramHeader> program_headers;
    std::vector<ElfSectionHeader> section_headers;
    std::vector<ElfDynamicEntry> dynamic_entries;
    std::vector<std::string> shared_dependencies; // DT_NEEDED
    std::string interpreter; // PT_INTERP
};

class ElfParser {
public:
    static ElfAnalysisReport parse(const BinaryBuffer& buffer);
};

} // namespace gogreen::binary
