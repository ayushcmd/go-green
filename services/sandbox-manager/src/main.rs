//! GoGreen Sandbox Supervisor Daemon & CLI
//!
//! Exposes host capability probing, isolation validation, and HTTP REST endpoints
//! for remote invocation by Go workers and the GoGreen Studio.

use std::env;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

use sandbox_manager::config::policy::ExecutionRequest;
use sandbox_manager::runtime::executor::SandboxRuntime;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let artifact_dir = env::var("GOGREEN_ARTIFACT_DIR").unwrap_or_else(|_| "dist/artifacts/executions".to_string());
    let runtime = Arc::new(SandboxRuntime::new(&artifact_dir));

    if args.contains(&"--probe-capabilities".to_string()) || args.contains(&"--probe".to_string()) {
        let caps = runtime.capabilities();
        println!("{}", serde_json::to_string_pretty(&caps)?);
        return Ok(());
    }

    if args.contains(&"--test-isolation".to_string()) {
        println!("=== GoGreen Sandbox Isolation Self-Test ===");
        let caps = runtime.capabilities();
        println!("  - Cgroups v2: {}", caps.cgroups_v2_available);
        println!("  - PID Namespace: {}", caps.pid_namespace);
        println!("  - Mount Namespace: {}", caps.mount_namespace);
        println!("  - Network Namespace: {}", caps.network_namespace);
        println!("  - Seccomp-BPF: {}", caps.seccomp_available);
        println!("  - Landlock LSM: {}", caps.landlock_available);

        // Run quick controlled test (e.g. echo hello)
        println!("\nExecuting controlled test isolation run...");
        let result = runtime.execute_controlled_test("echo", vec!["gogreen-sandbox-test-ok".into()]).await?;
        println!("  - Execution ID: {}", result.execution_id);
        println!("  - Status: {:?}", result.status);
        println!("  - Exit code: {}", result.exit_code);
        println!("  - Wall time: {}ms", result.wall_time_ms);
        println!("  - Output: {}", result.stdout_summary.trim());
        println!("\n[OK] Sandbox isolation self-test completed successfully.");
        return Ok(());
    }

    let port: u16 = env::var("GOGREEN_SANDBOX_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8081);

    let bind_addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&bind_addr).await?;
    println!("==========================================================");
    println!("  GoGreen Sandbox Manager Daemon");
    println!("  Listening on: http://{}", bind_addr);
    println!("  Artifact Storage: {}", artifact_dir);
    println!("  Endpoints:");
    println!("    GET  /health");
    println!("    GET  /capabilities");
    println!("    GET  /metrics");
    println!("    GET  /executions");
    println!("    POST /execute");
    println!("    POST /execute/benchmark");
    println!("    POST /execute/test");
    println!("==========================================================");

    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                let runtime_clone = runtime.clone();
                tokio::spawn(async move {
                    if let Err(e) = handle_client(stream, runtime_clone).await {
                        eprintln!("[GOGREEN ERROR] Client handling failed: {}", e);
                    }
                });
            }
            Err(e) => {
                eprintln!("[GOGREEN ERROR] Accept error: {}", e);
            }
        }
    }
}

