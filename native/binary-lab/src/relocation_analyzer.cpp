#include "gogreen/binary/relocation_analyzer.hpp"
#include <iomanip>
#include <sstream>

namespace gogreen::binary {

namespace {

std::string get_x86_64_reloc_name(uint32_t type) {
    switch (type) {
        case 0: return "R_X86_64_NONE";
        case 1: return "R_X86_64_64";
        case 2: return "R_X86_64_PC32";
        case 3: return "R_X86_64_GOT32";
        case 4: return "R_X86_64_PLT32";
        case 5: return "R_X86_64_COPY";
        case 6: return "R_X86_64_GLOB_DAT";
        case 7: return "R_X86_64_JUMP_SLOT";
        case 8: return "R_X86_64_RELATIVE";
        case 9: return "R_X86_64_GOTPCREL";
        case 10: return "R_X86_64_32";
        case 11: return "R_X86_64_32S";
        case 16: return "R_X86_64_DTPMOD64";
        case 17: return "R_X86_64_DTPOFF64";
        case 18: return "R_X86_64_TPOFF64";
        case 19: return "R_X86_64_TLSGD";
        case 24: return "R_X86_64_PC64";
        case 41: return "R_X86_64_GOTPCRELX";
        case 42: return "R_X86_64_REX_GOTPCRELX";
        default: return "R_X86_64_" + std::to_string(type);
    }
}

} // namespace

std::vector<RelocationRecord> RelocationAnalyzer::extract_relocations(
    const BinaryBuffer& buffer,
    const ElfAnalysisReport& elf_report,
    const std::vector<SymbolEntry>& symbols) {
    std::vector<RelocationRecord> records;
    const bool is_64 = elf_report.is_64bit;

    for (const auto& sec : elf_report.section_headers) {
        // SHT_REL = 9, SHT_RELA = 4
        if (sec.type != 4 && sec.type != 9) {
            continue;
        }

        const bool has_addend = (sec.type == 4);
        const size_t entry_size = is_64 ? (has_addend ? 24 : 16) : (has_addend ? 12 : 8);
        if (entry_size == 0 || sec.size == 0) continue;

        const size_t num_entries = sec.size / entry_size;

        for (size_t i = 0; i < num_entries; ++i) {
            size_t entry_offset = sec.offset + i * entry_size;
            if (!buffer.has_bytes(entry_offset, entry_size)) break;

            RelocationRecord rec;
            rec.section_name = sec.name;

            if (is_64) {
                rec.offset = buffer.read_u64_le(entry_offset);
                uint64_t r_info = buffer.read_u64_le(entry_offset + 8);
                rec.symbol_index = static_cast<uint32_t>(r_info >> 32);
                rec.type = static_cast<uint32_t>(r_info & 0xffffffff);
                if (has_addend) {
                    rec.addend = static_cast<int64_t>(buffer.read_u64_le(entry_offset + 16));
                }
            } else {
                rec.offset = buffer.read_u32_le(entry_offset);
                uint32_t r_info = buffer.read_u32_le(entry_offset + 4);
                rec.symbol_index = r_info >> 8;
                rec.type = r_info & 0xff;
                if (has_addend) {
                    rec.addend = static_cast<int32_t>(buffer.read_u32_le(entry_offset + 8));
                }
            }

            rec.type_name = get_x86_64_reloc_name(rec.type);

            // Correlate symbol name if in range
            if (rec.symbol_index < symbols.size()) {
                rec.symbol_name = symbols[rec.symbol_index].name;
            }

            records.push_back(std::move(rec));
        }
    }

    return records;
}

std::vector<RelocationRecord> RelocationAnalyzer::extract_relocations(
    const PeAnalysisReport& pe_report) {
    std::vector<RelocationRecord> records;

    for (const auto& entry : pe_report.relocations) {
        // Type 0 is IMAGE_REL_BASED_ABSOLUTE (padding/skip)
        if (entry.type == 0) continue;

        RelocationRecord rec;
        rec.offset = static_cast<uint64_t>(entry.page_rva) + entry.offset;
        rec.type = entry.type;
        rec.type_name = entry.type_name;
        rec.section_name = ".reloc";
        rec.symbol_index = 0;
        rec.addend = 0;
        records.push_back(std::move(rec));
    }

    return records;
}

} // namespace gogreen::binary
