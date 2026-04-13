package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"

	"fast-remmber-backend/models"

	openai "github.com/sashabaranov/go-openai"
)

var authoritativeSourceKeywords = []string{
	"\u4eba\u6c11\u7f51",
	"\u4eba\u6c11\u65e5\u62a5",
	"people.com.cn",
	"people.cn",
	"people's daily",
	"\u65b0\u534e\u7f51",
	"\u65b0\u534e\u793e",
	"xinhua",
	"news.cn",
	"xinhuanet",
}

var authoritativeSourceDomains = []string{
	"people.com.cn",
	"people.cn",
	"xinhuanet.com",
	"news.cn",
}

func ExtractIdiomRelations(ctx context.Context, text string) (*models.IdiomExtractionResult, error) {
	apiKey := os.Getenv("LLM_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("QWEN_API_KEY")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("LLM_API_KEY or QWEN_API_KEY is not set")
	}

	baseURL := os.Getenv("LLM_BASE_URL")
	if baseURL == "" {
		// Default to Dashscope if using QWEN_API_KEY, otherwise let go-openai handle default (usually OpenAI)
		if os.Getenv("QWEN_API_KEY") != "" && os.Getenv("LLM_API_KEY") == "" {
			baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
		}
	}

	model := os.Getenv("LLM_MODEL")
	if model == "" {
		return nil, fmt.Errorf("LLM_MODEL is not set in environment")
	}

	config := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		config.BaseURL = baseURL
	}

	// Logging for debug
	maskedKey := ""
	if len(apiKey) > 8 {
		maskedKey = apiKey[:4] + "****" + apiKey[len(apiKey)-4:]
	} else {
		maskedKey = "invalid-key"
	}
	log.Printf("LLM Config: Model=%s, BaseURL=%s, APIKey=%s", model, baseURL, maskedKey)

	client := openai.NewClientWithConfig(config)

	systemPrompt := strings.Join([]string{
		"你是一个中文成语解析引擎。请解析用户输入的成语，并以严格 JSON 返回以下字段：",
		"- idiom: 成语本身",
		"- meaning: 成语释义，简洁准确",
		"- synonyms: 近义成语数组，每项为 {\"name\":\"成语\",\"strength\":0.0-1.0}",
		"- antonyms: 反义成语数组，每项为 {\"name\":\"成语\",\"strength\":0.0-1.0}",
		"- examples: 例句数组，尽量返回 2 到 4 条不同用法或不同语境的例句。每项为 {\"usage\":\"用法说明\",\"sentence\":\"完整例句\",\"source\":\"来源名称\",\"sourceUrl\":\"文章链接\"}",
		"- emotions: 情感色彩，例如褒义、贬义、中性",
		"",
		"规则：",
		"1. 只返回 JSON，不要输出任何额外说明。",
		"1.1 idiom 字段必须原样返回用户输入，不要改写，不要替换成问号。",
		"2. examples 中的例句必须尽量体现不同用法、不同语境。",
		"3. 例句来源必须限定为权威官方中文来源，优先使用人民网、人民日报、新华网、新华社及其官方站点。",
		"4. source 和 sourceUrl 必须填写真实可核验的信息。",
		"5. 如果无法确认例句确实来自上述权威来源，请返回空数组 examples: []。",
		"6. 不要编造来源名称、文章标题或链接。",
		"7. strength 需要反映语义接近或对立程度。",
		"8. 对于常见的中文四字成语，默认按有效成语处理并正常解析，不要因为缺少上下文而判定为无效输入。",
		"9. 只有在输入明显不是成语、或者完全不是中文时，才可以返回“无效输入”一类结果。",
	}, "\n")

	req := openai.ChatCompletionRequest{
		Model: model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: systemPrompt,
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: text,
			},
		},
		ResponseFormat: &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		},
	}

	resp, err := client.CreateChatCompletion(ctx, req)
	if err != nil {
		log.Printf("LLM Error: %v", err)
		return nil, err
	}

	rawContent := resp.Choices[0].Message.Content
	log.Printf("LLM Raw Response: %s", rawContent)

	var result models.IdiomExtractionResult
	err = json.Unmarshal([]byte(rawContent), &result)
	if err != nil {
		log.Printf("JSON Unmarshal Error: %v | Content: %s", err, rawContent)
		return nil, fmt.Errorf("failed to parse JSON from LLM: %v", err)
	}

	if result.Synonyms == nil {
		result.Synonyms = []models.RelationshipDetail{}
	}
	if result.Antonyms == nil {
		result.Antonyms = []models.RelationshipDetail{}
	}
	result.Examples = EnsureAuthoritativeExamples(ctx, result.Idiom, result.Meaning, result.Examples)

	return &result, nil
}

func normalizeUsageExamples(examples []models.UsageExample) []models.UsageExample {
	if len(examples) == 0 {
		return []models.UsageExample{}
	}

	normalized := make([]models.UsageExample, 0, len(examples))
	seen := make(map[string]struct{}, len(examples))

	for _, example := range examples {
		usage := strings.TrimSpace(example.Usage)
		sentence := strings.TrimSpace(example.Sentence)
		source := strings.TrimSpace(example.Source)
		sourceURL := strings.TrimSpace(example.SourceURL)

		if usage == "" || sentence == "" || source == "" || sourceURL == "" {
			continue
		}
		if !isAuthoritativeSource(source, sourceURL) {
			continue
		}

		key := usage + "|" + sentence + "|" + sourceURL
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}

		normalized = append(normalized, models.UsageExample{
			Title:     strings.TrimSpace(example.Title),
			Usage:     usage,
			Sentence:  sentence,
			Source:    source,
			SourceURL: sourceURL,
		})
	}

	return normalized
}

func isAuthoritativeSource(sourceName string, rawURL string) bool {
	if !matchesAuthoritativeSourceName(sourceName) {
		return false
	}

	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Host == "" {
		return false
	}

	host := strings.ToLower(parsed.Hostname())
	for _, domain := range authoritativeSourceDomains {
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return true
		}
	}

	return false
}

func matchesAuthoritativeSourceName(sourceName string) bool {
	name := strings.ToLower(strings.TrimSpace(sourceName))
	if name == "" {
		return false
	}

	for _, keyword := range authoritativeSourceKeywords {
		if strings.Contains(name, strings.ToLower(keyword)) {
			return true
		}
	}

	return false
}
