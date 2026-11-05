#pragma once

#include <string>
#include <vector>
#include <cstdint>

namespace gogreen::binary {

struct CompilerRequest {
    std::string source_code;
    std::string compiler = "g++"; // "g++" or "clang++"
    std::string optimization_level = "-O2"; // "-O0", "-O1", "-O2", "-O3", "-Os"
    std::string target_arch = "x86-64";
    std::vector<std::string> extra_flags;
    int timeout_ms = 5000;
};

struct CompilerInstruction {
    int source_line = 0;
    std::string text;
};

struct CompilerResult {
    bool success = false;
    std::string compiler;
    std::string compiler_version;
    std::string optimization_level;
    std::string assembly_output;
    std::vector<CompilerInstruction> instructions;
    std::string error_output;
    double compilation_time_ms = 0.0;
};

class CompilerExplorer {
public:
    static CompilerResult compile_to_assembly(const CompilerRequest& request);
    static std::string sanitize_assembly(const std::string& raw_asm);
};

} // namespace gogreen::binary
