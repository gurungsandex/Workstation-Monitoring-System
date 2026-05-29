package collector

import (
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

type Snapshot struct {
	Time          time.Time `json:"time"`
	WorkstationID string    `json:"workstation_id"`

	CPUUsage   float64   `json:"cpu_usage"`
	CPUTemp    float64   `json:"cpu_temp"`
	CPUPerCore []float64 `json:"cpu_per_core"`

	RAMUsedPct float64 `json:"ram_used_pct"`
	RAMUsedGB  float64 `json:"ram_used_gb"`
	RAMTotalGB float64 `json:"ram_total_gb"`

	DiskUsedPct float64 `json:"disk_used_pct"`
	DiskUsedGB  float64 `json:"disk_used_gb"`
	DiskTotalGB float64 `json:"disk_total_gb"`

	GPUUsagePct float64 `json:"gpu_usage_pct"`
	GPUTemp     float64 `json:"gpu_temp"`
	GPUMemGB    float64 `json:"gpu_mem_gb"`

	NetDownMbps float64 `json:"net_down_mbps"`
	NetUpMbps   float64 `json:"net_up_mbps"`

	UptimeSec uint64 `json:"uptime_sec"`
}

var prevIOCounters []net.IOCountersStat
var prevIOTime time.Time

func Collect(workstationID string) (*Snapshot, error) {
	snap := &Snapshot{
		Time:          time.Now().UTC(),
		WorkstationID: workstationID,
	}

	// CPU
	perCore, err := cpu.Percent(500*time.Millisecond, true)
	if err == nil {
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
	temps, err := host.SensorsTemperatures()
	if err == nil {
		for _, t := range temps {
			if t.Temperature > snap.CPUTemp {
				snap.CPUTemp = t.Temperature
			}
		}
	}

	// RAM
	vm, err := mem.VirtualMemory()
	if err == nil {
		snap.RAMUsedPct = vm.UsedPercent
		snap.RAMTotalGB = float64(vm.Total) / (1 << 30)
		snap.RAMUsedGB = float64(vm.Used) / (1 << 30)
	}

	// Disk (root partition)
	du, err := disk.Usage("/")
	if err == nil {
		snap.DiskUsedPct = du.UsedPercent
		snap.DiskTotalGB = float64(du.Total) / (1 << 30)
		snap.DiskUsedGB = float64(du.Used) / (1 << 30)
	}

	// Network throughput (delta between samples)
	counters, err := net.IOCounters(false)
	if err == nil && len(counters) > 0 {
		now := time.Now()
		if prevIOCounters != nil && len(prevIOCounters) > 0 {
			dt := now.Sub(prevIOTime).Seconds()
			if dt > 0 {
				rxDelta := float64(counters[0].BytesRecv-prevIOCounters[0].BytesRecv) * 8 / 1e6 / dt
				txDelta := float64(counters[0].BytesSent-prevIOCounters[0].BytesSent) * 8 / 1e6 / dt
				snap.NetDownMbps = rxDelta
				snap.NetUpMbps = txDelta
			}
		}
		prevIOCounters = counters
		prevIOTime = now
	}

	// Uptime
	uptime, err := host.Uptime()
	if err == nil {
		snap.UptimeSec = uptime
	}

	return snap, nil
}
