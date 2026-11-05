#pragma once

#include "gogreen/binary/binary_file.hpp"
#include "gogreen/binary/format_detector.hpp"
#include <vector>
#include <string>
#include <cstdint>

namespace gogreen::binary {

struct PeDataDirectory {
    uint32_t index = 0;
    std::string name;
    uint32_t virtual_address = 0;
    uint32_t size = 0;
};

struct PeSectionHeader {
    std::string name;
    uint32_t virtual_size = 0;
    uint32_t virtual_address = 0;
    uint32_t raw_size = 0;
    uint32_t raw_offset = 0;
    uint32_t characteristics = 0;
    double entropy = 0.0;
    bool is_executable = false;
    bool is_readable = true;
    bool is_writable = false;
};

struct PeImportFunction {
    std::string name;
    uint16_t ordinal = 0;
    bool by_ordinal = false;
    uint64_t iat_rva = 0;
};

struct PeImportModule {
    std::string module_name;
    uint32_t import_lookup_table_rva = 0;
    uint32_t time_date_stamp = 0;
    uint32_t forwarder_chain = 0;
    uint32_t name_rva = 0;
    uint32_t import_address_table_rva = 0;
    std::vector<PeImportFunction> functions;
};

struct PeExportFunction {
    std::string name;
    uint32_t ordinal = 0;
    uint32_t rva = 0;
    std::string forwarder;
};

struct PeExportDirectory {
    std::string module_name;
    uint32_t characteristics = 0;
    uint32_t time_date_stamp = 0;
    uint16_t major_version = 0;
    uint16_t minor_version = 0;
    uint32_t base = 0;
    uint32_t number_of_functions = 0;
    uint32_t number_of_names = 0;
    std::vector<PeExportFunction> functions;
};

struct PeBaseRelocationEntry {
    uint32_t page_rva = 0;
    uint16_t offset = 0;
    uint8_t type = 0;
    std::string type_name;
};

struct PeAnalysisReport {
    bool valid = false;
    std::string error_message;
    bool is_pe32_plus = true;
    uint16_t machine = 0;
    std::string machine_name;
    uint16_t section_count = 0;
    uint32_t time_date_stamp = 0;
    uint16_t characteristics = 0;

    // Optional header
    uint16_t magic = 0;
    uint64_t image_base = 0;
    uint32_t section_alignment = 0;
    uint32_t file_alignment = 0;
    uint32_t entry_point_rva = 0;
    uint32_t size_of_image = 0;
    uint32_t size_of_headers = 0;
    uint32_t subsystem = 0;
    std::string subsystem_name;
    uint16_t dll_characteristics = 0;

    std::vector<PeDataDirectory> data_directories;
    std::vector<PeSectionHeader> sections;
    std::vector<PeImportModule> imports;
    PeExportDirectory export_directory;
    std::vector<PeBaseRelocationEntry> relocations;
};

class PeParser {
public:
    static PeAnalysisReport parse(const BinaryBuffer& buffer);
    static uint32_t rva_to_file_offset(uint32_t rva, const std::vector<PeSectionHeader>& sections);
};

} // namespace gogreen::binary
