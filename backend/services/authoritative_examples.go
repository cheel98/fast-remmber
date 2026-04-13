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

func EnsureAuthoritativeExamples(ctx context.Context, idiom string, meaning string, current []models.UsageExample) []models.UsageExample {
	normalized := upgradeUsageExamples(normalizeUsageExamples(current), meaning)
	if len(normalized) >= 2 || strings.TrimSpace(idiom) == "" {
		return normalized
	}

	fetched := fetchPeopleAuthoritativeExamples(ctx, idiom, meaning, authoritativeExampleLimit)
	if len(fetched) == 0 {
		return normalized
	}

	return mergeUsageExamples(normalized, fetched, authoritativeExampleLimit)
}

func fetchPeopleAuthoritativeExamples(ctx context.Context, idiom string, meaning string, limit int) []models.UsageExample {
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

		title := buildExampleTitle(record)
		usage := buildUsageDescription(record, meaning)
		key := sentence + "|" + sourceURL
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}

		examples = append(examples, models.UsageExample{
			Title:     title,
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

func upgradeUsageExamples(examples []models.UsageExample, meaning string) []models.UsageExample {
	if len(examples) == 0 {
		return examples
	}

	fallbackMeaning := strings.TrimSpace(meaning)
	upgraded := make([]models.UsageExample, 0, len(examples))

	for _, example := range examples {
		title := strings.TrimSpace(example.Title)
		usage := strings.TrimSpace(example.Usage)

		if title == "" && shouldPromoteUsageToTitle(usage, fallbackMeaning) {
			title = usage
			usage = fallbackMeaning
		}

		upgraded = append(upgraded, models.UsageExample{
			Title:     title,
			Usage:     usage,
			Sentence:  example.Sentence,
			Source:    example.Source,
			SourceURL: example.SourceURL,
		})
	}

	return upgraded
}

func shouldPromoteUsageToTitle(usage string, meaning string) bool {
	if usage == "" || meaning == "" || usage == meaning {
		return false
	}

	meaningLikePrefixes := []string{
		"用于", "用来", "比喻", "形容", "指", "表示", "常用来", "多用来", "多指", "此处",
	}
	for _, prefix := range meaningLikePrefixes {
		if strings.HasPrefix(usage, prefix) {
			return false
		}
	}

	return true
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

func buildExampleTitle(record peopleSearchRecord) string {
	title := truncateRunes(cleanExampleText(record.Title), 14)
	if title != "" {
		return title
	}

	for _, part := range strings.Split(record.BelongsName, "#") {
		part = strings.TrimSpace(part)
		if part != "" {
			return truncateRunes(part, 14)
		}
	}

	return "权威例句"
}

func buildUsageDescription(record peopleSearchRecord, fallbackMeaning string) string {
	fallbackMeaning = strings.TrimSpace(fallbackMeaning)
	if fallbackMeaning != "" {
		return truncateRunes(fallbackMeaning, 20)
	}

	title := cleanExampleText(record.Title)
	title = strings.TrimSpace(strings.Trim(title, "“”\"'《》()（）[]【】"))
	if title != "" {
		return truncateRunes(title, 20)
	}

	for _, part := range strings.Split(record.BelongsName, "#") {
		part = strings.TrimSpace(part)
		if part != "" {
			return truncateRunes(part, 20)
		}
	}

	return "权威语境释义"
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