async fn handle_client(mut stream: TcpStream, runtime: Arc<SandboxRuntime>) -> Result<(), Box<dyn std::error::Error>> {
    let mut buffer = [0u8; 16384];
    let bytes_read = stream.read(&mut buffer).await?;
    if bytes_read == 0 {
        return Ok(());
    }

    let request_str = String::from_utf8_lossy(&buffer[..bytes_read]);
    let mut lines = request_str.lines();
    let request_line = lines.next().unwrap_or("");
    let parts: Vec<&str> = request_line.split_whitespace().collect();

    if parts.len() < 2 {
        send_response(&mut stream, 400, "Bad Request", "Invalid HTTP request").await?;
        return Ok(());
    }

    let method = parts[0];
    let path = parts[1];

    // Find JSON body if POST
    let body = if let Some(idx) = request_str.find("\r\n\r\n") {
        &request_str[idx + 4..]
    } else {
        ""
    };

    match (method, path) {
        ("GET", "/health") => {
            let resp = serde_json::json!({
                "status": "UP",
                "service": "sandbox-manager",
                "timestamp": chrono::Utc::now().to_rfc3339(),
            });
            send_json_response(&mut stream, 200, "OK", &resp).await?;
        }
        ("GET", "/capabilities") => {
            let caps = runtime.capabilities();
            send_json_response(&mut stream, 200, "OK", &caps).await?;
        }
        ("GET", "/metrics") => {
            let metrics = runtime.metrics();
            send_json_response(&mut stream, 200, "OK", &metrics).await?;
        }
        ("GET", "/executions") => {
            let history = runtime.get_history().await;
            send_json_response(&mut stream, 200, "OK", &history).await?;
        }
        ("POST", "/execute") => {
            match serde_json::from_str::<ExecutionRequest>(body) {
                Ok(req) => match runtime.execute(req).await {
                    Ok(res) => send_json_response(&mut stream, 200, "OK", &res).await?,
                    Err(err) => send_response(&mut stream, 400, "Execution Error", &err).await?,
                },
                Err(e) => send_response(&mut stream, 400, "Bad Request", &format!("Invalid JSON payload: {}", e)).await?,
            }
        }
        ("POST", "/execute/benchmark") => {
            let res = runtime.execute_benchmark("echo", vec!["benchmark-profile-simulated".into()]).await;
            match res {
                Ok(result) => send_json_response(&mut stream, 200, "OK", &result).await?,
                Err(err) => send_response(&mut stream, 500, "Internal Error", &err).await?,
            }
        }
        ("POST", "/execute/test") => {
            let res = runtime.execute_controlled_test("echo", vec!["controlled-test-ok".into()]).await;
            match res {
                Ok(result) => send_json_response(&mut stream, 200, "OK", &result).await?,
                Err(err) => send_response(&mut stream, 500, "Internal Error", &err).await?,
            }
        }
        ("OPTIONS", _) => {
            // CORS preflight
            let response = "HTTP/1.1 204 No Content\r\n\
                Access-Control-Allow-Origin: *\r\n\
                Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
                Access-Control-Allow-Headers: Content-Type\r\n\
                Content-Length: 0\r\n\r\n";
            stream.write_all(response.as_bytes()).await?;
        }
        _ => {
            send_response(&mut stream, 404, "Not Found", "Endpoint not found").await?;
        }
    }

    Ok(())
}

async fn send_json_response<T: serde::Serialize>(
    stream: &mut TcpStream,
    status_code: u16,
    status_text: &str,
    data: &T,
) -> Result<(), Box<dyn std::error::Error>> {
    let json_bytes = serde_json::to_vec(data)?;
    let header = format!(
        "HTTP/1.1 {} {}\r\n\
        Content-Type: application/json\r\n\
        Access-Control-Allow-Origin: *\r\n\
        Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
        Access-Control-Allow-Headers: Content-Type\r\n\
        Content-Length: {}\r\n\
        Connection: close\r\n\r\n",
        status_code,
        status_text,
        json_bytes.len()
    );
    stream.write_all(header.as_bytes()).await?;
    stream.write_all(&json_bytes).await?;
    stream.flush().await?;
    Ok(())
}

async fn send_response(
    stream: &mut TcpStream,
    status_code: u16,
    status_text: &str,
    body: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let header = format!(
        "HTTP/1.1 {} {}\r\n\
        Content-Type: text/plain\r\n\
        Access-Control-Allow-Origin: *\r\n\
        Content-Length: {}\r\n\
        Connection: close\r\n\r\n{}",
        status_code,
        status_text,
        body.len(),
        body
    );
    stream.write_all(header.as_bytes()).await?;
    stream.flush().await?;
    Ok(())
}
