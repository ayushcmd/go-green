#include "gogreen/engine.hpp"
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

#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <map>
#include <thread>
#include <atomic>
#include <csignal>
#include <cstring>
#include <iomanip>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

namespace {

std::atomic<bool> g_running{true};
int g_server_fd = -1;

void handle_signal(int sig) {
    (void)sig;
    g_running = false;
    if (g_server_fd >= 0) {
        close(g_server_fd);
        g_server_fd = -1;
    }
}

// JSON string escaping
std::string escape_json(const std::string& input) {
    std::ostringstream ss;
    for (char c : input) {
        switch (c) {
            case '"':  ss << "\\\""; break;
            case '\\': ss << "\\\\"; break;
            case '\b': ss << "\\b"; break;
            case '\f': ss << "\\f"; break;
            case '\n': ss << "\\n"; break;
            case '\r': ss << "\\r"; break;
            case '\t': ss << "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    ss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
                } else {
                    ss << c;
                }
                break;
        }
    }
    return ss.str();
}

// Simple Base64 decoder
std::vector<uint8_t> base64_decode(const std::string& in) {
    std::vector<uint8_t> out;
    std::vector<int> T(256, -1);
    const std::string b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (int i = 0; i < 64; ++i) T[static_cast<unsigned char>(b64[i])] = i;

    int val = 0, valb = -8;
    for (unsigned char c : in) {
        if (c == '=') break;
        if (T[c] == -1) continue;
        val = (val << 6) + T[c];
        valb += 6;
        if (valb >= 0) {
            out.push_back(static_cast<uint8_t>((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    return out;
}

std::string extract_json_field(const std::string& json, const std::string& key) {
    std::string key_pattern = "\"" + key + "\"";
    size_t kpos = json.find(key_pattern);
    if (kpos == std::string::npos) return "";

    size_t colon = json.find(':', kpos + key_pattern.length());
    if (colon == std::string::npos) return "";

    size_t quote_start = json.find('"', colon + 1);
    if (quote_start == std::string::npos) return "";

    size_t cur = quote_start + 1;
    std::string result;
    while (cur < json.size()) {
        if (json[cur] == '\\' && cur + 1 < json.size()) {
            char next = json[cur + 1];
            if (next == '"') result += '"';
            else if (next == '\\') result += '\\';
            else if (next == 'n') result += '\n';
            else if (next == 'r') result += '\r';
            else if (next == 't') result += '\t';
            else { result += json[cur]; result += next; }
            cur += 2;
        } else if (json[cur] == '"') {
            break;
        } else {
            result += json[cur];
            cur++;
        }
    }
    return result;
}

std::string metric_to_json(const gogreen::BenchmarkMetric& m) {
    std::ostringstream ss;
    ss << "{\n"
       << "  \"id\": \"" << m.id << "\",\n"
       << "  \"name\": \"" << m.name << "\",\n"
       << "  \"category\": \"" << m.category << "\",\n"
       << "  \"implementation\": \"" << m.implementation << "\",\n"
       << "  \"input_size_bytes\": " << m.input_size_bytes << ",\n"
       << "  \"iterations\": " << m.iterations << ",\n"
       << "  \"duration_ms\": " << std::fixed << std::setprecision(3) << m.duration_ms << ",\n"
       << "  \"throughput_ops_sec\": " << std::fixed << std::setprecision(2) << m.throughput_ops_sec << ",\n"
       << "  \"throughput_mb_sec\": " << std::fixed << std::setprecision(2) << m.throughput_mb_sec << ",\n"
       << "  \"min_ns\": " << std::fixed << std::setprecision(1) << m.min_ns << ",\n"
       << "  \"max_ns\": " << std::fixed << std::setprecision(1) << m.max_ns << ",\n"
       << "  \"median_ns\": " << std::fixed << std::setprecision(1) << m.median_ns << ",\n"
       << "  \"p90_ns\": " << std::fixed << std::setprecision(1) << m.p90_ns << ",\n"
       << "  \"p99_ns\": " << std::fixed << std::setprecision(1) << m.p99_ns << ",\n"
       << "  \"timestamp\": \"" << m.timestamp << "\",\n"
       << "  \"verified_correct\": " << (m.verified_correct ? "true" : "false") << "\n"
       << "}";
    return ss.str();
}

std::string features_to_json(const std::vector<gogreen::FeatureDetail>& features) {
    std::ostringstream ss;
    ss << "[\n";
    for (size_t i = 0; i < features.size(); ++i) {
        const auto& f = features[i];
        ss << "  {\n"
           << "    \"name\": \"" << f.name << "\",\n"
           << "    \"category\": \"" << f.category << "\",\n"
           << "    \"hw_supported\": " << (f.hw_supported ? "true" : "false") << ",\n"
           << "    \"os_supported\": " << (f.os_supported ? "true" : "false") << ",\n"
           << "    \"active\": " << (f.active ? "true" : "false") << ",\n"
           << "    \"description\": \"" << f.description << "\"\n"
           << "  }" << (i + 1 < features.size() ? "," : "") << "\n";
    }
    ss << "]";
    return ss.str();
}

std::string make_http_response(int status_code, const std::string& status_text,
                               const std::string& content_type, const std::string& body) {
    std::ostringstream ss;
    ss << "HTTP/1.1 " << status_code << " " << status_text << "\r\n"
       << "Server: GoGreen-Native-Daemon/2.0\r\n"
       << "Content-Type: " << content_type << "\r\n"
       << "Content-Length: " << body.size() << "\r\n"
       << "Access-Control-Allow-Origin: *\r\n"
       << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
       << "Access-Control-Allow-Headers: Content-Type, Accept, Authorization\r\n"
       << "Connection: close\r\n\r\n"
       << body;
    return ss.str();
}

void handle_client(int client_fd) {
    std::string request;
    char buffer[8192];
    ssize_t bytes_read = read(client_fd, buffer, sizeof(buffer));
    if (bytes_read <= 0) {
        close(client_fd);
        return;
    }
    request.append(buffer, bytes_read);

    // Read full HTTP body according to Content-Length
    size_t header_end = request.find("\r\n\r\n");
    size_t content_length = 0;
    auto cl_pos = request.find("Content-Length: ");
    if (cl_pos == std::string::npos) cl_pos = request.find("content-length: ");
    if (cl_pos != std::string::npos) {
        content_length = std::stoull(request.substr(cl_pos + 16));
    }
    if (header_end != std::string::npos && content_length > 0) {
        size_t current_body_len = request.size() - (header_end + 4);
        while (current_body_len < content_length && request.size() < 10 * 1024 * 1024) {
            bytes_read = read(client_fd, buffer, sizeof(buffer));
            if (bytes_read <= 0) break;
            request.append(buffer, bytes_read);
            current_body_len += bytes_read;
        }
    }

    std::istringstream req_stream(request);
    std::string method, path, protocol;
    req_stream >> method >> path >> protocol;

    // Handle CORS OPTIONS preflight
    if (method == "OPTIONS") {
        std::string response = make_http_response(204, "No Content", "text/plain", "");
        write(client_fd, response.data(), response.size());
        close(client_fd);
        return;
    }

    auto& engine = gogreen::Engine::instance();
    std::string response;

    // Remove query params for routing
    std::string pure_path = path;
    std::string query_string;
    auto qpos = path.find('?');
    if (qpos != std::string::npos) {
        pure_path = path.substr(0, qpos);
        query_string = path.substr(qpos + 1);
    }

    std::string req_body;
    if (header_end != std::string::npos) {
        req_body = request.substr(header_end + 4);
    }

    if (method == "GET" && (pure_path == "/" || pure_path == "/api")) {
        std::string body = "{\n  \"service\": \"GoGreen Native Core Daemon\",\n  \"version\": \"2.0.0-phase4\",\n  \"status\": \"ONLINE\",\n  \"subsystems\": [\"CoreEngine\", \"BenchmarkSuite\", \"BinaryLab\", \"CompilerExplorer\"],\n  \"docs\": \"/api/v1/\"\n}";
        response = make_http_response(200, "OK", "application/json", body);
    } else if (method == "GET" && pure_path == "/api/v1/health") {
        response = make_http_response(200, "OK", "application/json", engine.get_health_json());
    } else if (method == "GET" && pure_path == "/api/v1/host") {
        response = make_http_response(200, "OK", "application/json", engine.get_current_hardware_info().to_json());
    } else if (method == "GET" && pure_path == "/api/v1/cpu") {
        response = make_http_response(200, "OK", "application/json", engine.get_cpu_info().to_json());
    } else if (method == "GET" && pure_path == "/api/v1/cpu/features") {
        response = make_http_response(200, "OK", "application/json", features_to_json(engine.get_features()));
    } else if (method == "GET" && pure_path == "/api/v1/engine/status") {
        response = make_http_response(200, "OK", "application/json", engine.get_status_json());
    } else if (method == "GET" && pure_path == "/api/v1/telemetry") {
        response = make_http_response(200, "OK", "application/json", engine.get_telemetry_json());
    } else if (method == "GET" && pure_path == "/api/v1/benchmarks") {
        auto history = engine.get_benchmark_history();
        std::ostringstream ss;
        ss << "[\n";
        for (size_t i = 0; i < history.size(); ++i) {
            ss << metric_to_json(history[i]);
            if (i + 1 < history.size()) ss << ",";
            ss << "\n";
        }
        ss << "]";
        response = make_http_response(200, "OK", "application/json", ss.str());
    } else if (method == "POST" && pure_path == "/api/v1/benchmarks/run") {
        std::string type = "all";
        if (query_string.find("type=int-add") != std::string::npos || request.find("\"type\":\"int-add\"") != std::string::npos) {
            type = "int-add";
        } else if (query_string.find("type=memcpy") != std::string::npos || request.find("\"type\":\"memcpy\"") != std::string::npos) {
            type = "memcpy";
        } else if (query_string.find("type=byte-sum") != std::string::npos || request.find("\"type\":\"byte-sum\"") != std::string::npos) {
            type = "byte-sum";
        } else if (query_string.find("type=simd-add") != std::string::npos || request.find("\"type\":\"simd-add\"") != std::string::npos) {
            type = "simd-add";
        }

        std::string body;
        if (type == "all") {
            auto results = engine.run_full_suite();
            std::ostringstream ss;
            ss << "[\n";
            for (size_t i = 0; i < results.size(); ++i) {
                ss << metric_to_json(results[i]);
                if (i + 1 < results.size()) ss << ",";
                ss << "\n";
            }
            ss << "]";
            body = ss.str();
        } else {
            bool use_asm = query_string.find("impl=cpp") == std::string::npos && request.find("\"use_asm\":false") == std::string::npos;
            auto metric = engine.run_single_benchmark(type, use_asm);
            body = metric_to_json(metric);
        }
        response = make_http_response(200, "OK", "application/json", body);
    }
    // Phase 4: BinaryLab Endpoints
    else if (method == "POST" && pure_path == "/api/v1/binary/analyze") {
        using namespace gogreen::binary;
        std::vector<uint8_t> raw_bytes;
        std::string filename = "binary.bin";

        // Check if JSON with base64 payload
        if (req_body.find("\"payload_base64\"") != std::string::npos) {
            std::string b64 = extract_json_field(req_body, "payload_base64");
            raw_bytes = base64_decode(b64);
            std::string fn = extract_json_field(req_body, "filename");
            if (!fn.empty()) filename = fn;
        } else {
            raw_bytes.assign(req_body.begin(), req_body.end());
        }

        BinaryBuffer buffer(raw_bytes);
        auto format_info = FormatDetector::detect(buffer);
        auto entropy_report = EntropyAnalyzer::analyze(buffer);
        auto strings = StringExtractor::extract(buffer, 5);

        std::vector<SymbolEntry> symbols;
        std::vector<RelocationRecord> relocations;
        uint64_t entry_point = 0;

        std::ostringstream sec_ss;
        sec_ss << "[";

        if (format_info.format == BinaryFormat::ELF32 || format_info.format == BinaryFormat::ELF64) {
            auto elf = ElfParser::parse(buffer);
            entry_point = elf.entry_point;
            symbols = SymbolAnalyzer::extract_symbols(buffer, elf);
            relocations = RelocationAnalyzer::extract_relocations(buffer, elf, symbols);

            for (size_t i = 0; i < elf.section_headers.size(); ++i) {
                const auto& s = elf.section_headers[i];
                sec_ss << "{\"name\":\"" << escape_json(s.name)
                       << "\",\"virtual_address\":" << s.virtual_address
                       << ",\"raw_offset\":" << s.offset
                       << ",\"size\":" << s.size
                       << ",\"entropy\":" << std::fixed << std::setprecision(4) << s.entropy
                       << ",\"is_executable\":" << (s.is_executable ? "true" : "false")
                       << ",\"is_writable\":" << (s.is_writable ? "true" : "false")
                       << ",\"type_name\":\"" << escape_json(s.type_name) << "\"}";
                if (i + 1 < elf.section_headers.size()) sec_ss << ",";
            }
        } else if (format_info.format == BinaryFormat::PE32 || format_info.format == BinaryFormat::PE32_PLUS) {
            auto pe = PeParser::parse(buffer);
            entry_point = pe.entry_point_rva;
            symbols = SymbolAnalyzer::extract_symbols(buffer, pe);
            relocations = RelocationAnalyzer::extract_relocations(pe);

            for (size_t i = 0; i < pe.sections.size(); ++i) {
                const auto& s = pe.sections[i];
                sec_ss << "{\"name\":\"" << escape_json(s.name)
                       << "\",\"virtual_address\":" << s.virtual_address
                       << ",\"raw_offset\":" << s.raw_offset
                       << ",\"size\":" << s.virtual_size
                       << ",\"entropy\":" << std::fixed << std::setprecision(4) << s.entropy
                       << ",\"is_executable\":" << (s.is_executable ? "true" : "false")
                       << ",\"is_writable\":" << (s.is_writable ? "true" : "false")
                       << ",\"type_name\":\"SECTION\"}";
                if (i + 1 < pe.sections.size()) sec_ss << ",";
            }
        }
        sec_ss << "]";

        // Build symbols JSON
        std::ostringstream sym_ss;
        sym_ss << "[";
        size_t max_syms = std::min<size_t>(symbols.size(), 200);
        for (size_t i = 0; i < max_syms; ++i) {
            const auto& s = symbols[i];
            sym_ss << "{\"name\":\"" << escape_json(s.name)
                   << "\",\"address\":" << s.address
                   << ",\"size\":" << s.size
                   << ",\"type_name\":\"" << s.type_name
                   << "\",\"binding_name\":\"" << s.binding_name
                   << "\",\"section_name\":\"" << escape_json(s.section_name)
                   << "\",\"is_imported\":" << (s.is_imported ? "true" : "false")
                   << ",\"is_exported\":" << (s.is_exported ? "true" : "false") << "}";
            if (i + 1 < max_syms) sym_ss << ",";
        }
        sym_ss << "]";

        // Build relocations JSON
        std::ostringstream rel_ss;
        rel_ss << "[";
        size_t max_rels = std::min<size_t>(relocations.size(), 100);
        for (size_t i = 0; i < max_rels; ++i) {
            const auto& r = relocations[i];
            rel_ss << "{\"offset\":" << r.offset
                   << ",\"type_name\":\"" << r.type_name
                   << "\",\"symbol_name\":\"" << escape_json(r.symbol_name)
                   << "\",\"addend\":" << r.addend
                   << ",\"section_name\":\"" << escape_json(r.section_name) << "\"}";
            if (i + 1 < max_rels) rel_ss << ",";
        }
        rel_ss << "]";

        // Build strings JSON
        std::ostringstream str_ss;
        str_ss << "[";
        size_t max_strs = std::min<size_t>(strings.size(), 100);
        for (size_t i = 0; i < max_strs; ++i) {
            const auto& st = strings[i];
            str_ss << "{\"value\":\"" << escape_json(st.value)
                   << "\",\"offset\":" << st.offset
                   << ",\"length\":" << st.length
                   << ",\"category\":\"" << st.category << "\"}";
            if (i + 1 < max_strs) str_ss << ",";
        }
        str_ss << "]";

        // Entropy distribution
        std::ostringstream dist_ss;
        dist_ss << "[";
        for (size_t i = 0; i < 256; ++i) {
            dist_ss << entropy_report.byte_distribution[i] << (i < 255 ? "," : "");
        }
        dist_ss << "]";

        // Block profile
        std::ostringstream blk_ss;
        blk_ss << "[";
        size_t max_blks = std::min<size_t>(entropy_report.block_profile.size(), 64);
        for (size_t i = 0; i < max_blks; ++i) {
            const auto& b = entropy_report.block_profile[i];
            blk_ss << "{\"offset\":" << b.offset << ",\"entropy\":" << std::fixed << std::setprecision(3) << b.entropy << "}";
            if (i + 1 < max_blks) blk_ss << ",";
        }
        blk_ss << "]";

        std::ostringstream res_ss;
        res_ss << "{\n"
               << "  \"filename\": \"" << escape_json(filename) << "\",\n"
               << "  \"format\": \"" << format_info.format_name << "\",\n"
               << "  \"architecture\": \"" << format_info.architecture_name << "\",\n"
               << "  \"endianness\": \"" << ((format_info.endianness == Endianness::LITTLE) ? "Little Endian" : "Big Endian") << "\",\n"
               << "  \"mime_type\": \"" << format_info.mime_type << "\",\n"
               << "  \"is_executable\": " << (format_info.is_executable ? "true" : "false") << ",\n"
               << "  \"size\": " << buffer.size() << ",\n"
               << "  \"sha256\": \"" << buffer.compute_sha256() << "\",\n"
               << "  \"entry_point\": " << entry_point << ",\n"
               << "  \"sections\": " << sec_ss.str() << ",\n"
               << "  \"symbols\": " << sym_ss.str() << ",\n"
               << "  \"relocations\": " << rel_ss.str() << ",\n"
               << "  \"strings\": " << str_ss.str() << ",\n"
               << "  \"entropy\": {\n"
               << "    \"overall\": " << std::fixed << std::setprecision(4) << entropy_report.overall_entropy << ",\n"
               << "    \"chi_square\": " << std::fixed << std::setprecision(2) << entropy_report.chi_square << ",\n"
               << "    \"mean_byte\": " << std::fixed << std::setprecision(2) << entropy_report.mean_byte_value << ",\n"
               << "    \"assessment\": \"" << entropy_report.assessment << "\",\n"
               << "    \"blocks\": " << blk_ss.str() << ",\n"
               << "    \"distribution\": " << dist_ss.str() << "\n"
               << "  }\n"
               << "}";

        response = make_http_response(200, "OK", "application/json", res_ss.str());
    } else if (method == "POST" && pure_path == "/api/v1/binary/disassemble") {
        using namespace gogreen::binary;
        std::vector<uint8_t> code_bytes;
        uint64_t base_addr = 0x1000;

        if (req_body.find("\"code_base64\"") != std::string::npos) {
            std::string b64 = extract_json_field(req_body, "code_base64");
            code_bytes = base64_decode(b64);
        } else {
            code_bytes.assign(req_body.begin(), req_body.end());
        }

        Disassembler disasm;
        auto insns = disasm.disassemble(code_bytes.data(), code_bytes.size(), base_addr, 500);

        std::ostringstream ss;
        ss << "[\n";
        for (size_t i = 0; i < insns.size(); ++i) {
            const auto& in = insns[i];
            ss << "  {\"address\":" << in.address
               << ",\"size\":" << in.size
               << ",\"bytes\":\"" << in.bytes
               << "\",\"mnemonic\":\"" << in.mnemonic
               << "\",\"operands\":\"" << escape_json(in.operands)
               << "\",\"is_call\":" << (in.is_call ? "true" : "false")
               << ",\"is_jump\":" << (in.is_jump ? "true" : "false")
               << ",\"is_ret\":" << (in.is_ret ? "true" : "false")
               << ",\"target_address\":" << in.target_address
               << ",\"symbol\":\"" << escape_json(in.symbol_annotation) << "\"}";
            if (i + 1 < insns.size()) ss << ",";
            ss << "\n";
        }
        ss << "]";
        response = make_http_response(200, "OK", "application/json", ss.str());
    } else if (method == "POST" && pure_path == "/api/v1/binary/diff") {
        using namespace gogreen::binary;
        std::string b64_a = extract_json_field(req_body, "file_a_base64");
        std::string b64_b = extract_json_field(req_body, "file_b_base64");
        std::string name_a = extract_json_field(req_body, "name_a");
        std::string name_b = extract_json_field(req_body, "name_b");
        if (name_a.empty()) name_a = "file_a.bin";
        if (name_b.empty()) name_b = "file_b.bin";

        auto bytes_a = base64_decode(b64_a);
        auto bytes_b = base64_decode(b64_b);

        BinaryBuffer buf_a(bytes_a);
        BinaryBuffer buf_b(bytes_b);

        auto diff_report = BinaryDiff::compare(buf_a, name_a, buf_b, name_b);

        std::ostringstream ss;
        ss << "{\n"
           << "  \"file_a_name\": \"" << escape_json(diff_report.file_a_name) << "\",\n"
           << "  \"file_b_name\": \"" << escape_json(diff_report.file_b_name) << "\",\n"
           << "  \"size_a\": " << diff_report.size_a << ",\n"
           << "  \"size_b\": " << diff_report.size_b << ",\n"
           << "  \"size_delta\": " << diff_report.size_delta << ",\n"
           << "  \"sha256_a\": \"" << diff_report.sha256_a << "\",\n"
           << "  \"sha256_b\": \"" << diff_report.sha256_b << "\",\n"
           << "  \"format_a\": \"" << diff_report.format_a << "\",\n"
           << "  \"format_b\": \"" << diff_report.format_b << "\",\n"
           << "  \"similarity_percent\": " << std::fixed << std::setprecision(2) << diff_report.similarity_percent << ",\n"
           << "  \"identical_bytes\": " << diff_report.identical_bytes << ",\n"
           << "  \"different_bytes\": " << diff_report.different_bytes << ",\n"
           << "  \"byte_differences\": [";
        for (size_t i = 0; i < diff_report.byte_differences.size(); ++i) {
            const auto& chunk = diff_report.byte_differences[i];
            ss << "{\"offset\":" << chunk.offset << ",\"length\":" << chunk.length
               << ",\"hex_a\":\"" << chunk.hex_a << "\",\"hex_b\":\"" << chunk.hex_b << "\"}";
            if (i + 1 < diff_report.byte_differences.size()) ss << ",";
        }
        ss << "],\n"
           << "  \"section_differences\": [";
        for (size_t i = 0; i < diff_report.section_differences.size(); ++i) {
            const auto& sd = diff_report.section_differences[i];
            ss << "{\"name\":\"" << escape_json(sd.name)
               << "\",\"status\":\"" << sd.status
               << "\",\"size_a\":" << sd.size_a
               << ",\"size_b\":" << sd.size_b
               << ",\"entropy_a\":" << std::fixed << std::setprecision(3) << sd.entropy_a
               << ",\"entropy_b\":" << std::fixed << std::setprecision(3) << sd.entropy_b << "}";
            if (i + 1 < diff_report.section_differences.size()) ss << ",";
        }
        ss << "],\n"
           << "  \"symbol_differences\": [";
        for (size_t i = 0; i < diff_report.symbol_differences.size(); ++i) {
            const auto& sym = diff_report.symbol_differences[i];
            ss << "{\"name\":\"" << escape_json(sym.name)
               << "\",\"change_type\":\"" << sym.change_type
               << "\",\"address_a\":" << sym.address_a
               << ",\"address_b\":" << sym.address_b << "}";
            if (i + 1 < diff_report.symbol_differences.size()) ss << ",";
        }
        ss << "]\n"
           << "}";
        response = make_http_response(200, "OK", "application/json", ss.str());
    } else if (method == "POST" && pure_path == "/api/v1/compiler/compile") {
        using namespace gogreen::binary;
        CompilerRequest req;
        req.source_code = extract_json_field(req_body, "source_code");
        if (req.source_code.empty()) {
            req.source_code = req_body; // Direct raw source
        }
        std::string comp = extract_json_field(req_body, "compiler");
        if (!comp.empty()) req.compiler = comp;
        std::string opt = extract_json_field(req_body, "optimization_level");
        if (!opt.empty()) req.optimization_level = opt;

        auto comp_res = CompilerExplorer::compile_to_assembly(req);

        std::ostringstream ss;
        ss << "{\n"
           << "  \"success\": " << (comp_res.success ? "true" : "false") << ",\n"
           << "  \"compiler\": \"" << comp_res.compiler << "\",\n"
           << "  \"compiler_version\": \"" << escape_json(comp_res.compiler_version) << "\",\n"
           << "  \"optimization_level\": \"" << comp_res.optimization_level << "\",\n"
           << "  \"assembly_output\": \"" << escape_json(comp_res.assembly_output) << "\",\n"
           << "  \"error_output\": \"" << escape_json(comp_res.error_output) << "\",\n"
           << "  \"compilation_time_ms\": " << std::fixed << std::setprecision(2) << comp_res.compilation_time_ms << ",\n"
           << "  \"instructions\": [";
        for (size_t i = 0; i < comp_res.instructions.size(); ++i) {
            const auto& in = comp_res.instructions[i];
            ss << "{\"source_line\":" << in.source_line << ",\"text\":\"" << escape_json(in.text) << "\"}";
            if (i + 1 < comp_res.instructions.size()) ss << ",";
        }
        ss << "]\n"
           << "}";
        response = make_http_response(200, "OK", "application/json", ss.str());
    } else {
        std::string body = "{\n  \"error\": \"Not Found\",\n  \"path\": \"" + pure_path + "\"\n}";
        response = make_http_response(404, "Not Found", "application/json", body);
    }

    write(client_fd, response.data(), response.size());
    close(client_fd);
}

} // namespace

int main(int argc, char** argv) {
    std::cout << "========================================================\n"
              << "  GOGREEN NATIVE CORE ENGINE DAEMON (C++23 / NASM x86-64)\n"
              << "  BUILD DEEP. THINK LOW-LEVEL. ENGINEER BEYOND LIMITS.\n"
              << "========================================================\n";

    int port = 8080;
    for (int i = 1; i < argc; ++i) {
        if (std::string(argv[i]) == "--port" && i + 1 < argc) {
            port = std::stoi(argv[++i]);
        }
    }

    std::signal(SIGINT, handle_signal);
    std::signal(SIGTERM, handle_signal);

    auto& engine = gogreen::Engine::instance();
    if (!engine.initialize()) {
        std::cerr << "[ERROR] Failed to initialize Native Core Engine\n";
        return 1;
    }

    const auto& cpu = engine.get_cpu_info();
    std::cout << "[INFO] CPU Vendor:       " << cpu.vendor << "\n"
              << "[INFO] CPU Model:        " << cpu.brand_string << "\n"
              << "[INFO] Cores:            " << cpu.physical_cores << " physical, " << cpu.logical_cores << " logical\n"
              << "[INFO] Features:         " << engine.get_features().size() << " detected\n";

    g_server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (g_server_fd < 0) {
        std::cerr << "[ERROR] Failed to create socket: " << strerror(errno) << "\n";
        return 1;
    }

    int opt = 1;
    setsockopt(g_server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    sockaddr_in server_addr{};
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = inet_addr("127.0.0.1"); // Strictly local-only
    server_addr.sin_port = htons(static_cast<uint16_t>(port));

    if (bind(g_server_fd, reinterpret_cast<sockaddr*>(&server_addr), sizeof(server_addr)) < 0) {
        std::cerr << "[ERROR] Failed to bind to 127.0.0.1:" << port << " : " << strerror(errno) << "\n";
        close(g_server_fd);
        return 1;
    }

    if (listen(g_server_fd, 64) < 0) {
        std::cerr << "[ERROR] Failed to listen on socket: " << strerror(errno) << "\n";
        close(g_server_fd);
        return 1;
    }

    std::cout << "[INFO] Native Daemon listening strictly on http://127.0.0.1:" << port << "\n"
              << "[INFO] BinaryLab & Compiler Explorer API ready.\n"
              << "[INFO] Ready for GoGreen Studio UI connection.\n";

    while (g_running) {
        sockaddr_in client_addr{};
        socklen_t client_len = sizeof(client_addr);
        int client_fd = accept(g_server_fd, reinterpret_cast<sockaddr*>(&client_addr), &client_len);

        if (client_fd < 0) {
            if (!g_running) break;
            continue;
        }

        // Set 5-second socket timeout
        timeval tv{};
        tv.tv_sec = 5;
        tv.tv_usec = 0;
        setsockopt(client_fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
        setsockopt(client_fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

        std::thread([client_fd]() {
            handle_client(client_fd);
        }).detach();
    }

    std::cout << "\n[INFO] Shutting down GoGreen Native Daemon...\n";
    engine.shutdown();
    if (g_server_fd >= 0) {
        close(g_server_fd);
    }
    std::cout << "[INFO] Daemon terminated cleanly.\n";
    return 0;
}
