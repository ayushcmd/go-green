package nativeclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type DaemonHealth struct {
	Status        string `json:"status"`
	Initialized   bool   `json:"initialized"`
	UptimeSeconds uint64 `json:"uptime_seconds"`
	EngineVersion string `json:"engine_version"`
	Timestamp     string `json:"timestamp"`
}

type NativeCpuInfo struct {
	Vendor        string `json:"vendor"`
	Brand         string `json:"brand"`
	Architecture  string `json:"architecture"`
	Family        uint32 `json:"family"`
	Model         uint32 `json:"model"`
	Stepping      uint32 `json:"stepping"`
	LogicalCores  uint32 `json:"logical_cores"`
	PhysicalCores uint32 `json:"physical_cores"`
	Cache         struct {
		L1dKb uint64 `json:"l1d_kb"`
		L1iKb uint64 `json:"l1i_kb"`
		L2Kb  uint64 `json:"l2_kb"`
		L3Kb  uint64 `json:"l3_kb"`
	} `json:"cache"`
}

type NativeFeatureDetail struct {
	Name        string `json:"name"`
	Category    string `json:"category"`
	HwSupported bool   `json:"hw_supported"`
	OsSupported bool   `json:"os_supported"`
	Active      bool   `json:"active"`
	Description string `json:"description"`
}

type NativeHostInfo struct {
	OsName             string `json:"os_name"`
	OsRelease          string `json:"os_release"`
	KernelVersion      string `json:"kernel_version"`
	Hostname           string `json:"hostname"`
	RuntimeEnvironment string `json:"runtime_environment"`
	UptimeSeconds      uint64 `json:"uptime_seconds"`
	LoadAvg            struct {
		OneM     float64 `json:"1m"`
		FiveM    float64 `json:"5m"`
		FifteenM float64 `json:"15m"`
	} `json:"load_avg"`
	Memory struct {
		TotalBytes     uint64 `json:"total_bytes"`
		FreeBytes      uint64 `json:"free_bytes"`
		AvailableBytes uint64 `json:"available_bytes"`
		SwapTotalBytes uint64 `json:"swap_total_bytes"`
		SwapFreeBytes  uint64 `json:"swap_free_bytes"`
	} `json:"memory"`
	PerfEventSupported bool   `json:"perf_event_supported"`
	PerfEventStatus    string `json:"perf_event_status"`
}

type NativeTelemetry struct {
	Timestamp     string `json:"timestamp"`
	UptimeSeconds uint64 `json:"uptime_seconds"`
	System        struct {
		Load1m  float64 `json:"load_1m"`
		Load5m  float64 `json:"load_5m"`
		Load15m float64 `json:"load_15m"`
		Memory  struct {
			TotalBytes     uint64  `json:"total_bytes"`
			AvailableBytes uint64  `json:"available_bytes"`
			FreeBytes      uint64  `json:"free_bytes"`
			UsedBytes      uint64  `json:"used_bytes"`
			UsedPercent    float64 `json:"used_percent"`
		} `json:"memory"`
		PerfEventSupported bool `json:"perf_event_supported"`
	} `json:"system"`
}

type BenchmarkMetric struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Category         string  `json:"category"`
	Implementation   string  `json:"implementation"`
	InputSizeBytes   uint64  `json:"input_size_bytes"`
	Iterations       uint64  `json:"iterations"`
	DurationMs       float64 `json:"duration_ms"`
	ThroughputOpsSec float64 `json:"throughput_ops_sec"`
	ThroughputMbSec  float64 `json:"throughput_mb_sec"`
	MinNs            float64 `json:"min_ns"`
	MaxNs            float64 `json:"max_ns"`
	MedianNs         float64 `json:"median_ns"`
	P90Ns            float64 `json:"p90_ns"`
	P99Ns            float64 `json:"p99_ns"`
	Timestamp        string  `json:"timestamp"`
	VerifiedCorrect  bool    `json:"verified_correct"`
}

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string, timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *Client) GetHealth(ctx context.Context) (*DaemonHealth, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/health", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var health DaemonHealth
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, err
	}
	return &health, nil
}

func (c *Client) GetCpuInfo(ctx context.Context) (*NativeCpuInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/cpu", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var cpu NativeCpuInfo
	if err := json.NewDecoder(resp.Body).Decode(&cpu); err != nil {
		return nil, err
	}
	return &cpu, nil
}

func (c *Client) GetCpuFeatures(ctx context.Context) ([]NativeFeatureDetail, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/cpu/features", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var features []NativeFeatureDetail
	if err := json.NewDecoder(resp.Body).Decode(&features); err != nil {
		return nil, err
	}
	return features, nil
}

func (c *Client) GetHostInfo(ctx context.Context) (*NativeHostInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/host", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var host NativeHostInfo
	if err := json.NewDecoder(resp.Body).Decode(&host); err != nil {
		return nil, err
	}
	return &host, nil
}

func (c *Client) GetTelemetry(ctx context.Context) (*NativeTelemetry, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/telemetry", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var telem NativeTelemetry
	if err := json.NewDecoder(resp.Body).Decode(&telem); err != nil {
		return nil, err
	}
	return &telem, nil
}

func (c *Client) RunBenchmark(ctx context.Context, benchmarkType string, useAsm bool) ([]BenchmarkMetric, error) {
	q := url.Values{}
	if benchmarkType != "" {
		q.Set("type", benchmarkType)
	}
	if useAsm {
		q.Set("impl", "asm")
	} else {
		q.Set("impl", "cpp")
	}

	targetURL := fmt.Sprintf("%s/api/v1/benchmarks/run?%s", c.baseURL, q.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader([]byte("{}")))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("benchmark execution failed (status %d): %s", resp.StatusCode, string(body))
	}

	// Native daemon returns either an array of metrics or a single metric
	var list []BenchmarkMetric
	if err := json.Unmarshal(body, &list); err == nil {
		return list, nil
	}

	var single BenchmarkMetric
	if err := json.Unmarshal(body, &single); err == nil {
		return []BenchmarkMetric{single}, nil
	}

	return nil, fmt.Errorf("failed to parse benchmark response: %s", string(body))
}
