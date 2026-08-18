package telegram

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

type AutoReplyManager struct {
	rules    []AutoReplyRule
	filepath string
	mu       sync.RWMutex
}

func NewAutoReplyManager(filepath string) *AutoReplyManager {
	arm := &AutoReplyManager{
		rules:    make([]AutoReplyRule, 0),
		filepath: filepath,
	}
	arm.load()
	return arm
}

func (arm *AutoReplyManager) load() {
	arm.mu.Lock()
	defer arm.mu.Unlock()

	data, err := os.ReadFile(arm.filepath)
	if err != nil {
		// Default rule for demo
		arm.rules = []AutoReplyRule{
			{
				ID:        "rule-demo-1",
				Keyword:   "ping",
				Response:  "pong! (Auto-reply via Go Telegram Client 🚀)",
				MatchType: "exact",
				IsActive:  true,
				CreatedAt: time.Now(),
			},
			{
				ID:        "rule-demo-2",
				Keyword:   "info",
				Response:  "Halo! Ini adalah akun Telegram yang terhubung dengan Golang Gateway API.",
				MatchType: "contains",
				IsActive:  true,
				CreatedAt: time.Now(),
			},
		}
		_ = arm.saveLocked()
		return
	}

	_ = json.Unmarshal(data, &arm.rules)
}

func (arm *AutoReplyManager) saveLocked() error {
	data, err := json.MarshalIndent(arm.rules, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(arm.filepath, data, 0644)
}

func (arm *AutoReplyManager) GetRules() []AutoReplyRule {
	arm.mu.RLock()
	defer arm.mu.RUnlock()
	copied := make([]AutoReplyRule, len(arm.rules))
	copy(copied, arm.rules)
	return copied
}

func (arm *AutoReplyManager) AddRule(keyword, response, matchType string, isActive bool) AutoReplyRule {
	arm.mu.Lock()
	defer arm.mu.Unlock()

	rule := AutoReplyRule{
		ID:        fmt.Sprintf("rule-%d", time.Now().UnixNano()),
		Keyword:   strings.TrimSpace(keyword),
		Response:  strings.TrimSpace(response),
		MatchType: matchType,
		IsActive:  isActive,
		CreatedAt: time.Now(),
	}

	arm.rules = append(arm.rules, rule)
	_ = arm.saveLocked()
	return rule
}

func (arm *AutoReplyManager) ToggleRule(id string) (AutoReplyRule, error) {
	arm.mu.Lock()
	defer arm.mu.Unlock()

	for i, r := range arm.rules {
		if r.ID == id {
			arm.rules[i].IsActive = !arm.rules[i].IsActive
			_ = arm.saveLocked()
			return arm.rules[i], nil
		}
	}
	return AutoReplyRule{}, fmt.Errorf("rule not found")
}

func (arm *AutoReplyManager) DeleteRule(id string) error {
	arm.mu.Lock()
	defer arm.mu.Unlock()

	for i, r := range arm.rules {
		if r.ID == id {
			arm.rules = append(arm.rules[:i], arm.rules[i+1:]...)
			return arm.saveLocked()
		}
	}
	return fmt.Errorf("rule not found")
}

func (arm *AutoReplyManager) CheckMatch(text string) (string, bool) {
	arm.mu.RLock()
	defer arm.mu.RUnlock()

	cleanText := strings.ToLower(strings.TrimSpace(text))

	for _, rule := range arm.rules {
		if !rule.IsActive {
			continue
		}
		kw := strings.ToLower(rule.Keyword)

		switch rule.MatchType {
		case "exact":
			if cleanText == kw {
				return rule.Response, true
			}
		case "contains":
			if strings.Contains(cleanText, kw) {
				return rule.Response, true
			}
		case "starts_with":
			if strings.HasPrefix(cleanText, kw) {
				return rule.Response, true
			}
		}
	}
	return "", false
}
