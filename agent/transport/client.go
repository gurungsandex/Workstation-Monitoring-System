package transport

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type EnrollRequest struct {
	Token        string  `json:"enrollment_token"`
	Hostname     string  `json:"hostname"`
	OSName       string  `json:"os_name"`
	OSShort      string  `json:"os_short"`
	OSFamily     string  `json:"os_family"`
	CPUModel     string  `json:"cpu_model"`
	CPUCores     int     `json:"cpu_cores"`
	RAMTotalGB   float64 `json:"ram_total_gb"`
	AgentVersion string  `json:"agent_version"`
}

type EnrollResponse struct {
	WorkstationID string `json:"workstation_id"`
	AgentToken    string `json:"agent_token"`
}

type Client struct {
	serverURL     string
	agentToken    string
	workstationID string
	conn          *websocket.Conn
}

func New(serverURL, agentToken, workstationID string) *Client {
	return &Client{
		serverURL:     serverURL,
		agentToken:    agentToken,
		workstationID: workstationID,
	}
}

// Enroll exchanges a one-time enrollment token for a long-lived agent JWT.
func Enroll(httpBase string, req EnrollRequest) (*EnrollResponse, error) {
	body, _ := json.Marshal(req)
	resp, err := http.Post(httpBase+"/api/enroll/register", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("enroll: status %d: %s", resp.StatusCode, b)
	}
	var result EnrollResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Connect establishes the WebSocket connection to the server.
func (c *Client) Connect(ctx context.Context) error {
	u, err := url.Parse(c.serverURL)
	if err != nil {
		return err
	}

	q := u.Query()
	q.Set("token", c.agentToken)
	u.RawQuery = q.Encode()

	dialer := websocket.Dialer{HandshakeTimeout: 10 * time.Second}
	conn, _, err := dialer.DialContext(ctx, u.String(), nil)
	if err != nil {
		return err
	}
	c.conn = conn

	// Read server ack / pings in background
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				if !strings.Contains(err.Error(), "use of closed network connection") {
					log.Printf("ws read: %v", err)
				}
				return
			}
		}
	}()

	return nil
}

// Send serialises the payload and sends it over the WebSocket.
func (c *Client) Send(payload any) error {
	if c.conn == nil {
		return fmt.Errorf("not connected")
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return c.conn.WriteMessage(websocket.TextMessage, b)
}

func (c *Client) Close() {
	if c.conn != nil {
		_ = c.conn.Close()
	}
}

// Reconnect retries Connect with exponential backoff.
func (c *Client) Reconnect(ctx context.Context) {
	backoff := time.Second
	for {
		log.Printf("Reconnecting to %s...", c.serverURL)
		if err := c.Connect(ctx); err == nil {
			log.Println("Reconnected.")
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
			backoff *= 2
			if backoff > 30*time.Second {
				backoff = 30 * time.Second
			}
		}
	}
}
