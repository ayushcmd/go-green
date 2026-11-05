#include "gogreen/binary/binary_file.hpp"
#include "gogreen/binary/format_detector.hpp"
#include "gogreen/binary/elf_parser.hpp"
#include "gogreen/binary/pe_parser.hpp"
#include "gogreen/binary/symbol_analyzer.hpp"
#include "gogreen/binary/relocation_analyzer.hpp"
#include "gogreen/binary/disassembler.hpp"
#include "gogreen/binary/entropy_analyzer.hpp"
#include "gogreen/binary/string_extractor.hpp"
#include "gogreen/binary/binary_diff.hpp"
#include "gogreen/binary/compiler_explorer.hpp"

#include <cassert>
#include <cmath>
#include <cstring>
#include <iostream>
#include <vector>

using namespace gogreen::binary;

void test_binary_buffer_and_sha256() {
    std::cout << "[TEST] Running test_binary_buffer_and_sha256..." << std::endl;

    // Test SHA-256 for empty string
    BinaryBuffer empty_buf;
    std::string sha_empty = empty_buf.compute_sha256();
    assert(sha_empty == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

    // Test SHA-256 for "abc"
    const char abc[] = "abc";
    BinaryBuffer abc_buf(reinterpret_cast<const uint8_t*>(abc), 3);
    std::string sha_abc = abc_buf.compute_sha256();
    assert(sha_abc == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

    // Test bounds-checked primitive reading
    std::vector<uint8_t> data = {0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08};
    BinaryBuffer buf(data);
    assert(buf.read_u8(0) == 0x01);
    assert(buf.read_u16_le(0) == 0x0201);
    assert(buf.read_u32_le(0) == 0x04030201);
    assert(buf.read_u64_le(0) == 0x0807060504030201ULL);
    assert(buf.read_u16_be(0) == 0x0102);
    assert(buf.read_u32_be(0) == 0x01020304);
    assert(buf.read_u64_be(0) == 0x0102030405060708ULL);

    // Out-of-bounds reading safely throws std::out_of_range
    bool threw_u8 = false;
    try {
        buf.read_u8(100);
    } catch (const std::out_of_range&) {
        threw_u8 = true;
    }
    assert(threw_u8);

    bool threw_u32 = false;
    try {
        buf.read_u32_le(6);
    } catch (const std::out_of_range&) {
        threw_u32 = true;
    }
    assert(threw_u32);

    std::cout << "  -> test_binary_buffer_and_sha256 passed." << std::endl;
}

void test_format_detector() {
    std::cout << "[TEST] Running test_format_detector..." << std::endl;

    // Unknown buffer -> RAW
    std::vector<uint8_t> raw = {0x00, 0x11, 0x22, 0x33};
    BinaryBuffer raw_buf(raw);
    auto det_raw = FormatDetector::detect(raw_buf);
    assert(det_raw.format == BinaryFormat::RAW);

    // Synthetic ELF64 Little-Endian x86-64
    std::vector<uint8_t> elf(64, 0);
    elf[0] = 0x7f; elf[1] = 'E'; elf[2] = 'L'; elf[3] = 'F';
    elf[4] = 2; // ELFCLASS64
    elf[5] = 1; // ELFDATA2LSB
    elf[6] = 1; // EV_CURRENT
    elf[16] = 2; elf[17] = 0; // ET_EXEC
    elf[18] = 62; elf[19] = 0; // EM_X86_64
    BinaryBuffer elf_buf(elf);
    auto det_elf = FormatDetector::detect(elf_buf);
    assert(det_elf.format == BinaryFormat::ELF64);
    assert(det_elf.architecture == MachineArchitecture::X86_64);
    assert(det_elf.endianness == Endianness::LITTLE);

    // Synthetic PE32+ (x86-64)
    std::vector<uint8_t> pe(256, 0);
    pe[0] = 'M'; pe[1] = 'Z';
    // e_lfanew = 0x80
    pe[0x3c] = 0x80; pe[0x3d] = 0; pe[0x3e] = 0; pe[0x3f] = 0;
    // PE signature at 0x80
    pe[0x80] = 'P'; pe[0x81] = 'E'; pe[0x82] = 0; pe[0x83] = 0;
    // COFF Machine = 0x8664
    pe[0x84] = 0x64; pe[0x85] = 0x86;
    // Optional header magic = 0x020b (PE32+)
    pe[0x80 + 24] = 0x0b; pe[0x80 + 25] = 0x02;

    BinaryBuffer pe_buf(pe);
    auto det_pe = FormatDetector::detect(pe_buf);
    assert(det_pe.format == BinaryFormat::PE32_PLUS);
    assert(det_pe.architecture == MachineArchitecture::X86_64);

    std::cout << "  -> test_format_detector passed." << std::endl;
}

void test_entropy_analyzer() {
    std::cout << "[TEST] Running test_entropy_analyzer..." << std::endl;

    // All zero bytes: entropy must be 0.0
    std::vector<uint8_t> zeros(1024, 0);
    double e_zero = EntropyAnalyzer::calculate_entropy(zeros.data(), zeros.size());
    assert(e_zero == 0.0);

    // Uniform 256 bytes repeated: entropy must be ~8.0
    std::vector<uint8_t> uniform(256 * 10);
    for (size_t i = 0; i < uniform.size(); ++i) {
        uniform[i] = static_cast<uint8_t>(i % 256);
    }
    double e_uniform = EntropyAnalyzer::calculate_entropy(uniform.data(), uniform.size());
    assert(std::abs(e_uniform - 8.0) < 0.01);

    // Block profile
    BinaryBuffer uniform_buf(uniform);
    auto report = EntropyAnalyzer::analyze(uniform_buf, 256);
    assert(!report.block_profile.empty());
    assert(std::abs(report.block_profile[0].entropy - 8.0) < 0.01);

    std::cout << "  -> test_entropy_analyzer passed." << std::endl;
}

void test_string_extractor() {
    std::cout << "[TEST] Running test_string_extractor..." << std::endl;

    std::vector<uint8_t> test_bytes;
    auto append_str = [&](const std::string& str) {
        for (char c : str) test_bytes.push_back(static_cast<uint8_t>(c));
        test_bytes.push_back(0);
    };

    append_str("PREFIX");
    append_str("https://example.com/api");
    append_str("/usr/bin/local");
    append_str("printf(\"%s\\n\")");
    append_str("short");

    BinaryBuffer buf(test_bytes);

    auto strings = StringExtractor::extract(buf, 6);
    assert(!strings.empty());

    bool found_url = false;
    bool found_path = false;
    for (const auto& s : strings) {
        if (s.value == "https://example.com/api") {
            assert(s.category == "URL");
            found_url = true;
        }
        if (s.value == "/usr/bin/local") {
            assert(s.category == "Path");
            found_path = true;
        }
    }
    assert(found_url);
    assert(found_path);

    std::cout << "  -> test_string_extractor passed." << std::endl;
}

void test_disassembler() {
    std::cout << "[TEST] Running test_disassembler..." << std::endl;

    Disassembler disasm;
    assert(disasm.is_initialized());

    // x86-64 instructions:
    // 48 89 5c 24 08 -> mov qword ptr [rsp + 8], rbx
    // 48 83 ec 20    -> sub rsp, 0x20
    // c3             -> ret
    const uint8_t code[] = {
        0x48, 0x89, 0x5c, 0x24, 0x08,
        0x48, 0x83, 0xec, 0x20,
        0xc3
    };

    auto insns = disasm.disassemble(code, sizeof(code), 0x1000);
    assert(insns.size() == 3);
    assert(insns[0].address == 0x1000);
    assert(insns[0].mnemonic == "mov");
    assert(insns[1].address == 0x1005);
    assert(insns[1].mnemonic == "sub");
    assert(insns[2].address == 0x1009);
    assert(insns[2].mnemonic == "ret");
    assert(insns[2].is_ret == true);

    std::cout << "  -> test_disassembler passed." << std::endl;
}

void test_binary_diff() {
    std::cout << "[TEST] Running test_binary_diff..." << std::endl;

    std::vector<uint8_t> a = {1, 2, 3, 4, 5, 6, 7, 8};
    std::vector<uint8_t> b = {1, 2, 99, 4, 5, 6, 7, 8};

    BinaryBuffer buf_a(a);
    BinaryBuffer buf_b(b);

    auto diff = BinaryDiff::compare(buf_a, "file_a", buf_b, "file_b");
    assert(diff.size_a == 8);
    assert(diff.size_b == 8);
    assert(diff.size_delta == 0);
    assert(diff.identical_bytes == 7);
    assert(diff.different_bytes == 1);
    assert(!diff.byte_differences.empty());
    assert(diff.byte_differences[0].offset == 2);

    std::cout << "  -> test_binary_diff passed." << std::endl;
}

void test_compiler_explorer() {
    std::cout << "[TEST] Running test_compiler_explorer..." << std::endl;

    // Test assembly sanitization
    std::string raw = "\t.file\t\"test.cpp\"\n\t.cfi_startproc\n\tmov\teax, edi\n\tret\n\t.cfi_endproc\n";
    std::string clean = CompilerExplorer::sanitize_assembly(raw);
    assert(clean.find(".cfi_") == std::string::npos);
    assert(clean.find(".file") == std::string::npos);
    assert(clean.find("mov") != std::string::npos);
    assert(clean.find("ret") != std::string::npos);

    // Test real compilation using g++ or clang++
    CompilerRequest req;
    req.source_code = "int compute_square(int val) { return val * val; }\n";
    req.compiler = "g++";
    req.optimization_level = "-O2";
    req.target_arch = "x86-64";

    auto res = CompilerExplorer::compile_to_assembly(req);
    assert(res.success);
    assert(!res.assembly_output.empty());
    assert(res.assembly_output.find("imul") != std::string::npos ||
           res.assembly_output.find("compute_square") != std::string::npos);

    std::cout << "  -> test_compiler_explorer passed." << std::endl;
}

int main() {
    std::cout << "========================================" << std::endl;
    std::cout << "   GoGreen BinaryLab Native Unit Tests   " << std::endl;
    std::cout << "========================================" << std::endl;

    test_binary_buffer_and_sha256();
    test_format_detector();
    test_entropy_analyzer();
    test_string_extractor();
    test_disassembler();
    test_binary_diff();
    test_compiler_explorer();

    std::cout << "========================================" << std::endl;
    std::cout << "   ALL BINARYLAB UNIT TESTS PASSED!      " << std::endl;
    std::cout << "========================================" << std::endl;
    return 0;
}
