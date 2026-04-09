package services

import (
	"bytes"
	"context"
	"encoding/json"
	"html"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"fast-remmber-backend/models"
)

const authoritativeExampleLimit = 3

var (
	htmlTagPattern     = regexp.MustCompile(`(?s)<[^>]*>`)
	whitespacePattern  = regexp.MustCompile(`\s+`)
	peopleSearchAPIURL = "http://search.people.cn/search-platform/front/search"
)

type peopleSearchResponse struct {
	Code string `json:"code"`
	Data struct {
		Records []peopleSearchRecord `json:"records"`
	} `json:"data"`
}

type peopleSearchRecord struct {
	Title           string `json:"title"`
	Content         string `json:"content"`
	ContentOriginal string `json:"contentOriginal"`
	URL             string `json:"url"`
	BelongsName     string `json:"belongsName"`
}

func EnsureAuthoritativeExamples(ctx context.Context, idiom string, current []models.UsageExample) []models.UsageExample {
	normalized := normalizeUsageExamples(current)
	if len(normalized) >= 2 || strings.TrimSpace(idiom) == "" {
		return normalized
	}

	fetched := fetchPeopleAuthoritativeExamples(ctx, idiom, authoritativeExampleLimit)
	if len(fetched) == 0 {
		return normalized
	}

	return mergeUsageExamples(normalized, fetched, authoritativeExampleLimit)
}

func fetchPeopleAuthoritativeExamples(ctx context.Context, idiom string, limit int) []models.UsageExample {
	requestBody, err := json.Marshal(map[string]any{
		"key": strings.TrimSpace(idiom),
	})
	if err != nil {
		return nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, peopleSearchAPIURL, bytes.NewReader(requestBody))
	if err != nil {
		return nil
	}
	req.Header.Set("Content-Type", "application/json;charset=UTF-8")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("User-Agent", "fast-remmber/1.0")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	var payload peopleSearchResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil
	}

	examples := make([]models.UsageExample, 0, limit)
	seen := make(map[string]struct{}, limit)

	for _, record := range payload.Data.Records {
		if len(examples) >= limit {
			break
		}

		sourceURL := strings.TrimSpace(record.URL)
		sourceName := authoritativeSourceNameForURL(sourceURL)
		if sourceName == "" {
			continue
		}

		sentence := extractSentenceContainingIdiom(record.Content, idiom)
		if sentence == "" {
			sentence = extractSentenceContainingIdiom(record.ContentOriginal, idiom)
		}
		if sentence == "" {
			continue
		}

		usage := buildUsageLabel(record)
		key := sentence + "|" + sourceURL
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}

		examples = append(examples, models.UsageExample{
			Usage:     usage,
			Sentence:  sentence,
			Source:    sourceName,
			SourceURL: sourceURL,
		})
	}

	return examples
}

func mergeUsageExamples(existing []models.UsageExample, fetched []models.UsageExample, limit int) []models.UsageExample {
	merged := make([]models.UsageExample, 0, limit)
	seen := make(map[string]struct{}, limit)

	appendUnique := func(items []models.UsageExample) {
		for _, item := range items {
			if len(merged) >= limit {
				return
			}

			key := strings.TrimSpace(item.Sentence) + "|" + strings.TrimSpace(item.SourceURL)
			if key == "|" {
				continue
			}
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			merged = append(merged, item)
		}
	}

	appendUnique(existing)
	appendUnique(fetched)

	return merged
}

func buildUsageLabel(record peopleSearchRecord) string {
	title := truncateRunes(cleanExampleText(record.Title), 14)
	if title != "" {
		return title
	}

	for _, part := range strings.Split(record.BelongsName, "#") {
		part = strings.TrimSpace(part)
		if part != "" {
			return truncateRunes(part+"语境", 14)
		}
	}

	return "权威例句"
}

func extractSentenceContainingIdiom(rawText string, idiom string) string {
	text := cleanExampleText(rawText)
	idiom = strings.TrimSpace(idiom)
	if text == "" || idiom == "" || !strings.Contains(text, idiom) {
		return ""
	}

	for _, sentence := range splitChineseSentences(text) {
		sentence = strings.TrimSpace(sentence)
		if strings.Contains(sentence, idiom) && utf8.RuneCountInString(sentence) >= 10 {
			return sentence
		}
	}

	return trimSnippetAroundIdiom(text, idiom, 28)
}

func splitChineseSentences(text string) []string {
	sentences := make([]string, 0, 8)
	var builder strings.Builder

	for _, r := range text {
		builder.WriteRune(r)
		switch r {
		case '。', '！', '？', '；':
			sentences = append(sentences, builder.String())
			builder.Reset()
		}
	}

	if builder.Len() > 0 {
		sentences = append(sentences, builder.String())
	}

	return sentences
}

func trimSnippetAroundIdiom(text string, idiom string, radius int) string {
	index := strings.Index(text, idiom)
	if index < 0 {
		return ""
	}

	runes := []rune(text)
	idiomRunes := []rune(idiom)
	runeIndex := utf8.RuneCountInString(text[:index])
	start := runeIndex - radius
	if start < 0 {
		start = 0
	}
	end := runeIndex + len(idiomRunes) + radius
	if end > len(runes) {
		end = len(runes)
	}

	return strings.TrimSpace(string(runes[start:end]))
}

func cleanExampleText(raw string) string {
	if raw == "" {
		return ""
	}

	cleaned := htmlTagPattern.ReplaceAllString(raw, "")
	cleaned = html.UnescapeString(cleaned)
	cleaned = strings.ReplaceAll(cleaned, "\u00a0", " ")
	cleaned = strings.ReplaceAll(cleaned, "\r", " ")
	cleaned = strings.ReplaceAll(cleaned, "\n", " ")
	cleaned = whitespacePattern.ReplaceAllString(cleaned, " ")

	return strings.TrimSpace(cleaned)
}

func truncateRunes(text string, limit int) string {
	if limit <= 0 || utf8.RuneCountInString(text) <= limit {
		return text
	}

	runes := []rune(text)
	return strings.TrimSpace(string(runes[:limit])) + "…"
}

func authoritativeSourceNameForURL(rawURL string) string {
	switch {
	case strings.Contains(strings.ToLower(rawURL), "people.com.cn"), strings.Contains(strings.ToLower(rawURL), "people.cn"):
		return "人民网"
	case strings.Contains(strings.ToLower(rawURL), "xinhuanet.com"), strings.Contains(strings.ToLower(rawURL), "news.cn"):
		return "新华网"
	default:
		return ""
	}
}
