#include "gogreen/binary/elf_parser.hpp"
#include "gogreen/binary/entropy_analyzer.hpp"
#include <map>

namespace gogreen::binary {

namespace {

std::string get_elf_type_name(uint16_t type) {
    switch (type) {
        case 0: return "ET_NONE (Unknown)";
        case 1: return "ET_REL (Relocatable object)";
        case 2: return "ET_EXEC (Executable binary)";
        case 3: return "ET_DYN (Shared object / PIE)";
        case 4: return "ET_CORE (Core dump)";
        default: return "ET_OTHER (" + std::to_string(type) + ")";
    }
}

std::string get_ph_type_name(uint32_t type) {
    switch (type) {
        case 0: return "PT_NULL";
        case 1: return "PT_LOAD";
        case 2: return "PT_DYNAMIC";
        case 3: return "PT_INTERP";
        case 4: return "PT_NOTE";
        case 5: return "PT_SHLIB";
        case 6: return "PT_PHDR";
        case 7: return "PT_TLS";
        case 0x6474e550: return "PT_GNU_EH_FRAME";
        case 0x6474e551: return "PT_GNU_STACK";
        case 0x6474e552: return "PT_GNU_RELRO";
        default: return "PT_OTHER (" + std::to_string(type) + ")";
    }
}

std::string get_sh_type_name(uint32_t type) {
    switch (type) {
        case 0: return "SHT_NULL";
        case 1: return "SHT_PROGBITS";
        case 2: return "SHT_SYMTAB";
        case 3: return "SHT_STRTAB";
        case 4: return "SHT_RELA";
        case 5: return "SHT_HASH";
        case 6: return "SHT_DYNAMIC";
        case 7: return "SHT_NOTE";
        case 8: return "SHT_NOBITS";
        case 9: return "SHT_REL";
        case 10: return "SHT_SHLIB";
        case 11: return "SHT_DYNSYM";
        case 14: return "SHT_INIT_ARRAY";
        case 15: return "SHT_FINI_ARRAY";
        case 0x6ffffff6: return "SHT_GNU_HASH";
        case 0x6ffffffd: return "SHT_GNU_verdef";
        case 0x6ffffffe: return "SHT_GNU_verneed";
        case 0x6fffffff: return "SHT_GNU_versym";
        default: return "SHT_OTHER (" + std::to_string(type) + ")";
    }
}

std::string get_ph_flags_string(uint32_t flags) {
    std::string s;
    s += (flags & 4) ? 'R' : '-';
    s += (flags & 2) ? 'W' : '-';
    s += (flags & 1) ? 'X' : '-';
    return s;
}

std::string get_machine_name(uint16_t machine) {
    switch (machine) {
        case 0x03: return "x86 (Intel 80386)";
        case 0x3E: return "x86-64 (AMD64)";
        case 0x28: return "ARM (32-bit)";
        case 0xB7: return "AArch64 (ARM 64-bit)";
        case 0xF3: return "RISC-V";
        default: return "Unknown Machine (" + std::to_string(machine) + ")";
    }
}

} // namespace

ElfAnalysisReport ElfParser::parse(const BinaryBuffer& buffer) {
    ElfAnalysisReport report;
    if (buffer.size() < 16) {
        report.valid = false;
        report.error_message = "Buffer too small for ELF header identification (minimum 16 bytes)";
        return report;
    }

    if (buffer.read_u8(0) != 0x7F ||
        buffer.read_u8(1) != 'E' ||
        buffer.read_u8(2) != 'L' ||
        buffer.read_u8(3) != 'F') {
        report.valid = false;
        report.error_message = "Invalid ELF magic bytes (expected 0x7F 'E' 'L' 'F')";
        return report;
    }

    uint8_t elf_class = buffer.read_u8(4);
    uint8_t elf_data = buffer.read_u8(5);
    report.is_64bit = (elf_class == 2);
    report.endianness = (elf_data == 2) ? Endianness::BIG : Endianness::LITTLE;
    bool is_le = (report.endianness == Endianness::LITTLE);

    uint8_t os_abi_byte = buffer.read_u8(7);
    switch (os_abi_byte) {
        case 0: report.os_abi = "System V (Linux/FreeBSD/etc.)"; break;
        case 3: report.os_abi = "Linux ABI"; break;
        default: report.os_abi = "ABI (" + std::to_string(os_abi_byte) + ")"; break;
    }

    // Header size check
    size_t min_header_size = report.is_64bit ? 64 : 52;
    if (buffer.size() < min_header_size) {
        report.valid = false;
        report.error_message = "Truncated ELF header: expected at least " +
            std::to_string(min_header_size) + " bytes, got " + std::to_string(buffer.size());
        return report;
    }

    if (report.is_64bit) {
        report.elf_type = is_le ? buffer.read_u16_le(16) : buffer.read_u16_be(16);
        report.machine = is_le ? buffer.read_u16_le(18) : buffer.read_u16_be(18);
        report.entry_point = is_le ? buffer.read_u64_le(24) : buffer.read_u64_be(24);
        report.program_header_offset = is_le ? buffer.read_u64_le(32) : buffer.read_u64_be(32);
        report.section_header_offset = is_le ? buffer.read_u64_le(40) : buffer.read_u64_be(40);
        uint16_t phentsize = is_le ? buffer.read_u16_le(54) : buffer.read_u16_be(54);
        report.program_header_count = is_le ? buffer.read_u16_le(56) : buffer.read_u16_be(56);
        uint16_t shentsize = is_le ? buffer.read_u16_le(58) : buffer.read_u16_be(58);
        report.section_header_count = is_le ? buffer.read_u16_le(60) : buffer.read_u16_be(60);
        report.string_table_index = is_le ? buffer.read_u16_le(62) : buffer.read_u16_be(62);

        report.elf_type_name = get_elf_type_name(static_cast<uint16_t>(report.elf_type));
        report.machine_name = get_machine_name(static_cast<uint16_t>(report.machine));

        // 1. Program Headers
        if (report.program_header_offset > 0 && report.program_header_count > 0 && phentsize >= 56) {
            for (uint16_t i = 0; i < report.program_header_count; ++i) {
                size_t ph_off = report.program_header_offset + (static_cast<size_t>(i) * phentsize);
                if (!buffer.has_bytes(ph_off, 56)) {
                    break;
                }
                ElfProgramHeader ph;
                ph.type = is_le ? buffer.read_u32_le(ph_off) : buffer.read_u32_be(ph_off);
                ph.flags = is_le ? buffer.read_u32_le(ph_off + 4) : buffer.read_u32_be(ph_off + 4);
                ph.offset = is_le ? buffer.read_u64_le(ph_off + 8) : buffer.read_u64_be(ph_off + 8);
                ph.virtual_address = is_le ? buffer.read_u64_le(ph_off + 16) : buffer.read_u64_be(ph_off + 16);
                ph.physical_address = is_le ? buffer.read_u64_le(ph_off + 24) : buffer.read_u64_be(ph_off + 24);
                ph.file_size = is_le ? buffer.read_u64_le(ph_off + 32) : buffer.read_u64_be(ph_off + 32);
                ph.memory_size = is_le ? buffer.read_u64_le(ph_off + 40) : buffer.read_u64_be(ph_off + 40);
                ph.alignment = is_le ? buffer.read_u64_le(ph_off + 48) : buffer.read_u64_be(ph_off + 48);
                ph.type_name = get_ph_type_name(ph.type);
                ph.flags_string = get_ph_flags_string(ph.flags);

                if (ph.type == 3 && ph.offset < buffer.size()) { // PT_INTERP
                    report.interpreter = buffer.read_null_terminated_string(ph.offset, 256);
                }
                report.program_headers.push_back(ph);
            }
        }

        // 2. Section Headers
        if (report.section_header_offset > 0 && report.section_header_count > 0 && shentsize >= 64) {
            std::vector<ElfSectionHeader> raw_sections;
            for (uint16_t i = 0; i < report.section_header_count; ++i) {
                size_t sh_off = report.section_header_offset + (static_cast<size_t>(i) * shentsize);
                if (!buffer.has_bytes(sh_off, 64)) {
                    break;
                }
                ElfSectionHeader sh;
                sh.index = i;
                uint32_t name_offset = is_le ? buffer.read_u32_le(sh_off) : buffer.read_u32_be(sh_off);
                sh.type = is_le ? buffer.read_u32_le(sh_off + 4) : buffer.read_u32_be(sh_off + 4);
                sh.flags = is_le ? buffer.read_u64_le(sh_off + 8) : buffer.read_u64_be(sh_off + 8);
                sh.virtual_address = is_le ? buffer.read_u64_le(sh_off + 16) : buffer.read_u64_be(sh_off + 16);
                sh.offset = is_le ? buffer.read_u64_le(sh_off + 24) : buffer.read_u64_be(sh_off + 24);
                sh.size = is_le ? buffer.read_u64_le(sh_off + 32) : buffer.read_u64_be(sh_off + 32);
                sh.link = is_le ? buffer.read_u32_le(sh_off + 40) : buffer.read_u32_be(sh_off + 40);
                sh.info = is_le ? buffer.read_u32_le(sh_off + 44) : buffer.read_u32_be(sh_off + 44);
                sh.alignment = is_le ? buffer.read_u64_le(sh_off + 48) : buffer.read_u64_be(sh_off + 48);
                sh.entry_size = is_le ? buffer.read_u64_le(sh_off + 56) : buffer.read_u64_be(sh_off + 56);
                sh.type_name = get_sh_type_name(sh.type);
                sh.is_writable = (sh.flags & 1) != 0;
                sh.is_allocated = (sh.flags & 2) != 0;
                sh.is_executable = (sh.flags & 4) != 0;

                // Temporarily store name_offset
                sh.link = name_offset;

                // Compute section entropy
                if (sh.size > 0 && buffer.has_bytes(sh.offset, sh.size)) {
                    sh.entropy = EntropyAnalyzer::calculate_entropy(buffer.data() + sh.offset, sh.size);
                }
                raw_sections.push_back(sh);
            }

            // Resolve section names using .shstrtab
            if (report.string_table_index < raw_sections.size()) {
                const auto& strtab = raw_sections[report.string_table_index];
                if (strtab.offset < buffer.size()) {
                    for (auto& sec : raw_sections) {
                        uint32_t name_offset = sec.link; // restored name_offset
                        if (name_offset < strtab.size && buffer.has_bytes(strtab.offset + name_offset, 1)) {
                            sec.name = buffer.read_null_terminated_string(strtab.offset + name_offset, 128);
                        } else {
                            sec.name = (sec.index == 0) ? "" : "section_" + std::to_string(sec.index);
                        }
                    }
                }
            }
            report.section_headers = raw_sections;
        }
    }

    report.valid = true;
    return report;
}

} // namespace gogreen::binary
