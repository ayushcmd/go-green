#pragma once

#include "gogreen/binary/binary_file.hpp"
#include "gogreen/binary/elf_parser.hpp"
#include "gogreen/binary/pe_parser.hpp"
#include "gogreen/binary/symbol_analyzer.hpp"
#include <vector>
#include <string>
#include <cstdint>

namespace gogreen::binary {

struct RelocationRecord {
    uint64_t offset = 0;
    uint32_t type = 0;
    std::string type_name;
    uint32_t symbol_index = 0;
    std::string symbol_name;
    int64_t addend = 0;
    std::string section_name;
};

class RelocationAnalyzer {
public:
    static std::vector<RelocationRecord> extract_relocations(
        const BinaryBuffer& buffer,
        const ElfAnalysisReport& elf_report,
        const std::vector<SymbolEntry>& symbols);

    static std::vector<RelocationRecord> extract_relocations(
        const PeAnalysisReport& pe_report);
};

} // namespace gogreen::binary
