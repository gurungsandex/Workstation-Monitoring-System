package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gurungsandex/wms-agent/collector"
	"github.com/gurungsandex/wms-agent/config"
	"github.com/gurungsandex/wms-agent/transport"
)

const agentVersion = "1.0.0"

type state struct {
	WorkstationID string `json:"workstation_id"`
	AgentToken    string `json:"agent_token"`
}

func loadState(path string) *state {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var s state
	if err := json.Unmarshal(b, &s); err != nil {
		return nil
	}
	return &s
}

func saveState(path string, s *state) {
	b, _ := json.Marshal(s)
	_ = os.WriteFile(path, b, 0600)
}

func main() {
	cfg := config.Load()

	// Load persisted state (overrides env vars if present)
	if s := loadState(cfg.StateFile); s != nil {
		if cfg.AgentToken == "" {
			cfg.AgentToken = s.AgentToken
		}
		if cfg.WorkstationID == "" {
			cfg.WorkstationID = s.WorkstationID
		}
	}

	// Enrollment flow
	if cfg.AgentToken == "" {
		if cfg.EnrollToken == "" {
			log.Fatal("No WMS_AGENT_TOKEN and no WMS_ENROLL_TOKEN — cannot start. Run enroll first.")
		}

		hostname, _ := os.Hostname()
		// Derive HTTP base from WS URL
		httpBase := cfg.ServerURL
		if len(httpBase) > 3 && httpBase[:3] == "wss" {
			httpBase = "https" + httpBase[3:]
		} else if len(httpBase) > 2 && httpBase[:2] == "ws" {
			httpBase = "http" + httpBase[2:]
		}
		// Strip /ws/agent suffix
		for _, suffix := range []string{"/ws/agent", "/ws"} {
			if len(httpBase) > len(suffix) && httpBase[len(httpBase)-len(suffix):] == suffix {
				httpBase = httpBase[:len(httpBase)-len(suffix)]
				break
			}
		}

		sys := collector.GatherSystemInfo()
		if sys.Hostname == "" {
			sys.Hostname = hostname
		}

		log.Printf("Enrolling with token %s...", cfg.EnrollToken[:8]+"****")
		resp, err := transport.Enroll(httpBase, transport.EnrollRequest{
			Token:        cfg.EnrollToken,
			Hostname:     sys.Hostname,
			OSName:       sys.OSName,
			OSShort:      sys.OSShort,
			OSFamily:     sys.OSFamily,
			CPUModel:     sys.CPUModel,
			CPUCores:     sys.CPUCores,
			RAMTotalGB:   sys.RAMTotalGB,
			AgentVersion: agentVersion,
		})
		if err != nil {
			log.Fatalf("Enrollment failed: %v", err)
		}

		cfg.AgentToken = resp.AgentToken
		cfg.WorkstationID = resp.WorkstationID
		saveState(cfg.StateFile, &state{
			WorkstationID: cfg.WorkstationID,
			AgentToken:    cfg.AgentToken,
		})
		log.Printf("Enrolled as workstation %s", cfg.WorkstationID)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	client := transport.New(cfg.ServerURL, cfg.AgentToken, cfg.WorkstationID)

	if err := client.Connect(ctx); err != nil {
		log.Printf("Initial connect failed: %v — will retry", err)
		client.Reconnect(ctx)
	}
	defer client.Close()

	ticker := time.NewTicker(cfg.SendInterval)
	defer ticker.Stop()

	log.Printf("Agent running — sending metrics every %s", cfg.SendInterval)

	for {
		select {
		case <-ctx.Done():
			log.Println("Shutting down agent.")
			return

		case <-ticker.C:
			snap, err := collector.Collect(cfg.WorkstationID)
			if err != nil {
				log.Printf("collect error: %v", err)
				continue
			}
			if err := client.Send(snap); err != nil {
				log.Printf("send error: %v — reconnecting", err)
				client.Reconnect(ctx)
				// Retry send after reconnect
				if err2 := client.Send(snap); err2 != nil {
					log.Printf("send retry failed: %v", err2)
				}
			}
		}
	}
}
