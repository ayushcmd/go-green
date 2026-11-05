#include "gogreen/binary/symbol_analyzer.hpp"

namespace gogreen::binary {

namespace {

SymbolType elf_type_to_symbol_type(uint8_t type) {
    switch (type) {
        case 1: return SymbolType::DATA_OBJECT;
        case 2: return SymbolType::FUNCTION;
        case 3: return SymbolType::SECTION;
        case 4: return SymbolType::FILE;
        default: return SymbolType::NOTYPE;
    }
}

std::string get_symbol_type_name(SymbolType type) {
    switch (type) {
        case SymbolType::FUNCTION: return "FUNC";
        case SymbolType::DATA_OBJECT: return "OBJECT";
        case SymbolType::SECTION: return "SECTION";
        case SymbolType::FILE: return "FILE";
        case SymbolType::NOTYPE: return "NOTYPE";
        default: return "UNKNOWN";
    }
}

SymbolBinding elf_bind_to_symbol_binding(uint8_t bind) {
    switch (bind) {
        case 0: return SymbolBinding::LOCAL;
        case 1: return SymbolBinding::GLOBAL;
        case 2: return SymbolBinding::WEAK;
        default: return SymbolBinding::GLOBAL;
    }
}

std::string get_symbol_binding_name(SymbolBinding bind) {
    switch (bind) {
        case SymbolBinding::LOCAL: return "LOCAL";
        case SymbolBinding::GLOBAL: return "GLOBAL";
        case SymbolBinding::WEAK: return "WEAK";
    }
    return "GLOBAL";
}

} // namespace

std::vector<SymbolEntry> SymbolAnalyzer::extract_symbols(
    const BinaryBuffer& buffer,
    const ElfAnalysisReport& elf_report) {

    std::vector<SymbolEntry> symbols;
    if (!elf_report.valid || !elf_report.is_64bit) {
        return symbols;
    }

    bool is_le = (elf_report.endianness == Endianness::LITTLE);

    for (const auto& sec : elf_report.section_headers) {
        if (sec.type == 2 || sec.type == 11) { // SHT_SYMTAB or SHT_DYNSYM
            std::string source = (sec.type == 2) ? "SYMTAB" : "DYNSYM";
            uint32_t strtab_idx = sec.link;

            const ElfSectionHeader* strtab_sec = nullptr;
            for (const auto& s : elf_report.section_headers) {
                if (s.index == strtab_idx) {
                    strtab_sec = &s;
                    break;
                }
            }

            size_t entry_size = sec.entry_size > 0 ? sec.entry_size : 24;
            if (entry_size < 24 || !buffer.has_bytes(sec.offset, sec.size)) {
                continue;
            }

            size_t count = sec.size / entry_size;
            for (size_t i = 0; i < count; ++i) {
                size_t sym_off = sec.offset + i * entry_size;
                if (!buffer.has_bytes(sym_off, 24)) {
                    break;
                }

                uint32_t st_name = is_le ? buffer.read_u32_le(sym_off) : buffer.read_u32_be(sym_off);
                uint8_t st_info = buffer.read_u8(sym_off + 4);
                uint16_t st_shndx = is_le ? buffer.read_u16_le(sym_off + 6) : buffer.read_u16_be(sym_off + 6);
                uint64_t st_value = is_le ? buffer.read_u64_le(sym_off + 8) : buffer.read_u64_be(sym_off + 8);
                uint64_t st_size = is_le ? buffer.read_u64_le(sym_off + 16) : buffer.read_u64_be(sym_off + 16);

                uint8_t bind = st_info >> 4;
                uint8_t type = st_info & 0x0F;

                SymbolEntry entry;
                entry.address = st_value;
                entry.size = st_size;
                entry.type = elf_type_to_symbol_type(type);
                entry.type_name = get_symbol_type_name(entry.type);
                entry.binding = elf_bind_to_symbol_binding(bind);
                entry.binding_name = get_symbol_binding_name(entry.binding);
                entry.section_index = st_shndx;
                entry.is_undefined = (st_shndx == 0); // SHN_UNDEF
                entry.source_table = source;

                if (st_shndx < elf_report.section_headers.size()) {
                    entry.section_name = elf_report.section_headers[st_shndx].name;
                }

                if (strtab_sec && strtab_sec->offset < buffer.size() && st_name < strtab_sec->size) {
                    entry.name = buffer.read_null_terminated_string(strtab_sec->offset + st_name, 256);
                }
                if (entry.name.empty()) {
                    entry.name = (entry.type == SymbolType::SECTION) ? entry.section_name : "";
                }

                if (!entry.name.empty()) {
                    symbols.push_back(entry);
                }
            }
        }
    }

    return symbols;
}

std::vector<SymbolEntry> SymbolAnalyzer::extract_symbols(
    const BinaryBuffer& /*buffer*/,
    const PeAnalysisReport& pe_report) {

    std::vector<SymbolEntry> symbols;
    if (!pe_report.valid) {
        return symbols;
    }

    // 1. Exported Symbols
    for (const auto& exp : pe_report.export_directory.functions) {
        SymbolEntry entry;
        entry.name = exp.name;
        entry.address = pe_report.image_base + exp.rva;
        entry.type = SymbolType::FUNCTION;
        entry.type_name = "FUNC";
        entry.binding = SymbolBinding::GLOBAL;
        entry.binding_name = "GLOBAL";
        entry.is_exported = true;
        entry.source_table = "PE_EXPORT";
        symbols.push_back(entry);
    }

    // 2. Imported Symbols
    for (const auto& mod : pe_report.imports) {
        for (const auto& fn : mod.functions) {
            SymbolEntry entry;
            entry.name = fn.name;
            entry.type = SymbolType::FUNCTION;
            entry.type_name = "FUNC";
            entry.binding = SymbolBinding::GLOBAL;
            entry.binding_name = "GLOBAL";
            entry.is_imported = true;
            entry.is_undefined = true;
            entry.section_name = mod.module_name;
            entry.source_table = "PE_IMPORT";
            symbols.push_back(entry);
        }
    }

    return symbols;
}

} // namespace gogreen::binary
