package hardware

import (
	"context"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/ayushcmd/go-green/services/worker-agent/internal/nativeclient"
)

type HardwareDiscovery struct {
	Hostname                string
	OperatingSystem         string
	Architecture            string
	CPUVendor               string
	CPUModel                string
	PhysicalCores           uint32
	LogicalCores            uint32
	MemoryTotalBytes        uint64
	SupportedInstructionSets []string
	NativeEngineVersion     string
	NativeDaemonAvailable   bool
	UptimeSeconds           uint64
}

func Discover(ctx context.Context, nativeClient *nativeclient.Client) *HardwareDiscovery {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "unknown-host"
	}

	info := &HardwareDiscovery{
		Hostname:         hostname,
		OperatingSystem:  runtime.GOOS,
		Architecture:     normalizeArch(runtime.GOARCH),
		LogicalCores:     uint32(runtime.NumCPU()),
		PhysicalCores:    uint32(runtime.NumCPU() / 2),
		MemoryTotalBytes: 1024 * 1024 * 1024 * 4, // 4GB default fallback
	}
	if info.PhysicalCores == 0 {
		info.PhysicalCores = 1
	}

	if nativeClient == nil {
		return info
	}

	// Try querying native daemon for genuine hardware details
	discoverCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	health, err := nativeClient.GetHealth(discoverCtx)
	if err != nil || !health.Initialized {
		info.NativeDaemonAvailable = false
		return info
	}

	info.NativeDaemonAvailable = true
	info.NativeEngineVersion = health.EngineVersion

	// CPU details from native daemon
	if cpu, err := nativeClient.GetCpuInfo(discoverCtx); err == nil {
		info.CPUVendor = cpu.Vendor
		info.CPUModel = strings.TrimSpace(cpu.Brand)
		if cpu.PhysicalCores > 0 {
			info.PhysicalCores = cpu.PhysicalCores
		}
		if cpu.LogicalCores > 0 {
			info.LogicalCores = cpu.LogicalCores
		}
		if cpu.Architecture != "" {
			info.Architecture = cpu.Architecture
		}
	}

	// Host OS & Memory stats from native daemon
	if host, err := nativeClient.GetHostInfo(discoverCtx); err == nil {
		if host.OsName != "" {
			info.OperatingSystem = host.OsName
			if host.RuntimeEnvironment != "" {
				info.OperatingSystem = host.RuntimeEnvironment
			}
		}
		if host.Memory.TotalBytes > 0 {
			info.MemoryTotalBytes = host.Memory.TotalBytes
		}
		info.UptimeSeconds = host.UptimeSeconds
	}

	// Supported instruction sets
	if features, err := nativeClient.GetCpuFeatures(discoverCtx); err == nil {
		var activeFeatures []string
		for _, f := range features {
			if f.Active {
				activeFeatures = append(activeFeatures, f.Name)
			}
		}
		info.SupportedInstructionSets = activeFeatures
	}

	return info
}

func normalizeArch(goarch string) string {
	switch goarch {
	case "amd64":
		return "x86_64"
	case "arm64":
		return "aarch64"
	case "riscv64":
		return "riscv64"
	default:
		return goarch
	}
}
