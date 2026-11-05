#include "gogreen/binary/binary_diff.hpp"
#include "gogreen/binary/elf_parser.hpp"
#include "gogreen/binary/pe_parser.hpp"
#include "gogreen/binary/symbol_analyzer.hpp"
#include <algorithm>
#include <iomanip>
#include <map>
#include <set>
#include <sstream>

namespace gogreen::binary {

namespace {

std::string bytes_to_hex(const uint8_t* data, size_t len) {
    std::ostringstream ss;
    for (size_t i = 0; i < len; ++i) {
        if (i > 0) ss << ' ';
        ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(data[i]);
    }
    return ss.str();
}

} // namespace

BinaryDiffReport BinaryDiff::compare(
    const BinaryBuffer& buf_a, const std::string& name_a,
    const BinaryBuffer& buf_b, const std::string& name_b) {

    BinaryDiffReport report;
    report.file_a_name = name_a;
    report.file_b_name = name_b;
    report.size_a = buf_a.size();
    report.size_b = buf_b.size();
    report.size_delta = static_cast<int64_t>(buf_b.size()) - static_cast<int64_t>(buf_a.size());
    report.sha256_a = buf_a.compute_sha256();
    report.sha256_b = buf_b.compute_sha256();

    auto det_a = FormatDetector::detect(buf_a);
    auto det_b = FormatDetector::detect(buf_b);
    report.format_a = det_a.format_name;
    report.format_b = det_b.format_name;

    // 1. Byte-level diffing
    const size_t common_len = std::min(report.size_a, report.size_b);
    const size_t max_len = std::max(report.size_a, report.size_b);
    const uint8_t* data_a = buf_a.data();
    const uint8_t* data_b = buf_b.data();

    size_t identical = 0;
    size_t different = 0;

    bool in_diff_chunk = false;
    size_t chunk_start = 0;
    const size_t max_diff_chunks = 128;

    for (size_t i = 0; i < common_len; ++i) {
        if (data_a[i] == data_b[i]) {
            ++identical;
            if (in_diff_chunk) {
                if (report.byte_differences.size() < max_diff_chunks) {
                    size_t chunk_len = std::min<size_t>(i - chunk_start, 32);
                    ByteDiffChunk chunk;
                    chunk.offset = chunk_start;
                    chunk.length = i - chunk_start;
                    chunk.hex_a = bytes_to_hex(data_a + chunk_start, chunk_len);
                    chunk.hex_b = bytes_to_hex(data_b + chunk_start, chunk_len);
                    report.byte_differences.push_back(std::move(chunk));
                }
                in_diff_chunk = false;
            }
        } else {
            ++different;
            if (!in_diff_chunk) {
                in_diff_chunk = true;
                chunk_start = i;
            } else if (i - chunk_start >= 32) {
                if (report.byte_differences.size() < max_diff_chunks) {
                    ByteDiffChunk chunk;
                    chunk.offset = chunk_start;
                    chunk.length = i - chunk_start;
                    chunk.hex_a = bytes_to_hex(data_a + chunk_start, 32);
                    chunk.hex_b = bytes_to_hex(data_b + chunk_start, 32);
                    report.byte_differences.push_back(std::move(chunk));
                }
                chunk_start = i;
            }
        }
    }

    // Flush last chunk
    if (in_diff_chunk && report.byte_differences.size() < max_diff_chunks) {
        size_t chunk_len = std::min<size_t>(common_len - chunk_start, 32);
        ByteDiffChunk chunk;
        chunk.offset = chunk_start;
        chunk.length = common_len - chunk_start;
        chunk.hex_a = bytes_to_hex(data_a + chunk_start, chunk_len);
        chunk.hex_b = bytes_to_hex(data_b + chunk_start, chunk_len);
        report.byte_differences.push_back(std::move(chunk));
    }

    // Account for trailing bytes in the larger file
    different += (max_len - common_len);
    report.identical_bytes = identical;
    report.different_bytes = different;
    report.similarity_percent = (max_len == 0) ? 100.0 : (static_cast<double>(identical) / static_cast<double>(max_len)) * 100.0;

    // 2. Section and Symbol diffing for ELF
    if ((det_a.format == BinaryFormat::ELF32 || det_a.format == BinaryFormat::ELF64) &&
        (det_b.format == BinaryFormat::ELF32 || det_b.format == BinaryFormat::ELF64)) {
        auto elf_a = ElfParser::parse(buf_a);
        auto elf_b = ElfParser::parse(buf_b);

        std::map<std::string, ElfSectionHeader> sec_a_map;
        for (const auto& s : elf_a.section_headers) {
            if (!s.name.empty()) sec_a_map[s.name] = s;
        }
        std::map<std::string, ElfSectionHeader> sec_b_map;
        for (const auto& s : elf_b.section_headers) {
            if (!s.name.empty()) sec_b_map[s.name] = s;
        }

        std::set<std::string> all_sec_names;
        for (const auto& [name, _] : sec_a_map) all_sec_names.insert(name);
        for (const auto& [name, _] : sec_b_map) all_sec_names.insert(name);

        for (const auto& name : all_sec_names) {
            SectionDiff sd;
            sd.name = name;
            auto it_a = sec_a_map.find(name);
            auto it_b = sec_b_map.find(name);

            if (it_a != sec_a_map.end() && it_b != sec_b_map.end()) {
                sd.size_a = it_a->second.size;
                sd.size_b = it_b->second.size;
                sd.entropy_a = it_a->second.entropy;
                sd.entropy_b = it_b->second.entropy;
                if (sd.size_a == sd.size_b && std::abs(sd.entropy_a - sd.entropy_b) < 0.001) {
                    sd.status = "IDENTICAL";
                } else {
                    sd.status = "MODIFIED";
                }
            } else if (it_a != sec_a_map.end()) {
                sd.size_a = it_a->second.size;
                sd.entropy_a = it_a->second.entropy;
                sd.status = "REMOVED";
            } else {
                sd.size_b = it_b->second.size;
                sd.entropy_b = it_b->second.entropy;
                sd.status = "ADDED";
            }
            report.section_differences.push_back(std::move(sd));
        }

        // Symbols
        auto syms_a = SymbolAnalyzer::extract_symbols(buf_a, elf_a);
        auto syms_b = SymbolAnalyzer::extract_symbols(buf_b, elf_b);

        std::map<std::string, SymbolEntry> sa_map;
        for (const auto& s : syms_a) {
            if (!s.name.empty()) sa_map[s.name] = s;
        }
        std::map<std::string, SymbolEntry> sb_map;
        for (const auto& s : syms_b) {
            if (!s.name.empty()) sb_map[s.name] = s;
        }

        std::set<std::string> all_syms;
        for (const auto& [n, _] : sa_map) all_syms.insert(n);
        for (const auto& [n, _] : sb_map) all_syms.insert(n);

        for (const auto& n : all_syms) {
            auto it_a = sa_map.find(n);
            auto it_b = sb_map.find(n);

            if (it_a != sa_map.end() && it_b != sb_map.end()) {
                if (it_a->second.address != it_b->second.address || it_a->second.size != it_b->second.size) {
                    SymbolDiff diff;
                    diff.name = n;
                    diff.change_type = "MODIFIED";
                    diff.address_a = it_a->second.address;
                    diff.address_b = it_b->second.address;
                    report.symbol_differences.push_back(std::move(diff));
                }
            } else if (it_a != sa_map.end()) {
                SymbolDiff diff;
                diff.name = n;
                diff.change_type = "REMOVED";
                diff.address_a = it_a->second.address;
                report.symbol_differences.push_back(std::move(diff));
            } else {
                SymbolDiff diff;
                diff.name = n;
                diff.change_type = "ADDED";
                diff.address_b = it_b->second.address;
                report.symbol_differences.push_back(std::move(diff));
            }
        }
    }
    // 3. Section and Symbol diffing for PE
    else if ((det_a.format == BinaryFormat::PE32 || det_a.format == BinaryFormat::PE32_PLUS) &&
             (det_b.format == BinaryFormat::PE32 || det_b.format == BinaryFormat::PE32_PLUS)) {
        auto pe_a = PeParser::parse(buf_a);
        auto pe_b = PeParser::parse(buf_b);

        std::map<std::string, PeSectionHeader> sec_a_map;
        for (const auto& s : pe_a.sections) {
            if (!s.name.empty()) sec_a_map[s.name] = s;
        }
        std::map<std::string, PeSectionHeader> sec_b_map;
        for (const auto& s : pe_b.sections) {
            if (!s.name.empty()) sec_b_map[s.name] = s;
        }

        std::set<std::string> all_sec_names;
        for (const auto& [name, _] : sec_a_map) all_sec_names.insert(name);
        for (const auto& [name, _] : sec_b_map) all_sec_names.insert(name);

        for (const auto& name : all_sec_names) {
            SectionDiff sd;
            sd.name = name;
            auto it_a = sec_a_map.find(name);
            auto it_b = sec_b_map.find(name);

            if (it_a != sec_a_map.end() && it_b != sec_b_map.end()) {
                sd.size_a = it_a->second.virtual_size;
                sd.size_b = it_b->second.virtual_size;
                sd.entropy_a = it_a->second.entropy;
                sd.entropy_b = it_b->second.entropy;
                if (sd.size_a == sd.size_b && std::abs(sd.entropy_a - sd.entropy_b) < 0.001) {
                    sd.status = "IDENTICAL";
                } else {
                    sd.status = "MODIFIED";
                }
            } else if (it_a != sec_a_map.end()) {
                sd.size_a = it_a->second.virtual_size;
                sd.entropy_a = it_a->second.entropy;
                sd.status = "REMOVED";
            } else {
                sd.size_b = it_b->second.virtual_size;
                sd.entropy_b = it_b->second.entropy;
                sd.status = "ADDED";
            }
            report.section_differences.push_back(std::move(sd));
        }

        // Imports comparison
        std::set<std::string> imp_a, imp_b;
        for (const auto& mod : pe_a.imports) {
            for (const auto& f : mod.functions) {
                imp_a.insert(mod.module_name + "!" + f.name);
            }
        }
        for (const auto& mod : pe_b.imports) {
            for (const auto& f : mod.functions) {
                imp_b.insert(mod.module_name + "!" + f.name);
            }
        }
        for (const auto& imp : imp_b) {
            if (imp_a.find(imp) == imp_a.end()) report.added_imports.push_back(imp);
        }
        for (const auto& imp : imp_a) {
            if (imp_b.find(imp) == imp_b.end()) report.removed_imports.push_back(imp);
        }
    }

    return report;
}

} // namespace gogreen::binary
