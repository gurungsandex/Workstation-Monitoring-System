package collector

import (
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// Snapshot field names match the server's MetricPayload exactly (JSON tags).
type Snapshot struct {
	WorkstationID string `json:"workstation_id"`

	CPUUsage   float64   `json:"cpu_usage"`
	CPUTemp    float64   `json:"cpu_temp"`
	CPUPerCore []float64 `json:"cpu_per_core"`

	RAMUsedPct float64 `json:"ram_used_pct"`

	DiskUsedPct  float64 `json:"disk_used_pct"`
	DiskReadMBs  float64 `json:"disk_read_mbs"`
	DiskWriteMBs float64 `json:"disk_write_mbs"`

	GPULoad float64 `json:"gpu_load"`
	GPUTemp float64 `json:"gpu_temp"`

	NetEthIn    float64 `json:"net_eth_in"`    // MB/s in
	NetEthOut   float64 `json:"net_eth_out"`   // MB/s out
	NetDownMbps float64 `json:"net_down_mbps"` // Mbps in
	NetUpMbps   float64 `json:"net_up_mbps"`   // Mbps out

	UptimeSec uint64 `json:"uptime_sec"`
}

// State carried between samples for rate (delta) calculations.
var (
	prevNetCounters  []net.IOCountersStat
	prevDiskCounters map[string]disk.IOCountersStat
	prevSampleTime   time.Time
)

func Collect(workstationID string) (*Snapshot, error) {
	snap := &Snapshot{WorkstationID: workstationID}
	now := time.Now()
	dt := 0.0
	if !prevSampleTime.IsZero() {
		dt = now.Sub(prevSampleTime).Seconds()
	}

	// CPU usage per core (also sets a small sampling window)
	if perCore, err := cpu.Percent(500*time.Millisecond, true); err == nil {
		snap.CPUPerCore = perCore
		total := 0.0
		for _, p := range perCore {
			total += p
		}
		if len(perCore) > 0 {
			snap.CPUUsage = total / float64(len(perCore))
		}
	}

	// CPU temperature (best effort — not available on all platforms)
	if temps, err := host.SensorsTemperatures(); err == nil {
		for _, t := range temps {
			if t.Temperature > snap.CPUTemp {
				snap.CPUTemp = t.Temperature
			}
		}
	}

	// RAM
	if vm, err := mem.VirtualMemory(); err == nil {
		snap.RAMUsedPct = vm.UsedPercent
	}

	// Disk usage (root partition)
	if du, err := disk.Usage("/"); err == nil {
		snap.DiskUsedPct = du.UsedPercent
	}

	// Disk I/O throughput (delta across samples → MB/s)
	if counters, err := disk.IOCounters(); err == nil {
		if prevDiskCounters != nil && dt > 0 {
			var readBytes, writeBytes uint64
			for name, c := range counters {
				if prev, ok := prevDiskCounters[name]; ok {
					readBytes += c.ReadBytes - prev.ReadBytes
					writeBytes += c.WriteBytes - prev.WriteBytes
				}
			}
			snap.DiskReadMBs = float64(readBytes) / 1e6 / dt
			snap.DiskWriteMBs = float64(writeBytes) / 1e6 / dt
		}
		prevDiskCounters = counters
	}

	// Network throughput (delta across samples)
	if counters, err := net.IOCounters(false); err == nil && len(counters) > 0 {
		if prevNetCounters != nil && len(prevNetCounters) > 0 && dt > 0 {
			rxBytes := float64(counters[0].BytesRecv - prevNetCounters[0].BytesRecv)
			txBytes := float64(counters[0].BytesSent - prevNetCounters[0].BytesSent)
			snap.NetEthIn = rxBytes / 1e6 / dt       // MB/s
			snap.NetEthOut = txBytes / 1e6 / dt      // MB/s
			snap.NetDownMbps = rxBytes * 8 / 1e6 / dt // Mbps
			snap.NetUpMbps = txBytes * 8 / 1e6 / dt   // Mbps
		}
		prevNetCounters = counters
	}

	// Uptime
	if uptime, err := host.Uptime(); err == nil {
		snap.UptimeSec = uptime
	}

	// GPU (load/temp) is platform/vendor specific — left at 0 for the
	// cross-platform build; can be populated via nvidia-smi on capable hosts.

	prevSampleTime = now
	return snap, nil
}

// SystemInfo describes static host attributes reported at enrollment.
type SystemInfo struct {
	Hostname   string  `json:"hostname"`
	OSName     string  `json:"os_name"`
	OSShort    string  `json:"os_short"`
	OSFamily   string  `json:"os_family"`
	CPUModel   string  `json:"cpu_model"`
	CPUCores   int     `json:"cpu_cores"`
	RAMTotalGB float64 `json:"ram_total_gb"`
}

func GatherSystemInfo() SystemInfo {
	info := SystemInfo{}

	if h, err := host.Info(); err == nil {
		info.Hostname = h.Hostname
		info.OSName = h.Platform + " " + h.PlatformVersion
		info.OSShort = h.Platform
		switch h.OS {
		case "windows":
			info.OSFamily = "windows"
		case "darwin":
			info.OSFamily = "mac"
		default:
			info.OSFamily = "linux"
		}
	}

	if cpus, err := cpu.Info(); err == nil && len(cpus) > 0 {
		info.CPUModel = cpus[0].ModelName
	}
	if n, err := cpu.Counts(true); err == nil {
		info.CPUCores = n
	}
	if vm, err := mem.VirtualMemory(); err == nil {
		info.RAMTotalGB = float64(vm.Total) / (1 << 30)
	}

	return info
}
