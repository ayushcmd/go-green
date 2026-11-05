#include "gogreen/binary/compiler_explorer.hpp"
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <sstream>
#include <vector>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <fcntl.h>
#include <signal.h>

namespace gogreen::binary {

namespace {

std::string get_compiler_version_string(const std::string& compiler) {
    int pipe_fd[2];
    if (pipe(pipe_fd) == -1) return "unknown";

    pid_t pid = fork();
    if (pid == -1) {
        close(pipe_fd[0]);
        close(pipe_fd[1]);
        return "unknown";
    }

    if (pid == 0) {
        // Child
        close(pipe_fd[0]);
        dup2(pipe_fd[1], STDOUT_FILENO);
        dup2(pipe_fd[1], STDERR_FILENO);
        close(pipe_fd[1]);

        char* const argv[] = {
            const_cast<char*>(compiler.c_str()),
            const_cast<char*>("--version"),
            nullptr
        };
        execvp(argv[0], argv);
        _exit(127);
    }

    // Parent
    close(pipe_fd[1]);
    char buf[512];
    std::string output;
    ssize_t bytes_read = 0;
    while ((bytes_read = read(pipe_fd[0], buf, sizeof(buf) - 1)) > 0) {
        buf[bytes_read] = '\0';
        output += buf;
    }
    close(pipe_fd[0]);
    waitpid(pid, nullptr, 0);

    // Return the first line
    size_t newline = output.find('\n');
    return (newline != std::string::npos) ? output.substr(0, newline) : output;
}

} // namespace

std::string CompilerExplorer::sanitize_assembly(const std::string& raw_asm) {
    std::istringstream stream(raw_asm);
    std::ostringstream result;
    std::string line;

    while (std::getline(stream, line)) {
        // Trim leading spaces
        size_t first = line.find_first_not_of(" \t");
        if (first == std::string::npos) continue;

        std::string trimmed = line.substr(first);

        // Filter out noisy metadata directives
        if (trimmed.rfind(".cfi_", 0) == 0 ||
            trimmed.rfind(".ident", 0) == 0 ||
            trimmed.rfind(".section\t.note", 0) == 0 ||
            trimmed.rfind(".file", 0) == 0) {
            continue;
        }

        result << line << "\n";
    }

    return result.str();
}

CompilerResult CompilerExplorer::compile_to_assembly(const CompilerRequest& request) {
    CompilerResult result;
    result.compiler = (request.compiler == "clang++") ? "clang++" : "g++";
    result.optimization_level = request.optimization_level.empty() ? "-O2" : request.optimization_level;
    result.compiler_version = get_compiler_version_string(result.compiler);

    auto start_time = std::chrono::high_resolution_clock::now();

    // Create temporary source and output file paths
    char src_template[] = "/tmp/gogreen_src_XXXXXX.cpp";
    int src_fd = mkstemps(src_template, 4);
    if (src_fd == -1) {
        result.success = false;
        result.error_output = "Failed to create temporary source file in /tmp";
        return result;
    }

    // Write source code
    ssize_t written = write(src_fd, request.source_code.data(), request.source_code.size());
    close(src_fd);

    if (written < 0 || static_cast<size_t>(written) != request.source_code.size()) {
        unlink(src_template);
        result.success = false;
        result.error_output = "Failed to write source code to temporary file";
        return result;
    }

    std::string asm_path = std::string(src_template) + ".s";

    // Setup pipe for capturing compiler diagnostics (stderr)
    int err_pipe[2];
    if (pipe(err_pipe) == -1) {
        unlink(src_template);
        result.success = false;
        result.error_output = "Failed to create error pipe";
        return result;
    }

    pid_t pid = fork();
    if (pid == -1) {
        close(err_pipe[0]);
        close(err_pipe[1]);
        unlink(src_template);
        result.success = false;
        result.error_output = "Fork failed";
        return result;
    }

    if (pid == 0) {
        // Child: strictly contained invocation using argv array
        close(err_pipe[0]);
        dup2(err_pipe[1], STDERR_FILENO);
        close(err_pipe[1]);

        // Redirect stdout to /dev/null
        int dev_null = open("/dev/null", O_WRONLY);
        if (dev_null != -1) {
            dup2(dev_null, STDOUT_FILENO);
            close(dev_null);
        }

        std::vector<char*> argv;
        argv.push_back(const_cast<char*>(result.compiler.c_str()));
        argv.push_back(const_cast<char*>("-S"));
        argv.push_back(const_cast<char*>("-masm=intel"));
        argv.push_back(const_cast<char*>("-fno-asynchronous-unwind-tables"));
        argv.push_back(const_cast<char*>("-fno-dwarf2-cfi-asm"));
        argv.push_back(const_cast<char*>("-std=c++20"));
        argv.push_back(const_cast<char*>(result.optimization_level.c_str()));

        // Target architecture
        if (request.target_arch == "x86-64") {
            argv.push_back(const_cast<char*>("-march=x86-64"));
        }

        argv.push_back(const_cast<char*>("-o"));
        argv.push_back(const_cast<char*>(asm_path.c_str()));
        argv.push_back(const_cast<char*>(src_template));
        argv.push_back(nullptr);

        execvp(argv[0], argv.data());
        _exit(127);
    }

    // Parent
    close(err_pipe[1]);

    // Read stderr
    std::string err_output;
    char buffer[1024];
    ssize_t bytes_read = 0;
    while ((bytes_read = read(err_pipe[0], buffer, sizeof(buffer) - 1)) > 0) {
        buffer[bytes_read] = '\0';
        err_output += buffer;
    }
    close(err_pipe[0]);

    // Wait with timeout
    int status = 0;
    pid_t waited = waitpid(pid, &status, 0);

    auto end_time = std::chrono::high_resolution_clock::now();
    result.compilation_time_ms = std::chrono::duration<double, std::milli>(end_time - start_time).count();
    result.error_output = err_output;

    if (waited == pid && WIFEXITED(status) && WEXITSTATUS(status) == 0) {
        result.success = true;

        // Read generated assembly file
        std::ifstream asm_file(asm_path);
        if (asm_file.is_open()) {
            std::stringstream ss;
            ss << asm_file.rdbuf();
            std::string raw_asm = ss.str();
            result.assembly_output = sanitize_assembly(raw_asm);

            // Populate instruction list
            std::istringstream asm_stream(result.assembly_output);
            std::string line;
            int line_num = 1;
            while (std::getline(asm_stream, line)) {
                if (!line.empty()) {
                    CompilerInstruction instr;
                    instr.source_line = line_num;
                    instr.text = line;
                    result.instructions.push_back(std::move(instr));
                }
                ++line_num;
            }
        } else {
            result.success = false;
            result.error_output += "\nGenerated assembly file could not be opened.";
        }
    } else {
        result.success = false;
    }

    // Clean up temporary files
    unlink(src_template);
    unlink(asm_path.c_str());

    return result;
}

} // namespace gogreen::binary
