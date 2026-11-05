#include "gogreen/binary/pe_parser.hpp"
#include "gogreen/binary/entropy_analyzer.hpp"

namespace gogreen::binary {

namespace {

const char* DATA_DIR_NAMES[] = {
    "Export Table", "Import Table", "Resource Table", "Exception Table",
    "Certificate Table", "Base Relocation Table", "Debug", "Architecture",
    "Global Ptr", "TLS Table", "Load Config Table", "Bound Import",
    "IAT", "Delay Import Descriptor", "CLR Runtime Header", "Reserved"
};

std::string get_pe_machine_name(uint16_t machine) {
    switch (machine) {
        case 0x014C: return "x86 (32-bit)";
        case 0x8664: return "x86-64 (AMD64)";
        case 0x0200: return "Intel Itanium";
        case 0xAA64: return "ARM64";
        case 0x01C0: return "ARM";
        default: return "Unknown (" + std::to_string(machine) + ")";
    }
}

std::string get_subsystem_name(uint16_t sub) {
    switch (sub) {
        case 1: return "Native (Kernel / Driver)";
        case 2: return "Windows GUI";
        case 3: return "Windows CUI (Console)";
        case 7: return "POSIX CUI";
        case 9: return "Windows CE GUI";
        case 10: return "EFI Application";
        case 14: return "Xbox";
        default: return "Subsystem (" + std::to_string(sub) + ")";
    }
}

} // namespace

uint32_t PeParser::rva_to_file_offset(uint32_t rva, const std::vector<PeSectionHeader>& sections) {
    for (const auto& sec : sections) {
        if (rva >= sec.virtual_address && rva < sec.virtual_address + sec.virtual_size) {
            uint32_t diff = rva - sec.virtual_address;
            return sec.raw_offset + diff;
        }
    }
    return 0;
}

PeAnalysisReport PeParser::parse(const BinaryBuffer& buffer) {
    PeAnalysisReport report;
    if (buffer.size() < 64) {
        report.valid = false;
        report.error_message = "Buffer too small for DOS header (minimum 64 bytes)";
        return report;
    }

    // 1. Validate DOS Header
    if (buffer.read_u8(0) != 'M' || buffer.read_u8(1) != 'Z') {
        report.valid = false;
        report.error_message = "Invalid DOS header magic (expected 'MZ')";
        return report;
    }

    uint32_t pe_offset = buffer.read_u32_le(0x3C);
    if (!buffer.has_bytes(pe_offset, 24)) {
        report.valid = false;
        report.error_message = "Invalid or truncated e_lfanew PE header offset";
        return report;
    }

    // 2. Validate PE Signature
    if (buffer.read_u8(pe_offset) != 'P' ||
        buffer.read_u8(pe_offset + 1) != 'E' ||
        buffer.read_u8(pe_offset + 2) != 0 ||
        buffer.read_u8(pe_offset + 3) != 0) {
        report.valid = false;
        report.error_message = "Invalid PE signature (expected 'PE\\0\\0')";
        return report;
    }

    // 3. COFF File Header
    size_t coff_off = pe_offset + 4;
    report.machine = buffer.read_u16_le(coff_off);
    report.section_count = buffer.read_u16_le(coff_off + 2);
    report.time_date_stamp = buffer.read_u32_le(coff_off + 4);
    uint16_t size_of_opt_header = buffer.read_u16_le(coff_off + 16);
    report.characteristics = buffer.read_u16_le(coff_off + 18);
    report.machine_name = get_pe_machine_name(report.machine);

    // 4. Optional Header
    size_t opt_off = coff_off + 20;
    if (size_of_opt_header > 0 && buffer.has_bytes(opt_off, std::min<size_t>(size_of_opt_header, 28))) {
        report.magic = buffer.read_u16_le(opt_off);
        report.is_pe32_plus = (report.magic == 0x020B);

        report.entry_point_rva = buffer.read_u32_le(opt_off + 16);

        if (report.is_pe32_plus) {
            if (buffer.has_bytes(opt_off, 112)) {
                report.image_base = buffer.read_u64_le(opt_off + 24);
                report.section_alignment = buffer.read_u32_le(opt_off + 32);
                report.file_alignment = buffer.read_u32_le(opt_off + 36);
                report.size_of_image = buffer.read_u32_le(opt_off + 56);
                report.size_of_headers = buffer.read_u32_le(opt_off + 60);
                report.subsystem = buffer.read_u16_le(opt_off + 68);
                report.dll_characteristics = buffer.read_u16_le(opt_off + 70);

                // Data Directories at opt_off + 112
                size_t dd_off = opt_off + 112;
                for (uint32_t i = 0; i < 16 && buffer.has_bytes(dd_off + i * 8, 8); ++i) {
                    uint32_t rva = buffer.read_u32_le(dd_off + i * 8);
                    uint32_t sz = buffer.read_u32_le(dd_off + i * 8 + 4);
                    report.data_directories.push_back(PeDataDirectory{
                        .index = i,
                        .name = (i < 16) ? DATA_DIR_NAMES[i] : "Custom",
                        .virtual_address = rva,
                        .size = sz
                    });
                }
            }
        } else {
            if (buffer.has_bytes(opt_off, 96)) {
                report.image_base = buffer.read_u32_le(opt_off + 28);
                report.section_alignment = buffer.read_u32_le(opt_off + 32);
                report.file_alignment = buffer.read_u32_le(opt_off + 36);
                report.size_of_image = buffer.read_u32_le(opt_off + 56);
                report.size_of_headers = buffer.read_u32_le(opt_off + 60);
                report.subsystem = buffer.read_u16_le(opt_off + 68);
                report.dll_characteristics = buffer.read_u16_le(opt_off + 70);

                size_t dd_off = opt_off + 96;
                for (uint32_t i = 0; i < 16 && buffer.has_bytes(dd_off + i * 8, 8); ++i) {
                    uint32_t rva = buffer.read_u32_le(dd_off + i * 8);
                    uint32_t sz = buffer.read_u32_le(dd_off + i * 8 + 4);
                    report.data_directories.push_back(PeDataDirectory{
                        .index = i,
                        .name = (i < 16) ? DATA_DIR_NAMES[i] : "Custom",
                        .virtual_address = rva,
                        .size = sz
                    });
                }
            }
        }
        report.subsystem_name = get_subsystem_name(static_cast<uint16_t>(report.subsystem));
    }

    // 5. Section Headers
    size_t sec_table_off = opt_off + size_of_opt_header;
    for (uint16_t i = 0; i < report.section_count && buffer.has_bytes(sec_table_off + i * 40, 40); ++i) {
        size_t s_off = sec_table_off + i * 40;
        PeSectionHeader sec;
        sec.name = buffer.read_fixed_string(s_off, 8);
        sec.virtual_size = buffer.read_u32_le(s_off + 8);
        sec.virtual_address = buffer.read_u32_le(s_off + 12);
        sec.raw_size = buffer.read_u32_le(s_off + 16);
        sec.raw_offset = buffer.read_u32_le(s_off + 20);
        sec.characteristics = buffer.read_u32_le(s_off + 36);

        sec.is_executable = (sec.characteristics & 0x20000000) != 0;
        sec.is_readable = (sec.characteristics & 0x40000000) != 0;
        sec.is_writable = (sec.characteristics & 0x80000000) != 0;

        if (sec.raw_size > 0 && buffer.has_bytes(sec.raw_offset, sec.raw_size)) {
            sec.entropy = EntropyAnalyzer::calculate_entropy(buffer.data() + sec.raw_offset, sec.raw_size);
        }
        report.sections.push_back(sec);
    }

    // 6. Imports Table Parsing (Directory Index 1)
    if (report.data_directories.size() > 1 && report.data_directories[1].virtual_address > 0) {
        uint32_t import_rva = report.data_directories[1].virtual_address;
        uint32_t import_off = rva_to_file_offset(import_rva, report.sections);

        if (import_off > 0 && buffer.has_bytes(import_off, 20)) {
            size_t desc_off = import_off;
            while (buffer.has_bytes(desc_off, 20)) {
                uint32_t original_first_thunk = buffer.read_u32_le(desc_off);
                uint32_t time_stamp = buffer.read_u32_le(desc_off + 4);
                uint32_t forwarder = buffer.read_u32_le(desc_off + 8);
                uint32_t name_rva = buffer.read_u32_le(desc_off + 12);
                uint32_t first_thunk = buffer.read_u32_le(desc_off + 16);

                if (original_first_thunk == 0 && first_thunk == 0 && name_rva == 0) {
                    break; // NULL descriptor termination
                }

                PeImportModule module;
                module.name_rva = name_rva;
                module.time_date_stamp = time_stamp;
                module.forwarder_chain = forwarder;
                module.import_lookup_table_rva = original_first_thunk;
                module.import_address_table_rva = first_thunk;

                uint32_t name_off = rva_to_file_offset(name_rva, report.sections);
                if (name_off > 0 && name_off < buffer.size()) {
                    module.module_name = buffer.read_null_terminated_string(name_off, 128);
                }

                // Parse Thunk table
                uint32_t thunk_rva = (original_first_thunk != 0) ? original_first_thunk : first_thunk;
                uint32_t thunk_off = rva_to_file_offset(thunk_rva, report.sections);

                if (thunk_off > 0) {
                    if (report.is_pe32_plus) {
                        while (buffer.has_bytes(thunk_off, 8)) {
                            uint64_t entry = buffer.read_u64_le(thunk_off);
                            if (entry == 0) break;
                            PeImportFunction fn;
                            if (entry & 0x8000000000000000ULL) {
                                fn.by_ordinal = true;
                                fn.ordinal = static_cast<uint16_t>(entry & 0xFFFF);
                                fn.name = "Ordinal_" + std::to_string(fn.ordinal);
                            } else {
                                uint32_t hint_rva = static_cast<uint32_t>(entry & 0x7FFFFFFF);
                                uint32_t hint_off = rva_to_file_offset(hint_rva, report.sections);
                                if (hint_off > 0 && buffer.has_bytes(hint_off, 2)) {
                                    fn.ordinal = buffer.read_u16_le(hint_off);
                                    fn.name = buffer.read_null_terminated_string(hint_off + 2, 256);
                                }
                            }
                            module.functions.push_back(fn);
                            thunk_off += 8;
                        }
                    } else {
                        while (buffer.has_bytes(thunk_off, 4)) {
                            uint32_t entry = buffer.read_u32_le(thunk_off);
                            if (entry == 0) break;
                            PeImportFunction fn;
                            if (entry & 0x80000000) {
                                fn.by_ordinal = true;
                                fn.ordinal = static_cast<uint16_t>(entry & 0xFFFF);
                                fn.name = "Ordinal_" + std::to_string(fn.ordinal);
                            } else {
                                uint32_t hint_rva = entry & 0x7FFFFFFF;
                                uint32_t hint_off = rva_to_file_offset(hint_rva, report.sections);
                                if (hint_off > 0 && buffer.has_bytes(hint_off, 2)) {
                                    fn.ordinal = buffer.read_u16_le(hint_off);
                                    fn.name = buffer.read_null_terminated_string(hint_off + 2, 256);
                                }
                            }
                            module.functions.push_back(fn);
                            thunk_off += 4;
                        }
                    }
                }

                report.imports.push_back(module);
                desc_off += 20;
            }
        }
    }

    report.valid = true;
    return report;
}

} // namespace gogreen::binary
