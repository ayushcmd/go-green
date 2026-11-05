#include "gogreen/engine.hpp"
#include <iostream>
#include <string>
#include <sstream>
#include <vector>
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
    char buffer[4096] = {0};
    ssize_t bytes_read = read(client_fd, buffer, sizeof(buffer) - 1);
    if (bytes_read <= 0) {
        close(client_fd);
        return;
    }

    std::string request(buffer, bytes_read);
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

    if (method == "GET" && (pure_path == "/" || pure_path == "/api")) {
        std::string body = "{\n  \"service\": \"GoGreen Native Core Daemon\",\n  \"version\": \"2.0.0-phase2\",\n  \"status\": \"ONLINE\",\n  \"docs\": \"/api/v1/\"\n}";
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
        // Extract benchmark parameters if present
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
