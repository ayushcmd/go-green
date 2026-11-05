#pragma once

#include "gogreen/binary/binary_file.hpp"
#include "gogreen/binary/elf_parser.hpp"
#include "gogreen/binary/pe_parser.hpp"
#include <vector>
#include <string>
#include <cstdint>

namespace gogreen::binary {

enum class SymbolType {
    UNKNOWN,
    FUNCTION,
    DATA_OBJECT,
    SECTION,
    FILE,
    NOTYPE
};

enum class SymbolBinding {
    LOCAL,
    GLOBAL,
    WEAK
};

struct SymbolEntry {
    std::string name;
    uint64_t address = 0;
    uint64_t size = 0;
    SymbolType type = SymbolType::UNKNOWN;
    std::string type_name = "UNKNOWN";
    SymbolBinding binding = SymbolBinding::GLOBAL;
    std::string binding_name = "GLOBAL";
    std::string section_name;
    uint16_t section_index = 0;
    bool is_imported = false;
    bool is_exported = false;
    bool is_undefined = false;
    std::string source_table; // SYMTAB, DYNSYM, PE_EXPORT, PE_IMPORT
};

class SymbolAnalyzer {
public:
    static std::vector<SymbolEntry> extract_symbols(
        const BinaryBuffer& buffer,
        const ElfAnalysisReport& elf_report);

    static std::vector<SymbolEntry> extract_symbols(
        const BinaryBuffer& buffer,
        const PeAnalysisReport& pe_report);
};

} // namespace gogreen::binary
