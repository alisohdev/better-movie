// Package tmdb owns a bounded, operator-invoked adapter. Runtime requests never call TMDB.
package tmdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Client has no configurable origin: a token is never sent to redirects or mirrors.
// HTTP and sleep are replaceable only in package tests, without opening sockets.
type Client struct {
	token string
	http  *http.Client
	sleep func(context.Context, time.Duration) error
	now   func() time.Time
}
type FetchError struct {
	Code string
	Stop bool
}

func (e *FetchError) Error() string { return e.Code }
func NewClient(token string) (*Client, error) {
	if token == "" || strings.ContainsAny(token, " \t\r\n") {
		return nil, errors.New("TMDB token is missing or invalid")
	}
	return &Client{token: token, http: &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}, sleep: wait, now: time.Now}, nil
}
func wait(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}
func (c *Client) Fetch(ctx context.Context, id int64) (Details, error) {
	if id <= 0 {
		return Details{}, &FetchError{"invalid_id", false}
	}
	address := fmt.Sprintf("https://api.themoviedb.org/3/movie/%d?language=en-US&append_to_response=translations,alternative_titles", id)
	for attempt := 0; attempt < 3; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
		if err != nil {
			return Details{}, &FetchError{"request_failed", true}
		}
		req.Header.Set("Authorization", "Bearer "+c.token)
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "BetterMovie-staging/1")
		response, err := c.http.Do(req)
		if err != nil {
			return Details{}, &FetchError{"transport_failed", true}
		} // Never expose URL/transport errors or provider bodies.
		if response.StatusCode == 200 {
			limited := io.LimitReader(response.Body, (2<<20)+1)
			body, readErr := io.ReadAll(limited)
			_ = response.Body.Close()
			var details Details
			if readErr != nil || len(body) > 2<<20 || json.Unmarshal(body, &details) != nil {
				return Details{}, &FetchError{"invalid_response", false}
			}
			return details, nil
		}
		_ = response.Body.Close()
		status := response.StatusCode
		if status == 401 || status == 403 {
			return Details{}, &FetchError{"access_denied", true}
		}
		if status == 429 || status >= 500 {
			if attempt == 2 {
				return Details{}, &FetchError{"retry_exhausted", true}
			}
			delay := time.Second * time.Duration(1<<attempt)
			if raw := response.Header.Get("Retry-After"); raw != "" {
				if seconds, e := strconv.Atoi(raw); e == nil && seconds >= 0 {
					if seconds > 30 {
						return Details{}, &FetchError{"retry_later", true}
					}
					delay = time.Duration(seconds) * time.Second
				} else if until, e := http.ParseTime(raw); e == nil {
					delay = until.Sub(c.now())
					if delay < 0 {
						delay = 0
					}
				} else {
					return Details{}, &FetchError{"invalid_retry_after", true}
				}
			}
			// A long Retry-After stops this run, rather than retrying early or holding a process indefinitely.
			if delay > 30*time.Second {
				return Details{}, &FetchError{"retry_later", true}
			}
			if c.sleep(ctx, delay) != nil {
				return Details{}, &FetchError{"stopped", true}
			}
			continue
		}
		return Details{}, &FetchError{fmt.Sprintf("http_%d", status), status >= 300 && status < 400}
	}
	return Details{}, &FetchError{"request_failed", true}
}
